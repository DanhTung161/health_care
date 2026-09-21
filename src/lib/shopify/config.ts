import 'server-only';

export const DEFAULT_SHOPIFY_API_VERSION = '2026-07';

export class ShopifyError extends Error {
  constructor(
    readonly code: 'NOT_CONFIGURED' | 'AUTHENTICATION' | 'INVALID_WEBHOOK' | 'SHOPIFY_API' | 'RATE_LIMIT' | 'INVALID_PAYLOAD' | 'STALE_EVENT' | 'DATA_INTEGRITY',
    message: string,
  ) {
    super(message);
    this.name = 'ShopifyError';
  }
}

export function getShopifyStatus(): 'NOT_CONFIGURED' | 'CONFIGURED' {
  try { getShopifyAdminConfig(); return 'CONFIGURED'; }
  catch { return 'NOT_CONFIGURED'; }
}

export function getShopifyAdminConfig() {
  const domain = process.env.SHOPIFY_SHOP_DOMAIN?.trim().toLowerCase().replace(/\/+$/, '');
  const token = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN?.trim();
  const version = process.env.SHOPIFY_API_VERSION?.trim() || DEFAULT_SHOPIFY_API_VERSION;
  if (!domain || !token) {
    throw new ShopifyError('NOT_CONFIGURED', 'Shopify Admin API is not configured');
  }
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(domain) || !/^20\d{2}-(01|04|07|10)$/.test(version)) {
    throw new ShopifyError('NOT_CONFIGURED', 'Shopify Admin API configuration is invalid');
  }
  return { domain, token, version };
}

export function getShopifyWebhookConfig() {
  const admin = getShopifyAdminConfig();
  const webhookSecret = process.env.SHOPIFY_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    throw new ShopifyError('NOT_CONFIGURED', 'Shopify webhook is not configured');
  }
  return { ...admin, webhookSecret };
}

export function isShopifyWebhookConfigured(): boolean {
  try { getShopifyWebhookConfig(); return true; }
  catch { return false; }
}
