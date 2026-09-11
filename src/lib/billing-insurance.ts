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
}

interface SettlementLineItem extends InsuranceLineItem {
  paymentStatus: "PENDING_PAYMENT" | "PAID";
  createdAt: Date;
}

interface PaymentTransactionAmount {
  amount: number;
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
  paymentStatus: "UNPAID" | "PARTIALLY_PAID" | "PAID";
}

interface MutableBillingCalculationTarget
  extends Omit<BillingCalculationInput, "lineItems" | "amountPaid"> {
  lineItems: SettlementLineItem[];
  paymentTransactions: PaymentTransactionAmount[];
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
  paymentStatus: "UNPAID" | "PARTIALLY_PAID" | "PAID";
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

  const settlementOrder = lineItems
    .map((item, index) => ({ item, index }))
    .sort(
      (left, right) =>
        (left.item.createdAt instanceof Date
          ? left.item.createdAt.getTime()
          : 0) -
          (right.item.createdAt instanceof Date
            ? right.item.createdAt.getTime()
            : 0) ||
        left.index - right.index,
    );
  let remainingInsurance = effectiveInsurancePaid;
  const basePayable = lineItems.map(() => 0);
  for (const { item, index } of settlementOrder) {
    assertVnd(item.amount, "Line item amount");
    if (!item.isCoveredByInsurance || remainingInsurance === 0) {
      basePayable[index] = item.amount;
      continue;
    }
    const allocatedInsurance = Math.min(item.amount, remainingInsurance);
    remainingInsurance -= allocatedInsurance;
    basePayable[index] = item.amount - allocatedInsurance;
  }
  if (remainingInsurance !== 0) {
    throw new BillingCalculationError(
      "Insurance payment could not be allocated to eligible line items",
    );
  }

  const orderedVatShares = proportionalShares(
    vatAmount,
    settlementOrder.map(({ index }) => basePayable[index]),
  );
  const vatShares = lineItems.map(() => 0);
  settlementOrder.forEach(({ index }, orderIndex) => {
    vatShares[index] = orderedVatShares[orderIndex];
  });
  let remainingPayment = amountPaid;
  settlementOrder.forEach(({ item, index }) => {
    const payableShare = basePayable[index] + vatShares[index];
    const allocatedPayment = Math.min(payableShare, remainingPayment);
    remainingPayment -= allocatedPayment;
    item.paymentStatus =
      allocatedPayment === payableShare ? "PAID" : "PENDING_PAYMENT";
  });
  if (remainingPayment !== 0) {
    throw new BillingCalculationError(
      "Patient payment could not be allocated to line items",
    );
  }
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

  const grossSubtotal = checkedSum(
    input.lineItems.map((item) => item.amount),
    "Gross subtotal",
  );
  const coveredSubtotal = checkedSum(
    input.lineItems
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
  if (input.amountPaid > totalPatientPayable) {
    throw new BillingCalculationError(
      "Total patient payable cannot be lower than the amount already paid",
    );
  }

  const balanceDue = totalPatientPayable - input.amountPaid;
  const paymentStatus =
    balanceDue === 0
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
  if (
    billing.paymentTransactions.length === 0 &&
    Number.isSafeInteger(billing.amountPaid) &&
    billing.amountPaid > 0
  ) {
    throw new BillingCalculationError(
      "Existing aggregate payment must be reconciled before ledger mutations",
    );
  }
  const amountPaid = checkedSum(
    billing.paymentTransactions.map((transaction) => transaction.amount),
    "Amount paid",
  );
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
  billing.paymentStatus = result.paymentStatus;
  allocateLineItemSettlement(
    billing.lineItems,
    result.effectiveInsurancePaid,
    result.vatAmount,
    amountPaid,
  );

  // Retained for compatibility with the initial Billing foundation.
  billing.subtotal = result.grossSubtotal;
  billing.insurancePaid = result.effectiveInsurancePaid;
  return result;
}
