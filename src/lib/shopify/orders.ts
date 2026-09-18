import 'server-only';
import { boundedPageSize, shopifyGraphQL } from '@/lib/shopify/client';
import { getShopifyAdminConfig, ShopifyError } from '@/lib/shopify/config';
import { safeMoneySum, toMinorUnits } from '@/lib/shopify/money';
import connectDB from '@/lib/db';
import ShopifyOrder, { type ShopifyFinancialTransaction } from '@/models/ShopifyOrder';

type FinancialSnapshot = {
  currencyCode: string; financialStatus: string | null; orderTotalMinor: number;
  grossCollectedMinor: number; refundedMinor: number; netCollectedMinor: number;
  isTest: boolean; transactions: ShopifyFinancialTransaction[];
};

function financialSnapshotKey(snapshot: FinancialSnapshot): string {
  const transactions = snapshot.transactions.map((transaction) => [
    transaction.shopifyTransactionId, transaction.kind, transaction.amountMinor,
    new Date(transaction.occurredAt).toISOString(),
  ]).sort((left, right) => String(left[0]).localeCompare(String(right[0])));
  return JSON.stringify({
    currencyCode: snapshot.currencyCode, financialStatus: snapshot.financialStatus,
    orderTotalMinor: snapshot.orderTotalMinor, grossCollectedMinor: snapshot.grossCollectedMinor,
    refundedMinor: snapshot.refundedMinor, netCollectedMinor: snapshot.netCollectedMinor,
    isTest: snapshot.isTest, transactions,
  });
}

type Money = { amount: string; currencyCode: string };
type RawTransaction = {
  id: string; kind: string; status: string; test: boolean;
  createdAt: string; processedAt: string | null;
  amountSet: { shopMoney: Money };
};
type RawOrder = {
  id: string; name: string; currencyCode: string; displayFinancialStatus: string | null;
  totalPriceSet: { shopMoney: Money }; transactionsCount: { count: number };
  transactions: RawTransaction[]; test: boolean;
  processedAt: string | null; createdAt: string; updatedAt: string;
};
const ORDER_FIELDS = `id name currencyCode displayFinancialStatus test processedAt createdAt updatedAt
  totalPriceSet { shopMoney { amount currencyCode } }
  transactionsCount { count }
  transactions(first: 250) { id kind status test createdAt processedAt amountSet { shopMoney { amount currencyCode } } }`;

function validDate(value: string | null): Date {
  const date = new Date(value ?? '');
  if (!Number.isFinite(date.getTime())) throw new ShopifyError('DATA_INTEGRITY', 'Shopify returned an invalid financial date');
  return date;
}
export function normalizeOrder(raw: RawOrder, shopDomain: string) {
  if (!/^gid:\/\/shopify\/Order\/\d+$/.test(raw.id) || raw.transactionsCount.count > raw.transactions.length || raw.transactions.length > 250) {
    throw new ShopifyError('DATA_INTEGRITY', 'Shopify Order identity or transaction history is incomplete');
  }
  const currencyCode = raw.currencyCode;
  if (raw.totalPriceSet.shopMoney.currencyCode !== currencyCode) throw new ShopifyError('DATA_INTEGRITY', 'Shopify Order currency disagrees with shop money');
  const seen = new Set<string>();
  const transactions: ShopifyFinancialTransaction[] = [];
  for (const transaction of raw.transactions) {
    if (seen.has(transaction.id)) throw new ShopifyError('DATA_INTEGRITY', 'Shopify returned a duplicate transaction ID');
    seen.add(transaction.id);
    if (transaction.status !== 'SUCCESS') continue;
    if (['AUTHORIZATION', 'EMV_AUTHORIZATION', 'SUGGESTED_REFUND', 'VOID'].includes(transaction.kind)) continue;
    if (!['SALE', 'CAPTURE', 'REFUND', 'CHANGE'].includes(transaction.kind)) {
      throw new ShopifyError('DATA_INTEGRITY', 'Shopify returned an unsupported financial transaction kind');
    }
    if (transaction.amountSet.shopMoney.currencyCode !== currencyCode) throw new ShopifyError('DATA_INTEGRITY', 'Shopify transaction currency disagrees with Order currency');
    transactions.push({
      shopifyTransactionId: transaction.id,
      kind: transaction.kind as ShopifyFinancialTransaction['kind'],
      amountMinor: toMinorUnits(transaction.amountSet.shopMoney.amount, currencyCode),
      occurredAt: validDate(transaction.processedAt ?? transaction.createdAt),
    });
  }
  const grossCollectedMinor = safeMoneySum(transactions.filter((item) => item.kind === 'SALE' || item.kind === 'CAPTURE').map((item) => item.amountMinor));
  const refundedMinor = safeMoneySum(transactions.filter((item) => item.kind === 'REFUND' || item.kind === 'CHANGE').map((item) => item.amountMinor));
  const netCollectedMinor = grossCollectedMinor - refundedMinor;
  if (!Number.isSafeInteger(netCollectedMinor)) throw new ShopifyError('DATA_INTEGRITY', 'Shopify net cash is outside the safe integer range');
  return {
    shopDomain, shopifyOrderId: raw.id, shopifyOrderName: raw.name,
    currencyCode, financialStatus: raw.displayFinancialStatus,
    orderTotalMinor: toMinorUnits(raw.totalPriceSet.shopMoney.amount, currencyCode),
    grossCollectedMinor, refundedMinor, netCollectedMinor,
    isTest: raw.test || raw.transactions.some((transaction) => transaction.test),
    processedAt: raw.processedAt ? validDate(raw.processedAt) : undefined,
    createdAtShopify: validDate(raw.createdAt), sourceUpdatedAt: validDate(raw.updatedAt),
    lastSyncedAt: new Date(), transactions,
  };
}

export async function fetchShopifyOrder(id: string): Promise<RawOrder> {
  if (!/^gid:\/\/shopify\/Order\/\d+$/.test(id)) throw new ShopifyError('INVALID_PAYLOAD', 'Invalid Shopify Order ID');
  const data = await shopifyGraphQL<{ order: RawOrder | null }>(
    `query FinancialOrder($id: ID!) { order(id: $id) { ${ORDER_FIELDS} } }`, { id },
  );
  if (!data.order) throw new ShopifyError('INVALID_PAYLOAD', 'Shopify Order was not found');
  return data.order;
}

export async function synchronizeShopifyOrder(id: string, deliveryId?: string): Promise<'CREATED' | 'UPDATED' | 'UNCHANGED'> {
  const config = getShopifyAdminConfig();
  const normalized = normalizeOrder(await fetchShopifyOrder(id), config.domain);
  if (deliveryId !== undefined && (deliveryId.length < 1 || deliveryId.length > 128)) throw new ShopifyError('INVALID_PAYLOAD', 'Invalid Shopify delivery ID');
  await connectDB();
  await ShopifyOrder.init();
  const identity = { shopDomain: config.domain, shopifyOrderId: id };
  const existing = await ShopifyOrder.findOne(identity).select('sourceUpdatedAt currencyCode financialStatus orderTotalMinor grossCollectedMinor refundedMinor netCollectedMinor isTest transactions');
  if (existing && existing.sourceUpdatedAt > normalized.sourceUpdatedAt) return 'UNCHANGED';
  if (existing && existing.sourceUpdatedAt.getTime() === normalized.sourceUpdatedAt.getTime()) {
    if (financialSnapshotKey(existing) === financialSnapshotKey(normalized)) return 'UNCHANGED';
    throw new ShopifyError('DATA_INTEGRITY', 'Shopify financial state differs at the same source update time');
  }
  try {
    const result = await ShopifyOrder.updateOne(
      { ...identity, $or: [{ sourceUpdatedAt: { $lt: normalized.sourceUpdatedAt } }, { sourceUpdatedAt: { $exists: false } }] },
      { $set: { ...normalized, ...(deliveryId ? { lastWebhookId: deliveryId } : {}) } }, { upsert: true, runValidators: true },
    );
    if (result.upsertedCount) return 'CREATED';
    return result.modifiedCount ? 'UPDATED' : 'UNCHANGED';
  } catch (error) {
    // A concurrent newer sync won the unique identity race. It is safe only if it is as new.
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
      const winner = await ShopifyOrder.findOne(identity).select('sourceUpdatedAt currencyCode financialStatus orderTotalMinor grossCollectedMinor refundedMinor netCollectedMinor isTest transactions');
      if (winner && winner.sourceUpdatedAt > normalized.sourceUpdatedAt) return 'UNCHANGED';
      if (winner && winner.sourceUpdatedAt.getTime() === normalized.sourceUpdatedAt.getTime()) {
        if (financialSnapshotKey(winner) === financialSnapshotKey(normalized)) return 'UNCHANGED';
        throw new ShopifyError('DATA_INTEGRITY', 'Shopify financial state differs at the same source update time');
      }
    }
    throw error;
  }
}

export async function reconcileShopifyOrders(range: { from: Date; to: Date }, maxPages = 5, startAfter: string | null = null) {
  getShopifyAdminConfig();
  if (!Number.isFinite(range.from.getTime()) || !Number.isFinite(range.to.getTime()) || range.from >= range.to || range.to.getTime() - range.from.getTime() > 31 * 86_400_000 || !Number.isSafeInteger(maxPages) || maxPages < 1 || maxPages > 10) {
    throw new ShopifyError('INVALID_PAYLOAD', 'Reconciliation requires a valid range of at most 31 days and 1-10 pages');
  }
  if (startAfter !== null && (typeof startAfter !== 'string' || startAfter.length < 1 || startAfter.length > 1_000)) throw new ShopifyError('INVALID_PAYLOAD', 'Invalid reconciliation cursor');
  const first = boundedPageSize(50);
  let after: string | null = startAfter;
  let created = 0; let updated = 0; let unchanged = 0; let errors = 0; let scanned = 0;
  for (let page = 0; page < maxPages; page += 1) {
    const search = `updated_at:>='${range.from.toISOString()}' updated_at:<'${range.to.toISOString()}'`;
    const data: { orders: { edges: { node: { id: string } }[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } } } = await shopifyGraphQL(
      `query UpdatedOrders($first: Int!, $after: String, $search: String!) { orders(first: $first, after: $after, query: $search, sortKey: UPDATED_AT) { edges { node { id } } pageInfo { hasNextPage endCursor } } }`,
      { first, after, search },
    );
    for (const edge of data.orders.edges) {
      scanned += 1;
      try {
        const result = await synchronizeShopifyOrder(edge.node.id);
        if (result === 'CREATED') created += 1;
        else if (result === 'UPDATED') updated += 1;
        else unchanged += 1;
      } catch { errors += 1; }
    }
    if (!data.orders.pageInfo.hasNextPage) return { scanned, created, updated, unchanged, errors, complete: errors === 0, nextCursor: null };
    after = data.orders.pageInfo.endCursor;
    if (!after) throw new ShopifyError('INVALID_PAYLOAD', 'Shopify pagination cursor is missing');
  }
  return { scanned, created, updated, unchanged, errors, complete: false, nextCursor: after };
}
