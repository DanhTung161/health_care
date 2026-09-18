import 'server-only';
import ShopifyOrder from '@/models/ShopifyOrder';
import { ShopifyError } from '@/lib/shopify/config';

const MAX_ORDERS = 5_000;
type Cash = { grossCollected: number; refunded: number; netCollected: number };

function safeSigned(value: bigint): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new ShopifyError('DATA_INTEGRITY', 'Commerce cash flow exceeds safe integer range');
  }
  return Number(value);
}

export async function buildCommerceCashFlow(range: { from: Date; to: Date }) {
  const orders = await ShopifyOrder.find({
    isTest: false,
    transactions: { $elemMatch: { occurredAt: { $gte: range.from, $lt: range.to } } },
  }).select('currencyCode transactions isTest').limit(MAX_ORDERS + 1).lean();
  if (orders.length > MAX_ORDERS) throw new ShopifyError('DATA_INTEGRITY', 'Commerce reporting range exceeds 5000 Orders; request a smaller range');
  const sums = new Map<string, { gross: bigint; refunds: bigint }>();
  for (const order of orders) {
    const previous = sums.get(order.currencyCode) ?? { gross: BigInt(0), refunds: BigInt(0) };
    const seen = new Set<string>();
    for (const transaction of order.transactions) {
      if (seen.has(transaction.shopifyTransactionId)) throw new ShopifyError('DATA_INTEGRITY', 'Commerce projection has duplicate transactions');
      seen.add(transaction.shopifyTransactionId);
      if (transaction.occurredAt < range.from || transaction.occurredAt >= range.to) continue;
      if (!Number.isSafeInteger(transaction.amountMinor) || transaction.amountMinor < 0) throw new ShopifyError('DATA_INTEGRITY', 'Commerce projection has invalid money');
      if (transaction.kind === 'SALE' || transaction.kind === 'CAPTURE') previous.gross += BigInt(transaction.amountMinor);
      else if (transaction.kind === 'REFUND' || transaction.kind === 'CHANGE') previous.refunds += BigInt(transaction.amountMinor);
      else throw new ShopifyError('DATA_INTEGRITY', 'Commerce projection has an invalid transaction kind');
    }
    sums.set(order.currencyCode, previous);
  }
  const byCurrency: Record<string, Cash> = {};
  for (const [currency, values] of sums) {
    byCurrency[currency] = {
      grossCollected: safeSigned(values.gross),
      refunded: safeSigned(values.refunds),
      netCollected: safeSigned(values.gross - values.refunds),
    };
  }
  const mixedCurrency = Object.keys(byCurrency).some((code) => code !== 'VND');
  const vnd = byCurrency.VND ?? { grossCollected: 0, refunded: 0, netCollected: 0 };
  return {
    liveOnly: true, orderCount: orders.length, byCurrency,
    currencyCode: mixedCurrency ? 'MIXED' as const : 'VND' as const,
    grossCollected: mixedCurrency ? null : vnd.grossCollected,
    refunded: mixedCurrency ? null : vnd.refunded,
    netCollected: mixedCurrency ? null : vnd.netCollected,
  };
}

export function combineCashFlows(healthcare: Cash, commerce: Awaited<ReturnType<typeof buildCommerceCashFlow>>) {
  const otherCurrencies = Object.keys(commerce.byCurrency).filter((code) => code !== 'VND');
  if (otherCurrencies.length) return { status: 'MIXED_CURRENCY' as const, currencyCode: 'VND' as const, cashFlow: null };
  const vnd = commerce.byCurrency.VND ?? { grossCollected: 0, refunded: 0, netCollected: 0 };
  const grossCollected = safeSigned(BigInt(healthcare.grossCollected) + BigInt(vnd.grossCollected));
  const refunded = safeSigned(BigInt(healthcare.refunded) + BigInt(vnd.refunded));
  const netCollected = safeSigned(BigInt(grossCollected) - BigInt(refunded));
  return { status: 'AVAILABLE' as const, currencyCode: 'VND' as const, cashFlow: { grossCollected, refunded, netCollected } };
}
