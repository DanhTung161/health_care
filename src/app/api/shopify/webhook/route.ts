import { NextResponse } from 'next/server';
import { getShopifyAdminConfig, ShopifyError } from '@/lib/shopify/config';
import { synchronizeShopifyOrder } from '@/lib/shopify/orders';
import { verifyShopifyWebhook, webhookOrderId } from '@/lib/shopify/webhook';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const rawBody = Buffer.from(await request.arrayBuffer());
    if (rawBody.length > 1_000_000) return NextResponse.json({ success: false, error: 'Webhook is too large' }, { status: 413 });
    if (!verifyShopifyWebhook(rawBody, request.headers.get('x-shopify-hmac-sha256'))) {
      return NextResponse.json({ success: false, error: 'Invalid Shopify webhook signature' }, { status: 401 });
    }
    const config = getShopifyAdminConfig();
    if (request.headers.get('x-shopify-shop-domain')?.toLowerCase() !== config.domain) {
      return NextResponse.json({ success: false, error: 'Shopify shop domain mismatch' }, { status: 403 });
    }
    const deliveryId = request.headers.get('x-shopify-webhook-id');
    if (!deliveryId) {
      return NextResponse.json({ success: false, error: 'Shopify delivery ID is required' }, { status: 400 });
    }
    const topic = request.headers.get('x-shopify-topic') || '';
    let payload: unknown;
    try { payload = JSON.parse(rawBody.toString('utf8')); }
    catch { throw new ShopifyError('INVALID_PAYLOAD', 'Invalid Shopify webhook JSON'); }
    const orderId = webhookOrderId(topic, payload);
    const result = await synchronizeShopifyOrder(orderId, deliveryId);
    return NextResponse.json({ success: true, result });
  } catch (error) {
    if (error instanceof ShopifyError) {
      const status = error.code === 'NOT_CONFIGURED' ? 503 : error.code === 'INVALID_PAYLOAD' ? 400 : error.code === 'RATE_LIMIT' ? 503 : error.code === 'DATA_INTEGRITY' ? 409 : 502;
      return NextResponse.json({ success: false, error: error.message, code: error.code }, { status });
    }
    return NextResponse.json({ success: false, error: 'Shopify webhook could not be processed' }, { status: 502 });
  }
}
