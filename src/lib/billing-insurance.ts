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

interface MutableBillingCalculationTarget extends BillingCalculationInput {
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
  const result = calculateBillingAmounts(billing);
  billing.grossSubtotal = result.grossSubtotal;
  billing.coveredSubtotal = result.coveredSubtotal;
  billing.calculatedInsurancePaid = result.calculatedInsurancePaid;
  billing.effectiveInsurancePaid = result.effectiveInsurancePaid;
  billing.postInsuranceAmount = result.postInsuranceAmount;
  billing.vatAmount = result.vatAmount;
  billing.totalPatientPayable = result.totalPatientPayable;
  billing.balanceDue = result.balanceDue;
  billing.paymentStatus = result.paymentStatus;

  // Retained for compatibility with the initial Billing foundation.
  billing.subtotal = result.grossSubtotal;
  billing.insurancePaid = result.effectiveInsurancePaid;
  return result;
}
