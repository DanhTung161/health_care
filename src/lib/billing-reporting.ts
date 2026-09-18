import "server-only";

import {
  calculateBillingAmounts,
  getBillingAllocationState,
  getBillingLineSettlementSummaries,
} from "@/lib/billing-insurance";
import Billing, {
  BILLING_PAYMENT_METHODS,
  BILLING_PAYMENT_TYPES,
  type BillingPaymentMethod,
  type BillingPaymentType,
  type IBilling,
} from "@/models/Billing";
import Charge from "@/models/Charge";

const MAX_REPORT_DAYS = 31;
const MAX_INVOICES = 5_000;

export class BillingReportingError extends Error {
  constructor(message: string, readonly status: 400 | 409 | 413 = 409) {
    super(message);
    this.name = "BillingReportingError";
  }
}

export function parseReportingRange(params: URLSearchParams) {
  const fromText = params.get("from");
  const toText = params.get("to");
  const explicitZone = /^(\d{4})-(\d{2})-(\d{2})T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/;
  if (!fromText || !toText || !explicitZone.test(fromText) || !explicitZone.test(toText)) {
    throw new BillingReportingError("from and to must be ISO timestamps with Z or a numeric timezone offset", 400);
  }
  for (const value of [fromText, toText]) {
    const [, year, month, day] = explicitZone.exec(value)!;
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    if (date.toISOString().slice(0, 10) !== `${year}-${month}-${day}`) {
      throw new BillingReportingError("Reporting dates must be valid calendar dates", 400);
    }
  }
  const from = new Date(fromText);
  const to = new Date(toText);
  if (
    !Number.isFinite(from.getTime()) ||
    !Number.isFinite(to.getTime()) ||
    to <= from ||
    to.getTime() - from.getTime() > MAX_REPORT_DAYS * 86_400_000
  ) {
    throw new BillingReportingError("Reporting range must be valid, nonempty, and no longer than 31 days", 400);
  }
  return { from, to };
}

function vnd(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new BillingReportingError(`${label} is not a non-negative safe integer VND amount`);
  }
  return value;
}

function add(left: number, right: number, label: string): number {
  return vnd(vnd(left, label) + vnd(right, label), label);
}

type CashRow = {
  _id: { method: string; type?: string };
  amount: number;
  minimumAmount: number;
  count: number;
};

export function summarizeCashRows(paymentRows: CashRow[], refundRows: CashRow[]) {
  const paymentsByMethod = Object.fromEntries(BILLING_PAYMENT_METHODS.map((method) => [method, 0])) as Record<BillingPaymentMethod, number>;
  const paymentsByType = Object.fromEntries(BILLING_PAYMENT_TYPES.map((type) => [type, 0])) as Record<BillingPaymentType, number>;
  const refundsByMethod = Object.fromEntries(BILLING_PAYMENT_METHODS.map((method) => [method, 0])) as Record<BillingPaymentMethod, number>;
  let grossCollected = 0;
  let refunded = 0;

  for (const row of paymentRows) {
    const { method, type } = row._id;
    if (!BILLING_PAYMENT_METHODS.includes(method as BillingPaymentMethod) || !BILLING_PAYMENT_TYPES.includes(type as BillingPaymentType) || !Number.isSafeInteger(row.minimumAmount) || row.minimumAmount <= 0) {
      throw new BillingReportingError("Payment history contains an invalid method, type, or amount");
    }
    const amount = vnd(row.amount, "Gross collection");
    grossCollected = add(grossCollected, amount, "Gross collection");
    paymentsByMethod[method as BillingPaymentMethod] = add(paymentsByMethod[method as BillingPaymentMethod], amount, "Payment method total");
    paymentsByType[type as BillingPaymentType] = add(paymentsByType[type as BillingPaymentType], amount, "Payment type total");
  }
  for (const row of refundRows) {
    const { method } = row._id;
    if (!BILLING_PAYMENT_METHODS.includes(method as BillingPaymentMethod) || !Number.isSafeInteger(row.minimumAmount) || row.minimumAmount <= 0) {
      throw new BillingReportingError("Refund history contains an invalid method or amount");
    }
    const amount = vnd(row.amount, "Refund total");
    refunded = add(refunded, amount, "Refund total");
    refundsByMethod[method as BillingPaymentMethod] = add(refundsByMethod[method as BillingPaymentMethod], amount, "Refund method total");
  }
  if (
    Object.values(paymentsByMethod).reduce((sum, amount) => add(sum, amount, "Payment method conservation"), 0) !== grossCollected ||
    Object.values(paymentsByType).reduce((sum, amount) => add(sum, amount, "Payment type conservation"), 0) !== grossCollected ||
    Object.values(refundsByMethod).reduce((sum, amount) => add(sum, amount, "Refund method conservation"), 0) !== refunded
  ) {
    throw new BillingReportingError("Cash-flow breakdown does not conserve transaction totals");
  }
  const netCollected = grossCollected - refunded;
  if (!Number.isSafeInteger(netCollected)) throw new BillingReportingError("Net collection exceeds safe VND range");
  return { grossCollected, refunded, netCollected, paymentsByMethod, paymentsByType, refundsByMethod };
}

export function summarizeInvoice(billing: IBilling) {
  const gross = billing.paymentTransactions.reduce((sum, transaction) => add(sum, vnd(transaction.amount, "Payment amount"), "Invoice payments"), 0);
  const refunds = billing.refundTransactions.reduce((sum, transaction) => add(sum, vnd(transaction.amount, "Refund amount"), "Invoice refunds"), 0);
  if (refunds > gross) throw new BillingReportingError("Invoice Refunds exceed Payments");
  const calculated = calculateBillingAmounts({
    lineItems: billing.lineItems,
    insurancePlan: billing.insurancePlan,
    insuranceOverrideEnabled: billing.insuranceOverrideEnabled,
    insuranceOverrideAmount: billing.insuranceOverrideAmount,
    amountPaid: gross - refunds,
  });
  if (
    billing.totalPatientPayable !== calculated.totalPatientPayable ||
    billing.effectiveInsurancePaid !== calculated.effectiveInsurancePaid ||
    billing.vatAmount !== calculated.vatAmount ||
    billing.amountPaid !== gross - refunds
  ) {
    throw new BillingReportingError("Persisted invoice totals disagree with historical line and transaction data");
  }
  const durable = getBillingAllocationState(billing) === "DURABLE";
  if (durable) {
    const lines = getBillingLineSettlementSummaries(billing);
    const outstanding = lines.reduce((sum, line) => add(sum, line.remainingPatientPayable ?? 0, "Outstanding liability"), 0);
    if (outstanding !== calculated.balanceDue) throw new BillingReportingError("Durable line settlement disagrees with invoice balance");
    return { billed: calculated.totalPatientPayable, outstanding, refundDue: calculated.refundDue, durable, ambiguous: false };
  }
  if ((billing.refundAllocationReversals?.length ?? 0) > 0) {
    throw new BillingReportingError("Legacy invoice contains unexplained Refund reversals");
  }
  const ambiguous = gross > 0 || refunds > 0;
  return { billed: calculated.totalPatientPayable, outstanding: ambiguous ? null : calculated.totalPatientPayable, refundDue: calculated.refundDue, durable, ambiguous };
}

export async function buildBillingReport(range: { from: Date; to: Date }) {
  const paymentRows = await Billing.aggregate<CashRow>([
    { $match: { paymentTransactions: { $elemMatch: { collectedAt: { $gte: range.from, $lt: range.to } } } } },
    { $unwind: "$paymentTransactions" },
    { $match: { "paymentTransactions.collectedAt": { $gte: range.from, $lt: range.to } } },
    { $group: { _id: { method: "$paymentTransactions.method", type: "$paymentTransactions.type" }, amount: { $sum: "$paymentTransactions.amount" }, minimumAmount: { $min: "$paymentTransactions.amount" }, count: { $sum: 1 } } },
  ]);
  const refundRows = await Billing.aggregate<CashRow>([
    { $match: { refundTransactions: { $elemMatch: { processedAt: { $gte: range.from, $lt: range.to } } } } },
    { $unwind: "$refundTransactions" },
    { $match: { "refundTransactions.processedAt": { $gte: range.from, $lt: range.to } } },
    { $group: { _id: { method: "$refundTransactions.method" }, amount: { $sum: "$refundTransactions.amount" }, minimumAmount: { $min: "$refundTransactions.amount" }, count: { $sum: 1 } } },
  ]);
  const cashFlow = summarizeCashRows(paymentRows, refundRows);
  const invoices = await Billing.find({ createdAt: { $gte: range.from, $lt: range.to } })
    .select("createdAt billingStatus lineItems paymentTransactions paymentAllocations refundTransactions refundAllocationReversals insurancePlan insuranceOverrideEnabled insuranceOverrideAmount effectiveInsurancePaid vatAmount totalPatientPayable amountPaid")
    .limit(MAX_INVOICES + 1);
  if (invoices.length > MAX_INVOICES) throw new BillingReportingError("Reporting period exceeds the 5000-invoice processing limit; request a smaller range", 413);

  let billedPatientAmount = 0;
  let knownOutstanding = 0;
  let refundDue = 0;
  let openInvoiceCount = 0;
  let closedInvoiceCount = 0;
  let durableInvoiceCount = 0;
  let legacyInvoiceCount = 0;
  let ambiguousInvoiceCount = 0;
  let ambiguousOpenInvoiceCount = 0;
  for (const invoice of invoices) {
    const item = summarizeInvoice(invoice);
    billedPatientAmount = add(billedPatientAmount, item.billed, "Billed patient amount");
    refundDue = add(refundDue, item.refundDue, "Refund due");
    if (item.durable) durableInvoiceCount += 1;
    else legacyInvoiceCount += 1;
    if (item.ambiguous) ambiguousInvoiceCount += 1;
    if (invoice.billingStatus === "OPEN") {
      openInvoiceCount += 1;
      if (item.ambiguous) ambiguousOpenInvoiceCount += 1;
      if (item.outstanding !== null) knownOutstanding = add(knownOutstanding, item.outstanding, "Outstanding patient liability");
    } else if (invoice.billingStatus === "CLOSED") closedInvoiceCount += 1;
    else throw new BillingReportingError("Invoice has an invalid lifecycle state");
  }
  const chargeRows = invoices.length ? await Charge.aggregate<{ _id: null; count: number; amount: number; minimumAmount: number }>([
    { $match: { billingId: { $in: invoices.map((invoice) => invoice._id) }, status: "RECONCILIATION_REQUIRED" } },
    { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: "$amount" }, minimumAmount: { $min: "$amount" } } },
  ]) : [];
  const chargeRow = chargeRows[0];
  if (chargeRow && (!Number.isSafeInteger(chargeRow.minimumAmount) || chargeRow.minimumAmount < 0)) throw new BillingReportingError("Reconciliation Charge has an invalid historical amount");
  return {
    period: { from: range.from.toISOString(), to: range.to.toISOString(), interval: "[from,to)" as const },
    cashFlow,
    billing: { billedPatientAmount, outstandingPatientLiability: ambiguousOpenInvoiceCount ? null : knownOutstanding, knownOutstandingPatientLiability: knownOutstanding, refundDue, invoiceCount: invoices.length, openInvoiceCount, closedInvoiceCount },
    reconciliation: { requiredCount: chargeRow?.count ?? 0, historicalChargeAmount: vnd(chargeRow?.amount ?? 0, "Reconciliation exposure") },
    dataQuality: { durableInvoiceCount, legacyInvoiceCount, ambiguousInvoiceCount, ambiguousOpenInvoiceCount },
  };
}
