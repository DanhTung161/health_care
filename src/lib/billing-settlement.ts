import "server-only";

import mongoose, { type ClientSession } from "mongoose";
import { prepareBillingPersistence } from "@/lib/billing";
import {
  BillingCalculationError,
  recalculateBilling,
} from "@/lib/billing-insurance";
import Appointment from "@/models/Appointment";
import Billing, {
  BILLING_PAYMENT_METHODS,
  type BillingPaymentMethod,
  type IBilling,
  type IBillingRefundTransaction,
} from "@/models/Billing";

export interface RefundInput {
  amount: number;
  method: BillingPaymentMethod;
  reason: string;
}

export class BillingSettlementError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409,
  ) {
    super(message);
    this.name = "BillingSettlementError";
  }
}

function objectId(value: string, label: string): mongoose.Types.ObjectId {
  if (!mongoose.isValidObjectId(value)) {
    throw new BillingSettlementError(`Invalid ${label}`, 400);
  }
  return new mongoose.Types.ObjectId(value);
}

export function parseRefundInput(
  value: unknown,
): { data: RefundInput } | { error: BillingSettlementError } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { error: new BillingSettlementError("Invalid request body", 400) };
  }
  const body = value as Record<string, unknown>;
  const allowed = new Set(["amount", "method", "reason"]);
  if (Object.keys(body).some((key) => !allowed.has(key))) {
    return {
      error: new BillingSettlementError(
        "Refund totals and audit fields cannot be supplied by the client",
        400,
      ),
    };
  }
  if (!Number.isSafeInteger(body.amount) || (body.amount as number) <= 0) {
    return {
      error: new BillingSettlementError(
        "Refund amount must be a positive integer VND amount",
        400,
      ),
    };
  }
  if (
    typeof body.method !== "string" ||
    !BILLING_PAYMENT_METHODS.includes(body.method as BillingPaymentMethod)
  ) {
    return { error: new BillingSettlementError("Invalid refund method", 400) };
  }
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!reason || reason.length > 500) {
    return {
      error: new BillingSettlementError(
        "Refund reason is required and must be 500 characters or fewer",
        400,
      ),
    };
  }
  return {
    data: {
      amount: body.amount as number,
      method: body.method as BillingPaymentMethod,
      reason,
    },
  };
}

export function parseSettlementIdempotencyKey(value: string | null): string {
  const key = value?.trim() ?? "";
  if (!/^[A-Za-z0-9._:-]{8,128}$/.test(key)) {
    throw new BillingSettlementError(
      "A valid Idempotency-Key header is required",
      400,
    );
  }
  return key;
}

function recalculate(billing: IBilling): void {
  try {
    recalculateBilling(billing);
  } catch (error) {
    if (error instanceof BillingCalculationError) {
      throw new BillingSettlementError(error.message, 409);
    }
    throw error;
  }
}

async function loadCompletedBilling(
  appointmentId: mongoose.Types.ObjectId,
  session: ClientSession,
): Promise<IBilling> {
  const appointment = await Appointment.findById(appointmentId)
    .select("status")
    .session(session);
  if (!appointment) {
    throw new BillingSettlementError("Appointment not found", 404);
  }
  if (appointment.status !== "COMPLETED") {
    throw new BillingSettlementError(
      "Billing settlement requires a completed appointment",
      409,
    );
  }
  const billing = await Billing.findOne({ appointmentId }).session(session);
  if (!billing) {
    throw new BillingSettlementError("Billing not found", 404);
  }
  return billing;
}

function refundMatches(
  transaction: IBillingRefundTransaction,
  input: RefundInput,
): boolean {
  return (
    transaction.amount === input.amount &&
    transaction.method === input.method &&
    transaction.reason === input.reason
  );
}

function refundResult(
  billing: IBilling,
  transaction: IBillingRefundTransaction,
  replayed: boolean,
) {
  return {
    replayed,
    transaction: {
      id: transaction._id.toString(),
      amount: transaction.amount,
      method: transaction.method,
      reason: transaction.reason,
      processedBy: transaction.processedBy.toString(),
      processedAt: transaction.processedAt,
    },
    amountPaid: billing.amountPaid,
    balanceDue: billing.balanceDue,
    refundDue: billing.refundDue,
    paymentStatus: billing.paymentStatus,
    billingStatus: billing.billingStatus,
  };
}

function existingRefund(
  billing: IBilling,
  idempotencyKey: string,
  input: RefundInput,
) {
  const transaction = billing.refundTransactions.find(
    (item) => item.idempotencyKey === idempotencyKey,
  );
  if (!transaction) return null;
  if (!refundMatches(transaction, input)) {
    throw new BillingSettlementError(
      "The Idempotency-Key was already used for a different refund",
      409,
    );
  }
  return refundResult(billing, transaction, true);
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === 11000
  );
}

export async function processBillingRefund(
  appointmentIdValue: string,
  actorIdValue: string,
  idempotencyKey: string,
  input: RefundInput,
) {
  const appointmentId = objectId(appointmentIdValue, "appointment id");
  const actorId = objectId(actorIdValue, "authenticated user id");
  await prepareBillingPersistence();
  const session = await mongoose.startSession();

  try {
    const result = await session.withTransaction(async () => {
      const billing = await loadCompletedBilling(appointmentId, session);
      const replay = existingRefund(billing, idempotencyKey, input);
      if (replay) return replay;
      if (billing.billingStatus === "CLOSED") {
        throw new BillingSettlementError(
          "Closed invoices are financially immutable",
          409,
        );
      }
      recalculate(billing);
      if (billing.refundDue === 0) {
        throw new BillingSettlementError("This invoice has no refund due", 409);
      }
      if (input.amount > billing.refundDue) {
        throw new BillingSettlementError(
          "Refund amount exceeds the unresolved refund amount",
          409,
        );
      }

      const transactionId = new mongoose.Types.ObjectId();
      billing.refundTransactions.push({
        _id: transactionId,
        idempotencyKey,
        ...input,
        processedBy: actorId,
        processedAt: new Date(),
      });
      recalculate(billing);
      billing.updatedBy = actorId;
      await billing.save({ session });
      const transaction = billing.refundTransactions.find(
        (item) => item._id.toString() === transactionId.toString(),
      );
      if (!transaction) throw new Error("Saved refund transaction was not found");
      return refundResult(billing, transaction, false);
    });
    if (!result) throw new Error("Refund transaction did not return a result");
    return result;
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      const billing = await Billing.findOne({
        "refundTransactions.idempotencyKey": idempotencyKey,
      });
      if (billing && billing.appointmentId.toString() === appointmentIdValue) {
        const replay = existingRefund(billing, idempotencyKey, input);
        if (replay) return replay;
      }
      throw new BillingSettlementError(
        "The Idempotency-Key was already used for another refund",
        409,
      );
    }
    throw error;
  } finally {
    await session.endSession();
  }
}

export async function closeBilling(
  appointmentIdValue: string,
  actorIdValue: string,
) {
  const appointmentId = objectId(appointmentIdValue, "appointment id");
  const actorId = objectId(actorIdValue, "authenticated user id");
  await prepareBillingPersistence();
  const session = await mongoose.startSession();

  try {
    const result = await session.withTransaction(async () => {
      const billing = await loadCompletedBilling(appointmentId, session);
      recalculate(billing);
      if (billing.billingStatus === "CLOSED") {
        return {
          billingStatus: billing.billingStatus,
          closedAt: billing.closedAt,
          closedBy: billing.closedBy?.toString(),
          replayed: true,
        };
      }
      if (billing.balanceDue > 0) {
        throw new BillingSettlementError(
          `Invoice has ${billing.balanceDue} VND remaining to collect`,
          409,
        );
      }
      if (billing.refundDue > 0) {
        throw new BillingSettlementError(
          `Invoice has ${billing.refundDue} VND requiring refund`,
          409,
        );
      }
      const now = new Date();
      billing.billingStatus = "CLOSED";
      billing.closedAt = now;
      billing.closedBy = actorId;
      billing.updatedBy = actorId;
      await billing.save({ session });
      return {
        billingStatus: billing.billingStatus,
        closedAt: now,
        closedBy: actorId.toString(),
        replayed: false,
      };
    });
    if (!result) throw new Error("Billing close did not return a result");
    return result;
  } finally {
    await session.endSession();
  }
}
