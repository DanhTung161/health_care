import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { getShopifyWebhookConfig, ShopifyError } from '@/lib/shopify/config';

export function verifyShopifyWebhook(rawBody: Buffer, suppliedHmac: string | null): boolean {
  const { webhookSecret } = getShopifyWebhookConfig();
  if (!suppliedHmac || !/^[A-Za-z0-9+/]{43}=$/.test(suppliedHmac)) return false;
  const expected = createHmac('sha256', webhookSecret).update(rawBody).digest();
  const received = Buffer.from(suppliedHmac, 'base64');
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export function webhookOrderId(topic: string, payload: unknown): string {
  if (!payload || typeof payload !== 'object') throw new ShopifyError('INVALID_PAYLOAD', 'Invalid Shopify webhook payload');
  const body = payload as Record<string, unknown>;
  if (!['orders/create', 'orders/updated', 'orders/paid', 'orders/cancelled', 'refunds/create'].includes(topic)) {
    throw new ShopifyError('INVALID_PAYLOAD', 'Unsupported Shopify webhook topic');
  }
  const gid = body.admin_graphql_api_id;
  if (topic !== 'refunds/create' && typeof gid === 'string' && /^gid:\/\/shopify\/Order\/\d+$/.test(gid)) return gid;
  const numeric = topic === 'refunds/create' ? body.order_id : body.id;
  if ((typeof numeric === 'number' && Number.isSafeInteger(numeric) && numeric > 0) || (typeof numeric === 'string' && /^\d+$/.test(numeric))) {
    return `gid://shopify/Order/${numeric}`;
  }
  throw new ShopifyError('INVALID_PAYLOAD', 'Shopify webhook has no valid Order identity');
}
