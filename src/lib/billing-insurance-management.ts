import "server-only";

import mongoose from "mongoose";
import { prepareBillingPersistence } from "@/lib/billing";
import {
  BillingCalculationError,
  INSURANCE_PLANS,
  INSURANCE_VERIFICATION_STATUSES,
  recalculateBilling,
  type InsurancePlan,
  type InsuranceVerificationStatus,
} from "@/lib/billing-insurance";
import Billing, { type IBilling } from "@/models/Billing";

export interface InsuranceUpdateInput {
  insurancePlan: InsurancePlan;
  insuranceOverrideEnabled: boolean;
  insuranceOverrideAmount: number;
  insuranceVerificationStatus: InsuranceVerificationStatus;
  insuranceNote?: string;
}

export class BillingInsuranceError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409,
  ) {
    super(message);
    this.name = "BillingInsuranceError";
  }
}

function isInsurancePlan(value: unknown): value is InsurancePlan {
  return (
    typeof value === "string" &&
    INSURANCE_PLANS.includes(value as InsurancePlan)
  );
}

function isVerificationStatus(
  value: unknown,
): value is InsuranceVerificationStatus {
  return (
    typeof value === "string" &&
    INSURANCE_VERIFICATION_STATUSES.includes(
      value as InsuranceVerificationStatus,
    )
  );
}

export function parseInsuranceUpdate(
  value: unknown,
): { data: InsuranceUpdateInput } | { error: BillingInsuranceError } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { error: new BillingInsuranceError("Invalid request body", 400) };
  }

  const body = value as Record<string, unknown>;
  const allowedFields = new Set([
    "insurancePlan",
    "insuranceOverrideEnabled",
    "insuranceOverrideAmount",
    "insuranceVerificationStatus",
    "insuranceNote",
  ]);
  if (Object.keys(body).some((key) => !allowedFields.has(key))) {
    return {
      error: new BillingInsuranceError(
        "Calculated totals and audit fields cannot be supplied by the client",
        400,
      ),
    };
  }

  if (!isInsurancePlan(body.insurancePlan)) {
    return { error: new BillingInsuranceError("Invalid insurance plan", 400) };
  }
  if (typeof body.insuranceOverrideEnabled !== "boolean") {
    return {
      error: new BillingInsuranceError(
        "Insurance override enabled must be a boolean",
        400,
      ),
    };
  }
  const overrideAmount =
    body.insuranceOverrideAmount === undefined &&
    body.insuranceOverrideEnabled === false
      ? 0
      : body.insuranceOverrideAmount;
  if (
    !Number.isSafeInteger(overrideAmount) ||
    (overrideAmount as number) < 0
  ) {
    return {
      error: new BillingInsuranceError(
        "Insurance override amount must be a non-negative integer VND amount",
        400,
      ),
    };
  }
  if (!isVerificationStatus(body.insuranceVerificationStatus)) {
    return {
      error: new BillingInsuranceError(
        "Invalid insurance verification status",
        400,
      ),
    };
  }

  const insuranceNote =
    typeof body.insuranceNote === "string" ? body.insuranceNote.trim() : "";
  if (body.insuranceNote !== undefined && typeof body.insuranceNote !== "string") {
    return {
      error: new BillingInsuranceError("Insurance note must be text", 400),
    };
  }
  if (insuranceNote.length > 1_000) {
    return {
      error: new BillingInsuranceError(
        "Insurance note must be 1000 characters or fewer",
        400,
      ),
    };
  }

  return {
    data: {
      insurancePlan: body.insurancePlan,
      insuranceOverrideEnabled: body.insuranceOverrideEnabled,
      insuranceOverrideAmount: body.insuranceOverrideEnabled
        ? (overrideAmount as number)
        : 0,
      insuranceVerificationStatus: body.insuranceVerificationStatus,
      ...(insuranceNote ? { insuranceNote } : {}),
    },
  };
}

export interface InsuranceUpdateResult {
  appointmentId: string;
  insurancePlan: InsurancePlan;
  grossSubtotal: number;
  coveredSubtotal: number;
  calculatedInsurancePaid: number;
  insuranceOverrideEnabled: boolean;
  insuranceOverrideAmount: number;
  effectiveInsurancePaid: number;
  postInsuranceAmount: number;
  vatAmount: number;
  totalPatientPayable: number;
  amountPaid: number;
  balanceDue: number;
  paymentStatus: IBilling["paymentStatus"];
  insuranceVerificationStatus: InsuranceVerificationStatus;
  insuranceNote?: string;
  verifiedBy?: string;
  verifiedAt?: Date;
}

function resultFor(billing: IBilling): InsuranceUpdateResult {
  return {
    appointmentId: billing.appointmentId.toString(),
    insurancePlan: billing.insurancePlan,
    grossSubtotal: billing.grossSubtotal,
    coveredSubtotal: billing.coveredSubtotal,
    calculatedInsurancePaid: billing.calculatedInsurancePaid,
    insuranceOverrideEnabled: billing.insuranceOverrideEnabled,
    insuranceOverrideAmount: billing.insuranceOverrideAmount,
    effectiveInsurancePaid: billing.effectiveInsurancePaid,
    postInsuranceAmount: billing.postInsuranceAmount,
    vatAmount: billing.vatAmount,
    totalPatientPayable: billing.totalPatientPayable,
    amountPaid: billing.amountPaid,
    balanceDue: billing.balanceDue,
    paymentStatus: billing.paymentStatus,
    insuranceVerificationStatus: billing.insuranceVerificationStatus,
    ...(billing.insuranceNote ? { insuranceNote: billing.insuranceNote } : {}),
    ...(billing.verifiedBy
      ? { verifiedBy: billing.verifiedBy.toString() }
      : {}),
    ...(billing.verifiedAt ? { verifiedAt: billing.verifiedAt } : {}),
  };
}

export async function updateBillingInsurance(
  appointmentIdValue: string,
  actorIdValue: string,
  input: InsuranceUpdateInput,
): Promise<InsuranceUpdateResult> {
  if (!mongoose.isValidObjectId(appointmentIdValue)) {
    throw new BillingInsuranceError("Invalid appointment id", 400);
  }
  if (!mongoose.isValidObjectId(actorIdValue)) {
    throw new BillingInsuranceError("Invalid authenticated user id", 400);
  }

  await prepareBillingPersistence();
  const appointmentId = new mongoose.Types.ObjectId(appointmentIdValue);
  const actorId = new mongoose.Types.ObjectId(actorIdValue);
  const session = await mongoose.startSession();

  try {
    const result = await session.withTransaction(async () => {
      const billing = await Billing.findOne({ appointmentId }).session(session);
      if (!billing) {
        throw new BillingInsuranceError(
          "Billing has not been initialized for this appointment",
          404,
        );
      }
      if (billing.billingStatus === "CLOSED") {
        throw new BillingInsuranceError(
          "Closed invoices are financially immutable",
          409,
        );
      }

      billing.insurancePlan = input.insurancePlan;
      billing.insuranceOverrideEnabled = input.insuranceOverrideEnabled;
      billing.insuranceOverrideAmount = input.insuranceOverrideAmount;
      billing.insuranceVerificationStatus =
        input.insuranceVerificationStatus;
      billing.insuranceNote = input.insuranceNote;

      if (input.insuranceVerificationStatus === "VERIFIED") {
        billing.verifiedBy = actorId;
        billing.verifiedAt = new Date();
      } else {
        billing.verifiedBy = undefined;
        billing.verifiedAt = undefined;
      }

      try {
        recalculateBilling(billing);
      } catch (error) {
        if (error instanceof BillingCalculationError) {
          throw new BillingInsuranceError(error.message, 409);
        }
        throw error;
      }

      billing.updatedBy = actorId;
      await billing.save({ session });
      return resultFor(billing);
    });

    if (!result) {
      throw new Error("Insurance transaction did not return a result");
    }
    return result;
  } finally {
    await session.endSession();
  }
}
