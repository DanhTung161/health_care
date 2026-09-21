import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { getShopifyWebhookConfig, ShopifyError } from '@/lib/shopify/config';

export const SHOPIFY_FINANCIAL_TOPICS = [
  'orders/create', 'orders/updated', 'orders/paid', 'orders/cancelled', 'refunds/create',
] as const;
export type ShopifyFinancialTopic = typeof SHOPIFY_FINANCIAL_TOPICS[number];

export function verifyShopifyWebhook(rawBody: Buffer, suppliedHmac: string | null): boolean {
  const { webhookSecret } = getShopifyWebhookConfig();
  const expected = createHmac('sha256', webhookSecret).update(rawBody).digest();
  let received = Buffer.alloc(expected.length);
  let validFormat = false;
  if (suppliedHmac && /^[A-Za-z0-9+/]{43}=$/.test(suppliedHmac)) {
    const decoded = Buffer.from(suppliedHmac, 'base64');
    if (decoded.length === expected.length) {
      received = decoded;
      validFormat = true;
    }
  }
  return timingSafeEqual(received, expected) && validFormat;
}

export function normalizeShopifyWebhookDomain(value: string | null): string | null {
  const domain = value?.trim().toLowerCase().replace(/\/+$/, '');
  return domain && /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(domain) ? domain : null;
}

export function shopifyWebhookTopic(value: string | null): ShopifyFinancialTopic {
  if (!value || !(SHOPIFY_FINANCIAL_TOPICS as readonly string[]).includes(value)) {
    throw new ShopifyError('INVALID_PAYLOAD', 'Unsupported Shopify webhook topic');
  }
  return value as ShopifyFinancialTopic;
}

export function shopifyWebhookDeliveryId(value: string | null): string {
  if (!value || value.length > 128 || !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value)) {
    throw new ShopifyError('INVALID_PAYLOAD', 'Invalid Shopify delivery ID');
  }
  return value;
}

export function webhookOrderId(topic: string, payload: unknown): string {
  if (!payload || typeof payload !== 'object') throw new ShopifyError('INVALID_PAYLOAD', 'Invalid Shopify webhook payload');
  const body = payload as Record<string, unknown>;
  const supportedTopic = shopifyWebhookTopic(topic);
  const gid = body.admin_graphql_api_id;
  if (supportedTopic !== 'refunds/create' && typeof gid === 'string' && /^gid:\/\/shopify\/Order\/\d+$/.test(gid)) return gid;
  const numeric = supportedTopic === 'refunds/create' ? body.order_id : body.id;
  if ((typeof numeric === 'number' && Number.isSafeInteger(numeric) && numeric > 0) || (typeof numeric === 'string' && /^\d+$/.test(numeric))) {
    return `gid://shopify/Order/${numeric}`;
  }
  throw new ShopifyError('INVALID_PAYLOAD', 'Shopify webhook has no valid Order identity');
}
