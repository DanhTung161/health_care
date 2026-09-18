import { type NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { ShopifyError } from '@/lib/shopify/config';
import { reconcileShopifyOrders } from '@/lib/shopify/orders';

export async function POST(request: NextRequest) {
  const user = await authenticateRequest(request);
  if (!user) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  if (user.role !== 'ADMIN') return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  try {
    let body: unknown;
    try { body = await request.json(); }
    catch { throw new ShopifyError('INVALID_PAYLOAD', 'Invalid reconciliation JSON'); }
    if (!body || typeof body !== 'object') throw new ShopifyError('INVALID_PAYLOAD', 'Invalid reconciliation request');
    const input = body as Record<string, unknown>;
    const isoTimestamp = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?(?:Z|[+-]\d\d:\d\d)$/;
    if (typeof input.from !== 'string' || typeof input.to !== 'string' || !isoTimestamp.test(input.from) || !isoTimestamp.test(input.to)) {
      throw new ShopifyError('INVALID_PAYLOAD', 'from and to must be ISO timestamps with timezone');
    }
    if (input.after !== undefined && input.after !== null && typeof input.after !== 'string') throw new ShopifyError('INVALID_PAYLOAD', 'Invalid reconciliation cursor');
    if (input.maxPages !== undefined && typeof input.maxPages !== 'number') throw new ShopifyError('INVALID_PAYLOAD', 'Invalid reconciliation page limit');
    const result = await reconcileShopifyOrders(
      { from: new Date(input.from), to: new Date(input.to) },
      input.maxPages === undefined ? 5 : input.maxPages,
      input.after ?? null,
    );
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof ShopifyError) return NextResponse.json({ success: false, error: error.message, code: error.code }, { status: error.code === 'NOT_CONFIGURED' ? 503 : error.code === 'INVALID_PAYLOAD' ? 400 : 502 });
    return NextResponse.json({ success: false, error: 'Shopify reconciliation failed' }, { status: 502 });
  }
}
