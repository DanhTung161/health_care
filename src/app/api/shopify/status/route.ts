import { type NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { shopifyGraphQL } from '@/lib/shopify/client';
import { getShopifyStatus, isShopifyWebhookConfigured, ShopifyError } from '@/lib/shopify/config';

export async function GET(request: NextRequest) {
  const user = await authenticateRequest(request);
  if (!user) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  if (user.role !== 'ADMIN') return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  const status = getShopifyStatus();
  const webhookConfigured = isShopifyWebhookConfigured();
  if (status === 'NOT_CONFIGURED' || request.nextUrl.searchParams.get('verify') !== '1') {
    return NextResponse.json({ success: true, data: { status, webhookConfigured } });
  }
  try {
    const data = await shopifyGraphQL<{
      shop: { id: string; myshopifyDomain: string };
      products: { nodes: { id: string }[] };
      collections: { nodes: { id: string }[] };
      articles: { nodes: { id: string }[] };
      orders: { nodes: { id: string }[] };
    }>(`query VerifyShopify { shop { id myshopifyDomain } products(first: 1) { nodes { id } } collections(first: 1) { nodes { id } } articles(first: 1) { nodes { id } } orders(first: 1) { nodes { id } } }`);
    return NextResponse.json({ success: true, data: {
      status: 'VERIFIED', webhookConfigured, shopDomain: data.shop.myshopifyDomain,
      boundedReads: { products: data.products.nodes.length, collections: data.collections.nodes.length, articles: data.articles.nodes.length, orders: data.orders.nodes.length },
    } });
  } catch (error) {
    if (error instanceof ShopifyError) return NextResponse.json({ success: false, data: { status: 'CONFIGURED', webhookConfigured }, error: error.message, code: error.code }, { status: 502 });
    return NextResponse.json({ success: false, data: { status: 'CONFIGURED', webhookConfigured }, error: 'Shopify connection verification failed' }, { status: 502 });
  }
}
