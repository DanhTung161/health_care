import "server-only";

export const INSURANCE_PLANS = [
  "NONE",
  "BHYT_BASIC",
  "BHYT_HIGH",
  "PRIVATE_GOLD",
] as const;

export type InsurancePlan = (typeof INSURANCE_PLANS)[number];

export const INSURANCE_VERIFICATION_STATUSES = [
  "NONE",
  "PENDING",
  "VERIFIED",
  "REJECTED",
] as const;

export type InsuranceVerificationStatus =
  (typeof INSURANCE_VERIFICATION_STATUSES)[number];

export const PRIVATE_GOLD_APPOINTMENT_CAP_VND = 2_000_000;
export const BILLING_VAT_PERCENT = 8;

interface InsuranceLineItem {
  amount: number;
  isCoveredByInsurance: boolean;
  financialStatus?: "ACTIVE" | "VOID";
}

interface SettlementLineItem extends InsuranceLineItem {
  _id?: { toString(): string };
  paymentStatus: "PENDING_PAYMENT" | "PARTIALLY_PAID" | "PAID";
  createdAt: Date;
}

interface PaymentTransactionAmount {
  _id?: { toString(): string };
  amount: number;
}

interface PaymentAllocationAmount {
  _id?: { toString(): string };
  paymentTransactionId: { toString(): string };
  billingLineItemId: { toString(): string };
  allocatedAmount: number;
}

export interface BillingCalculationInput {
  lineItems: InsuranceLineItem[];
  insurancePlan: InsurancePlan;
  insuranceOverrideEnabled: boolean;
  insuranceOverrideAmount: number;
  amountPaid: number;
}

export interface BillingCalculationResult {
  grossSubtotal: number;
  coveredSubtotal: number;
  calculatedInsurancePaid: number;
  effectiveInsurancePaid: number;
  postInsuranceAmount: number;
  vatAmount: number;
  totalPatientPayable: number;
  balanceDue: number;
  refundDue: number;
  paymentStatus: "UNPAID" | "PARTIALLY_PAID" | "PAID";
}

interface MutableBillingCalculationTarget
  extends Omit<BillingCalculationInput, "lineItems" | "amountPaid"> {
  lineItems: SettlementLineItem[];
  paymentTransactions: PaymentTransactionAmount[];
  paymentAllocations?: PaymentAllocationAmount[];
  refundTransactions: PaymentTransactionAmount[];
  amountPaid: number;
  subtotal: number;
  insurancePaid: number;
  grossSubtotal: number;
  coveredSubtotal: number;
  calculatedInsurancePaid: number;
  effectiveInsurancePaid: number;
  postInsuranceAmount: number;
  vatAmount: number;
  totalPatientPayable: number;
  balanceDue: number;
  refundDue: number;
  paymentStatus: "UNPAID" | "PARTIALLY_PAID" | "PAID";
}

interface BillingAllocationTarget {
  lineItems: SettlementLineItem[];
  paymentTransactions: PaymentTransactionAmount[];
  paymentAllocations?: PaymentAllocationAmount[];
  refundTransactions: PaymentTransactionAmount[];
  effectiveInsurancePaid: number;
  vatAmount: number;
}

export class BillingCalculationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BillingCalculationError";
  }
}

function assertVnd(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new BillingCalculationError(
      `${label} must be a non-negative safe integer VND amount`,
    );
  }
}

// Percentages are rounded to the nearest whole VND. An exact half-VND rounds
// upward. Splitting quotient/remainder avoids an unsafe intermediate product.
function percentageOf(value: number, percent: number): number {
  assertVnd(value, "Percentage base");
  const quotient = Math.floor(value / 100);
  const remainder = value % 100;
  const result =
    quotient * percent + Math.floor((remainder * percent + 50) / 100);
  assertVnd(result, "Rounded percentage");
  return result;
}

function checkedSum(values: number[], label: string): number {
  let result = 0;
  for (const value of values) {
    assertVnd(value, label);
    result += value;
    assertVnd(result, label);
  }
  return result;
}

function proportionalShares(total: number, weights: number[]): number[] {
  assertVnd(total, "Allocation total");
  const weightTotal = checkedSum(weights, "Allocation weight");
  if (weightTotal === 0) return weights.map(() => 0);

  const denominator = BigInt(weightTotal);
  const exact = weights.map((weight, index) => {
    const product = BigInt(total) * BigInt(weight);
    return {
      index,
      amount: Number(product / denominator),
      remainder: product % denominator,
    };
  });
  const unallocated =
    total - exact.reduce((sum, share) => sum + share.amount, 0);
  const remainderOrder = [...exact].sort(
    (left, right) =>
      (left.remainder > right.remainder
        ? -1
        : left.remainder < right.remainder
          ? 1
          : 0) || left.index - right.index,
  );
  for (let index = 0; index < unallocated; index += 1) {
    remainderOrder[index].amount += 1;
  }
  return exact
    .sort((left, right) => left.index - right.index)
    .map(({ amount }) => amount);
}

export type BillingAllocationState = "DURABLE" | "LEGACY_UNALLOCATED";

export interface BillingLineSettlementSummary {
  billingLineItemId: string;
  patientPayableAmount: number;
  allocatedAmount: number | null;
  remainingPatientPayable: number | null;
  paymentStatus: "PENDING_PAYMENT" | "PARTIALLY_PAID" | "PAID";
}

export interface PlannedPaymentAllocation {
  billingLineItemId: string;
  allocatedAmount: number;
}

interface LinePatientLiability {
  item: SettlementLineItem;
  id: string;
  patientPayableAmount: number;
}

function settlementOrder(lineItems: SettlementLineItem[]) {
  return lineItems
    .map((item, originalIndex) => ({
      item,
      originalIndex,
      id: item._id?.toString() ?? `legacy-index-${originalIndex}`,
    }))
    .filter(({ item }) => item.financialStatus !== "VOID")
    .sort(
      (left, right) =>
        (left.item.createdAt instanceof Date
          ? left.item.createdAt.getTime()
          : 0) -
          (right.item.createdAt instanceof Date
            ? right.item.createdAt.getTime()
            : 0) || left.id.localeCompare(right.id),
    );
}

// Patient liability preserves the existing invoice calculation exactly:
// insurance is applied oldest eligible line first, then the already-calculated
// invoice VAT is distributed by largest remainder across post-insurance bases.
// Stable createdAt/_id ordering resolves every remainder tie deterministically.
function calculateLinePatientLiabilities(
  lineItems: SettlementLineItem[],
  effectiveInsurancePaid: number,
  vatAmount: number,
): LinePatientLiability[] {
  assertVnd(effectiveInsurancePaid, "Effective insurance payment");
  assertVnd(vatAmount, "VAT amount");

  const ordered = settlementOrder(lineItems);
  let remainingInsurance = effectiveInsurancePaid;
  const basePayable = ordered.map(({ item }) => {
    assertVnd(item.amount, "Line item amount");
    if (!item.isCoveredByInsurance || remainingInsurance === 0) {
      return item.amount;
    }
    const allocatedInsurance = Math.min(item.amount, remainingInsurance);
    remainingInsurance -= allocatedInsurance;
    return item.amount - allocatedInsurance;
  });
  if (remainingInsurance !== 0) {
    throw new BillingCalculationError(
      "Insurance payment could not be allocated to eligible line items",
    );
  }

  const vatShares = proportionalShares(vatAmount, basePayable);
  const liabilities = ordered.map(({ item, id }, index) => ({
    item,
    id,
    patientPayableAmount: basePayable[index] + vatShares[index],
  }));
  const expectedPatientLiability =
    checkedSum(
      ordered.map(({ item }) => item.amount),
      "Active line total",
    ) -
    effectiveInsurancePaid +
    vatAmount;
  assertVnd(expectedPatientLiability, "Expected patient liability");
  if (
    checkedSum(
      liabilities.map(({ patientPayableAmount }) => patientPayableAmount),
      "Line patient liability",
    ) !== expectedPatientLiability
  ) {
    throw new BillingCalculationError(
      "Line patient liabilities do not preserve the invoice patient total",
    );
  }
  return liabilities;
}

function applyLegacyLineItemSettlement(
  lineItems: SettlementLineItem[],
  liabilities: LinePatientLiability[],
  amountPaid: number,
): void {
  let remainingPayment = amountPaid;
  for (const { item, patientPayableAmount } of liabilities) {
    const allocatedPayment = Math.min(patientPayableAmount, remainingPayment);
    remainingPayment -= allocatedPayment;
    item.paymentStatus =
      allocatedPayment === patientPayableAmount
        ? "PAID"
        : allocatedPayment > 0
          ? "PARTIALLY_PAID"
          : "PENDING_PAYMENT";
  }
  for (const item of lineItems) {
    if (item.financialStatus === "VOID") {
      item.paymentStatus = "PENDING_PAYMENT";
    }
  }
  if (remainingPayment !== 0) {
    throw new BillingCalculationError(
      "Patient payment could not be allocated to line items",
    );
  }
}

function durableLineSettlement(
  billing: BillingAllocationTarget,
  liabilities: LinePatientLiability[],
): BillingLineSettlementSummary[] {
  const allocations = billing.paymentAllocations;
  if (!Array.isArray(allocations)) {
    throw new BillingCalculationError(
      "Billing does not contain durable payment allocations",
    );
  }
  if (billing.refundTransactions.length > 0) {
    throw new BillingCalculationError(
      "Refund allocation is required before an allocation-managed Billing can be recalculated",
    );
  }

  const transactionAmounts = new Map<string, number>();
  for (const transaction of billing.paymentTransactions) {
    const id = transaction._id?.toString();
    if (!id) {
      throw new BillingCalculationError(
        "A payment transaction is missing durable identity",
      );
    }
    if (transactionAmounts.has(id)) {
      throw new BillingCalculationError("Duplicate payment transaction identity");
    }
    assertVnd(transaction.amount, "Payment amount");
    transactionAmounts.set(id, transaction.amount);
  }

  const liabilityByLine = new Map(
    liabilities.map((liability) => [liability.id, liability]),
  );
  if (
    liabilities.some(({ item }) => !item._id) ||
    liabilityByLine.size !== liabilities.length
  ) {
    throw new BillingCalculationError(
      "Durable allocation requires unique Billing line identities",
    );
  }
  const allocatedByPayment = new Map<string, number>();
  const allocatedByLine = new Map<string, number>();
  const allocationIdentities = new Set<string>();
  const allocationIds = new Set<string>();

  for (const allocation of allocations) {
    const allocationId = allocation._id?.toString();
    const paymentId = allocation.paymentTransactionId?.toString();
    const lineId = allocation.billingLineItemId?.toString();
    if (!allocationId || !paymentId || !lineId) {
      throw new BillingCalculationError(
        "A payment allocation is missing durable identity",
      );
    }
    if (allocationIds.has(allocationId)) {
      throw new BillingCalculationError("Duplicate payment allocation identity");
    }
    allocationIds.add(allocationId);
    const pairIdentity = `${paymentId}:${lineId}`;
    if (allocationIdentities.has(pairIdentity)) {
      throw new BillingCalculationError(
        "A payment has duplicate allocations to the same Billing line",
      );
    }
    allocationIdentities.add(pairIdentity);
    if (!transactionAmounts.has(paymentId)) {
      throw new BillingCalculationError(
        "A payment allocation references a payment outside this Billing",
      );
    }
    if (!liabilityByLine.has(lineId)) {
      throw new BillingCalculationError(
        "A payment allocation references a missing or VOID Billing line",
      );
    }
    if (!Number.isSafeInteger(allocation.allocatedAmount) || allocation.allocatedAmount <= 0) {
      throw new BillingCalculationError(
        "Payment allocation must be a positive safe integer VND amount",
      );
    }
    allocatedByPayment.set(
      paymentId,
      checkedSum(
        [allocatedByPayment.get(paymentId) ?? 0, allocation.allocatedAmount],
        "Payment allocation total",
      ),
    );
    allocatedByLine.set(
      lineId,
      checkedSum(
        [allocatedByLine.get(lineId) ?? 0, allocation.allocatedAmount],
        "Line allocation total",
      ),
    );
  }

  for (const [paymentId, paymentAmount] of transactionAmounts) {
    if ((allocatedByPayment.get(paymentId) ?? 0) !== paymentAmount) {
      throw new BillingCalculationError(
        "Payment allocation total must equal its payment transaction amount",
      );
    }
  }

  const summaries = liabilities.map(({ item, id, patientPayableAmount }) => {
    const allocatedAmount = allocatedByLine.get(id) ?? 0;
    if (allocatedAmount > patientPayableAmount) {
      throw new BillingCalculationError(
        "Billing line allocation exceeds its patient-payable amount",
      );
    }
    const remainingPatientPayable = patientPayableAmount - allocatedAmount;
    const paymentStatus =
      remainingPatientPayable === 0
        ? "PAID"
        : allocatedAmount > 0
          ? "PARTIALLY_PAID"
          : "PENDING_PAYMENT";
    item.paymentStatus = paymentStatus;
    return {
      billingLineItemId: id,
      patientPayableAmount,
      allocatedAmount,
      remainingPatientPayable,
      paymentStatus,
    } satisfies BillingLineSettlementSummary;
  });

  for (const item of billing.lineItems) {
    if (item.financialStatus === "VOID") {
      item.paymentStatus = "PENDING_PAYMENT";
    }
  }

  const allocatedTotal = checkedSum(
    allocations.map(({ allocatedAmount }) => allocatedAmount),
    "Invoice allocation total",
  );
  const paymentTotal = checkedSum(
    billing.paymentTransactions.map(({ amount }) => amount),
    "Payment transaction total",
  );
  if (allocatedTotal !== paymentTotal) {
    throw new BillingCalculationError(
      "Invoice allocation total must equal collected payment transactions",
    );
  }
  return summaries;
}

export function getBillingAllocationState(
  billing: Pick<BillingAllocationTarget, "paymentAllocations">,
): BillingAllocationState {
  return Array.isArray(billing.paymentAllocations)
    ? "DURABLE"
    : "LEGACY_UNALLOCATED";
}

export function initializeDurablePaymentAllocations(
  billing: MutableBillingCalculationTarget,
): void {
  if (Array.isArray(billing.paymentAllocations)) return;
  if (
    billing.paymentTransactions.length > 0 ||
    billing.refundTransactions.length > 0 ||
    billing.amountPaid > 0
  ) {
    throw new BillingCalculationError(
      "Legacy Billing with financial history requires explicit allocation reconciliation",
    );
  }
  billing.paymentAllocations = [];
}

export function getBillingLineSettlementSummaries(
  billing: BillingAllocationTarget,
): BillingLineSettlementSummary[] {
  const liabilities = calculateLinePatientLiabilities(
    billing.lineItems,
    billing.effectiveInsurancePaid,
    billing.vatAmount,
  );
  if (!Array.isArray(billing.paymentAllocations)) {
    return liabilities.map(({ item, id, patientPayableAmount }) => ({
      billingLineItemId: id,
      patientPayableAmount,
      allocatedAmount: null,
      remainingPatientPayable: null,
      paymentStatus: item.paymentStatus,
    }));
  }
  return durableLineSettlement(billing, liabilities);
}

export function planOldestFirstPaymentAllocations(
  billing: BillingAllocationTarget,
  amount: number,
): PlannedPaymentAllocation[] {
  if (!Array.isArray(billing.paymentAllocations)) {
    throw new BillingCalculationError(
      "Durable payment allocation must be initialized before collecting payment",
    );
  }
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new BillingCalculationError(
      "Payment allocation amount must be a positive safe integer VND amount",
    );
  }
  const summaries = getBillingLineSettlementSummaries(billing);
  let remaining = amount;
  const planned: PlannedPaymentAllocation[] = [];
  for (const summary of summaries) {
    const lineRemaining = summary.remainingPatientPayable ?? 0;
    const allocatedAmount = Math.min(lineRemaining, remaining);
    if (allocatedAmount > 0) {
      planned.push({
        billingLineItemId: summary.billingLineItemId,
        allocatedAmount,
      });
      remaining -= allocatedAmount;
    }
    if (remaining === 0) break;
  }
  if (remaining !== 0) {
    throw new BillingCalculationError(
      "Payment could not be allocated within remaining patient liability",
    );
  }
  return planned;
}

export function getAllocatedAmountForBillingLine(
  billing: Pick<BillingAllocationTarget, "paymentAllocations">,
  billingLineItemId: string,
): number | null {
  if (!Array.isArray(billing.paymentAllocations)) return null;
  return checkedSum(
    billing.paymentAllocations
      .filter(
        (allocation) =>
          allocation.billingLineItemId.toString() === billingLineItemId,
      )
      .map(({ allocatedAmount }) => allocatedAmount),
    "Line allocation total",
  );
}

// Insurance is allocated to the oldest eligible line items first. The invoice
// VAT is then distributed proportionally across each item's remaining base
// payable amount, using largest-remainder rounding with oldest-item tie breaks.
// Patient payments settle those resulting payable shares oldest first.
export function allocateLineItemSettlement(
  lineItems: SettlementLineItem[],
  effectiveInsurancePaid: number,
  vatAmount: number,
  amountPaid: number,
): void {
  assertVnd(effectiveInsurancePaid, "Effective insurance payment");
  assertVnd(vatAmount, "VAT amount");
  assertVnd(amountPaid, "Amount paid");

  const liabilities = calculateLinePatientLiabilities(
    lineItems,
    effectiveInsurancePaid,
    vatAmount,
  );
  applyLegacyLineItemSettlement(lineItems, liabilities, amountPaid);
}

function automaticInsurancePayment(
  plan: InsurancePlan,
  coveredSubtotal: number,
): number {
  switch (plan) {
    case "NONE":
      return 0;
    case "BHYT_BASIC":
      return percentageOf(coveredSubtotal, 80);
    case "BHYT_HIGH":
      return percentageOf(coveredSubtotal, 40);
    case "PRIVATE_GOLD":
      return Math.min(coveredSubtotal, PRIVATE_GOLD_APPOINTMENT_CAP_VND);
  }
}

function maximumEffectiveInsurancePayment(
  plan: InsurancePlan,
  coveredSubtotal: number,
): number {
  if (plan === "NONE") return 0;
  if (plan === "PRIVATE_GOLD") {
    return Math.min(coveredSubtotal, PRIVATE_GOLD_APPOINTMENT_CAP_VND);
  }
  return coveredSubtotal;
}

export function calculateBillingAmounts(
  input: BillingCalculationInput,
): BillingCalculationResult {
  assertVnd(input.insuranceOverrideAmount, "Insurance override amount");
  assertVnd(input.amountPaid, "Amount paid");

  const activeLineItems = input.lineItems.filter(
    (item) => item.financialStatus !== "VOID",
  );
  const grossSubtotal = checkedSum(
    activeLineItems.map((item) => item.amount),
    "Gross subtotal",
  );
  const coveredSubtotal = checkedSum(
    activeLineItems
      .filter((item) => item.isCoveredByInsurance)
      .map((item) => item.amount),
    "Covered subtotal",
  );
  const calculatedInsurancePaid = automaticInsurancePayment(
    input.insurancePlan,
    coveredSubtotal,
  );
  const effectiveInsurancePaid = input.insuranceOverrideEnabled
    ? input.insuranceOverrideAmount
    : calculatedInsurancePaid;
  const maximumInsurancePaid = maximumEffectiveInsurancePayment(
    input.insurancePlan,
    coveredSubtotal,
  );

  if (effectiveInsurancePaid > maximumInsurancePaid) {
    throw new BillingCalculationError(
      "Effective insurance payment exceeds the eligible cost or plan cap",
    );
  }

  const postInsuranceAmount = grossSubtotal - effectiveInsurancePaid;
  assertVnd(postInsuranceAmount, "Post-insurance amount");
  const vatAmount = percentageOf(postInsuranceAmount, BILLING_VAT_PERCENT);
  const totalPatientPayable = checkedSum(
    [postInsuranceAmount, vatAmount],
    "Total patient payable",
  );
  const difference = input.amountPaid - totalPatientPayable;
  const balanceDue = difference < 0 ? -difference : 0;
  const refundDue = difference > 0 ? difference : 0;
  const paymentStatus =
    input.amountPaid >= totalPatientPayable
      ? "PAID"
      : input.amountPaid > 0
        ? "PARTIALLY_PAID"
        : "UNPAID";

  return {
    grossSubtotal,
    coveredSubtotal,
    calculatedInsurancePaid,
    effectiveInsurancePaid,
    postInsuranceAmount,
    vatAmount,
    totalPatientPayable,
    balanceDue,
    refundDue,
    paymentStatus,
  };
}

export function recalculateBilling(
  billing: MutableBillingCalculationTarget,
): BillingCalculationResult {
  // Defaults keep Billing documents created before insurance/payment support
  // compatible when they are first recalculated.
  billing.insurancePlan = INSURANCE_PLANS.includes(billing.insurancePlan)
    ? billing.insurancePlan
    : "NONE";
  billing.insuranceOverrideEnabled = billing.insuranceOverrideEnabled === true;
  billing.insuranceOverrideAmount = Number.isSafeInteger(
    billing.insuranceOverrideAmount,
  )
    ? billing.insuranceOverrideAmount
    : 0;
  billing.paymentTransactions = Array.isArray(billing.paymentTransactions)
    ? billing.paymentTransactions
    : [];
  billing.refundTransactions = Array.isArray(billing.refundTransactions)
    ? billing.refundTransactions
    : [];
  if (
    billing.paymentTransactions.length === 0 &&
    Number.isSafeInteger(billing.amountPaid) &&
    billing.amountPaid > 0
  ) {
    throw new BillingCalculationError(
      "Existing aggregate payment must be reconciled before ledger mutations",
    );
  }
  const grossCollected = checkedSum(
    billing.paymentTransactions.map((transaction) => transaction.amount),
    "Gross collected",
  );
  const refunds = checkedSum(
    billing.refundTransactions.map((transaction) => transaction.amount),
    "Refunds",
  );
  if (refunds > grossCollected) {
    throw new BillingCalculationError("Refunds cannot exceed gross collections");
  }
  const amountPaid = grossCollected - refunds;
  billing.amountPaid = amountPaid;
  const result = calculateBillingAmounts({
    lineItems: billing.lineItems,
    insurancePlan: billing.insurancePlan,
    insuranceOverrideEnabled: billing.insuranceOverrideEnabled,
    insuranceOverrideAmount: billing.insuranceOverrideAmount,
    amountPaid,
  });
  billing.grossSubtotal = result.grossSubtotal;
  billing.coveredSubtotal = result.coveredSubtotal;
  billing.calculatedInsurancePaid = result.calculatedInsurancePaid;
  billing.effectiveInsurancePaid = result.effectiveInsurancePaid;
  billing.postInsuranceAmount = result.postInsuranceAmount;
  billing.vatAmount = result.vatAmount;
  billing.totalPatientPayable = result.totalPatientPayable;
  billing.balanceDue = result.balanceDue;
  billing.refundDue = result.refundDue;
  billing.paymentStatus = result.paymentStatus;
  const liabilities = calculateLinePatientLiabilities(
    billing.lineItems,
    result.effectiveInsurancePaid,
    result.vatAmount,
  );
  if (Array.isArray(billing.paymentAllocations)) {
    durableLineSettlement(billing, liabilities);
  } else {
    applyLegacyLineItemSettlement(
      billing.lineItems,
      liabilities,
      Math.min(amountPaid, result.totalPatientPayable),
    );
  }

  // Retained for compatibility with the initial Billing foundation.
  billing.subtotal = result.grossSubtotal;
  billing.insurancePaid = result.effectiveInsurancePaid;
  return result;
}
