import { ShopifyError } from '@/lib/shopify/config';

export function currencyMinorDigits(currencyCode: string): number {
  if (!/^[A-Z]{3}$/.test(currencyCode)) throw new ShopifyError('DATA_INTEGRITY', 'Invalid Shopify currency code');
  try {
    const digits = new Intl.NumberFormat('en', { style: 'currency', currency: currencyCode }).resolvedOptions().maximumFractionDigits;
    if (digits === undefined) throw new Error('Missing currency precision');
    return digits;
  } catch {
    throw new ShopifyError('DATA_INTEGRITY', 'Unsupported Shopify currency code');
  }
}

export function toMinorUnits(amount: string, currencyCode: string): number {
  const digits = currencyMinorDigits(currencyCode);
  if (!/^\d+(?:\.\d+)?$/.test(amount)) throw new ShopifyError('DATA_INTEGRITY', 'Invalid Shopify money value');
  const [whole, fraction = ''] = amount.split('.');
  if (fraction.length > digits && /[1-9]/.test(fraction.slice(digits))) {
    throw new ShopifyError('DATA_INTEGRITY', 'Shopify money has sub-minor-unit precision');
  }
  const minor = BigInt(whole) * (BigInt(10) ** BigInt(digits)) + BigInt((fraction.slice(0, digits) || '').padEnd(digits, '0') || '0');
  if (minor > BigInt(Number.MAX_SAFE_INTEGER)) throw new ShopifyError('DATA_INTEGRITY', 'Shopify money exceeds safe integer range');
  return Number(minor);
}

export function safeMoneySum(values: number[]): number {
  const total = values.reduce((sum, value) => {
    if (!Number.isSafeInteger(value) || value < 0) throw new ShopifyError('DATA_INTEGRITY', 'Invalid Shopify minor-unit amount');
    return sum + BigInt(value);
  }, BigInt(0));
  if (total > BigInt(Number.MAX_SAFE_INTEGER)) throw new ShopifyError('DATA_INTEGRITY', 'Shopify money total exceeds safe integer range');
  return Number(total);
}
