import 'server-only';
import { getShopifyAdminConfig, ShopifyError } from '@/lib/shopify/config';

type GraphQLError = { message?: string; extensions?: { code?: string } };

const MAX_ATTEMPTS = 3;
const BASE_RETRY_DELAY_MS = 100;
const MAX_RETRY_DELAY_MS = 2_000;
const RETRYABLE_HTTP_STATUSES = new Set([429, 500, 502, 503, 504]);

function retryDelayMs(response: Response | null, attempt: number): number {
  const fallback = Math.min(BASE_RETRY_DELAY_MS * (2 ** attempt), MAX_RETRY_DELAY_MS);
  const value = response?.headers.get('retry-after')?.trim();
  if (!value) return fallback;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(Math.round(seconds * 1_000), MAX_RETRY_DELAY_MS);
  const dateDelay = Date.parse(value) - Date.now();
  return Number.isFinite(dateDelay) ? Math.min(Math.max(dateDelay, 0), MAX_RETRY_DELAY_MS) : fallback;
}

async function waitBeforeRetry(response: Response | null, attempt: number): Promise<void> {
  const delay = retryDelayMs(response, attempt);
  if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
}

export async function shopifyGraphQL<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const config = getShopifyAdminConfig();
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
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
      if (attempt + 1 < MAX_ATTEMPTS) {
        await waitBeforeRetry(null, attempt);
        continue;
      }
      throw new ShopifyError('SHOPIFY_API', 'Shopify is temporarily unavailable');
    }
    if (response.status === 401 || response.status === 403) throw new ShopifyError('AUTHENTICATION', 'Shopify access was denied');
    if (RETRYABLE_HTTP_STATUSES.has(response.status)) {
      if (attempt + 1 < MAX_ATTEMPTS) {
        await waitBeforeRetry(response, attempt);
        continue;
      }
      throw new ShopifyError(response.status === 429 ? 'RATE_LIMIT' : 'SHOPIFY_API', response.status === 429 ? 'Shopify rate limit reached' : 'Shopify request failed');
    }
    if (!response.ok) throw new ShopifyError('SHOPIFY_API', 'Shopify request failed');
    let payload: { data?: T; errors?: GraphQLError[] };
    try {
      payload = await response.json();
    } catch {
      throw new ShopifyError('INVALID_PAYLOAD', 'Shopify returned invalid JSON');
    }
    if (payload.errors?.length) {
      const rateLimit = payload.errors.some((error) => error.extensions?.code === 'THROTTLED');
      if (rateLimit && attempt + 1 < MAX_ATTEMPTS) {
        await waitBeforeRetry(response, attempt);
        continue;
      }
      throw new ShopifyError(rateLimit ? 'RATE_LIMIT' : 'SHOPIFY_API', rateLimit ? 'Shopify rate limit reached' : 'Shopify query failed');
    }
    if (!payload.data) throw new ShopifyError('INVALID_PAYLOAD', 'Shopify response has no data');
    return payload.data;
  }
  throw new ShopifyError('SHOPIFY_API', 'Shopify request failed');
}

export function boundedPageSize(requested = 20, maximum = 100): number {
  if (!Number.isSafeInteger(requested) || requested < 1 || requested > maximum) {
    throw new ShopifyError('INVALID_PAYLOAD', `Page size must be between 1 and ${maximum}`);
  }
  return requested;
}
