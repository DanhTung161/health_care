import 'server-only';
import { getShopifyAdminConfig, ShopifyError } from '@/lib/shopify/config';

type GraphQLError = { message?: string; extensions?: { code?: string } };

export async function shopifyGraphQL<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const config = getShopifyAdminConfig();
  let response: Response;
  try {
    response = await fetch(`https://${config.domain}/admin/api/${config.version}/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': config.token,
      },
      body: JSON.stringify({ query, variables }),
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new ShopifyError('SHOPIFY_API', 'Shopify is temporarily unavailable');
  }
  if (response.status === 401 || response.status === 403) throw new ShopifyError('AUTHENTICATION', 'Shopify access was denied');
  if (response.status === 429) throw new ShopifyError('RATE_LIMIT', 'Shopify rate limit reached');
  if (!response.ok) throw new ShopifyError('SHOPIFY_API', 'Shopify request failed');
  let payload: { data?: T; errors?: GraphQLError[] };
  try {
    payload = await response.json();
  } catch {
    throw new ShopifyError('INVALID_PAYLOAD', 'Shopify returned invalid JSON');
  }
  if (payload.errors?.length) {
    const rateLimit = payload.errors.some((error) => error.extensions?.code === 'THROTTLED');
    throw new ShopifyError(rateLimit ? 'RATE_LIMIT' : 'SHOPIFY_API', rateLimit ? 'Shopify rate limit reached' : 'Shopify query failed');
  }
  if (!payload.data) throw new ShopifyError('INVALID_PAYLOAD', 'Shopify response has no data');
  return payload.data;
}

export function boundedPageSize(requested = 20, maximum = 100): number {
  if (!Number.isSafeInteger(requested) || requested < 1 || requested > maximum) {
    throw new ShopifyError('INVALID_PAYLOAD', `Page size must be between 1 and ${maximum}`);
  }
  return requested;
}
