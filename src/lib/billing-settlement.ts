import "server-only";

import mongoose, { type ClientSession } from "mongoose";
import { COMPLETED_APPOINTMENT_STATUS } from "@/lib/appointment-status";
import { prepareBillingPersistence } from "@/lib/billing";
import {
  BillingChargeError,
  validateBillingChargeInvariants,
} from "@/lib/billing-charges";
import {
  BillingCalculationError,
  getEffectiveAllocatedAmountForBillingLine,
  getBillingAllocationState,
  planNewestFirstRefundReversals,
  recalculateBilling,
} from "@/lib/billing-insurance";
import Appointment from "@/models/Appointment";
import Billing, {
  BILLING_PAYMENT_METHODS,
  type BillingPaymentMethod,
  type IBilling,
  type IBillingRefundAllocationReversal,
  type IBillingRefundTransaction,
} from "@/models/Billing";
import Charge from "@/models/Charge";

export interface RefundInput {
  amount: number;
  method: BillingPaymentMethod;
  reason: string;
}

export interface ChargeReconciliationInput {
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

export function parseChargeReconciliationInput(
  value: unknown,
): { data: ChargeReconciliationInput } | { error: BillingSettlementError } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { error: new BillingSettlementError("Invalid request body", 400) };
  }
  const body = value as Record<string, unknown>;
  if (Object.keys(body).some((key) => !["method", "reason"].includes(key))) {
    return {
      error: new BillingSettlementError(
        "Reconciliation amount, statuses, and audit fields are server-derived",
        400,
      ),
    };
  }
  const parsed = parseRefundInput({ ...body, amount: 1 });
  if ("error" in parsed) return parsed;
  return { data: { method: parsed.data.method, reason: parsed.data.reason } };
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

async function validateInvoiceChargeIntegrity(
  billing: IBilling,
  session: ClientSession,
) {
  try {
    return await validateBillingChargeInvariants(billing, session);
  } catch (error) {
    if (error instanceof BillingChargeError) {
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
  if (appointment.status !== COMPLETED_APPOINTMENT_STATUS) {
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
  input: ChargeReconciliationInput & { amount?: number },
  reconciledChargeId?: string,
): boolean {
  return (
    (input.amount === undefined || transaction.amount === input.amount) &&
    transaction.method === input.method &&
    transaction.reason === input.reason &&
    (transaction.reconciledChargeId?.toString() ?? undefined) ===
      reconciledChargeId
  );
}

function refundResult(
  billing: IBilling,
  transaction: IBillingRefundTransaction,
  replayed: boolean,
) {
  const reversals = billing.refundAllocationReversals?.filter(
    ({ refundTransactionId }) =>
      refundTransactionId.toString() === transaction._id.toString(),
  ) ?? [];
  return {
    replayed,
    transaction: {
      id: transaction._id.toString(),
      amount: transaction.amount,
      method: transaction.method,
      reason: transaction.reason,
      reconciledChargeId: transaction.reconciledChargeId?.toString() ?? null,
      processedBy: transaction.processedBy.toString(),
      processedAt: transaction.processedAt,
    },
    reversals: reversals.map((reversal) => ({
      id: reversal._id.toString(),
      paymentAllocationId: reversal.paymentAllocationId.toString(),
      reversedAmount: reversal.reversedAmount,
      reversedAt: reversal.reversedAt,
    })),
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
  input: ChargeReconciliationInput & { amount?: number },
  reconciledChargeId?: string,
) {
  const transaction = billing.refundTransactions.find(
    (item) => item.idempotencyKey === idempotencyKey,
  );
  if (!transaction) return null;
  if (!refundMatches(transaction, input, reconciledChargeId)) {
    throw new BillingSettlementError(
      "The Idempotency-Key was already used for a different refund",
      409,
    );
  }
  return refundResult(billing, transaction, true);
}

function planRefund(
  billing: IBilling,
  amount: number,
  lineItemId?: string,
) {
  try {
    return planNewestFirstRefundReversals(billing, amount, lineItemId);
  } catch (error) {
    if (error instanceof BillingCalculationError) {
      throw new BillingSettlementError(error.message, 409);
    }
    throw error;
  }
}

function appendRefundWithReversals(
  billing: IBilling,
  actorId: mongoose.Types.ObjectId,
  idempotencyKey: string,
  input: RefundInput,
  lineItemId?: string,
  reconciledChargeId?: mongoose.Types.ObjectId,
): mongoose.Types.ObjectId {
  if (input.amount > billing.amountPaid) {
    throw new BillingSettlementError(
      "Refund amount exceeds effective collected Payment",
      409,
    );
  }
  const plan = planRefund(billing, input.amount, lineItemId);
  const transactionId = new mongoose.Types.ObjectId();
  const now = new Date();
  billing.refundTransactions.push({
    _id: transactionId,
    idempotencyKey,
    ...input,
    ...(reconciledChargeId ? { reconciledChargeId } : {}),
    processedBy: actorId,
    processedAt: now,
  });
  billing.refundAllocationReversals ??= [];
  billing.refundAllocationReversals.push(
    ...plan.map(
      ({ paymentAllocationId, reversedAmount }) =>
        ({
          _id: new mongoose.Types.ObjectId(),
          refundTransactionId: transactionId,
          paymentAllocationId: new mongoose.Types.ObjectId(
            paymentAllocationId,
          ),
          reversedAmount,
          reversedAt: now,
        }) satisfies IBillingRefundAllocationReversal,
    ),
  );
  return transactionId;
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
      let transactionId: mongoose.Types.ObjectId;
      if (getBillingAllocationState(billing) === "DURABLE") {
        const chargeLinks = await validateInvoiceChargeIntegrity(
          billing,
          session,
        );
        if (
          chargeLinks.some(
            ({ charge }) => charge.status === "RECONCILIATION_REQUIRED",
          )
        ) {
          throw new BillingSettlementError(
            "A diagnostic Charge requires explicit reconciliation before a generic Refund",
            409,
          );
        }
        transactionId = appendRefundWithReversals(
          billing,
          actorId,
          idempotencyKey,
          input,
        );
      } else {
        if (billing.refundDue === 0 || input.amount > billing.refundDue) {
          throw new BillingSettlementError(
            "Refund amount exceeds the unresolved legacy refund amount",
            409,
          );
        }
        transactionId = new mongoose.Types.ObjectId();
        billing.refundTransactions.push({
          _id: transactionId,
          idempotencyKey,
          ...input,
          processedBy: actorId,
          processedAt: new Date(),
        });
      }
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

export async function reconcileDiagnosticChargeRefund(
  appointmentIdValue: string,
  chargeIdValue: string,
  actorIdValue: string,
  idempotencyKey: string,
  input: ChargeReconciliationInput,
) {
  const appointmentId = objectId(appointmentIdValue, "appointment id");
  const chargeId = objectId(chargeIdValue, "Charge id");
  const actorId = objectId(actorIdValue, "authenticated user id");
  await Promise.all([prepareBillingPersistence(), Charge.init()]);
  const session = await mongoose.startSession();

  try {
    const result = await session.withTransaction(async () => {
      const billing = await loadCompletedBilling(appointmentId, session);
      const replay = existingRefund(
        billing,
        idempotencyKey,
        input,
        chargeId.toString(),
      );
      if (replay) return replay;
      if (billing.billingStatus === "CLOSED") {
        throw new BillingSettlementError(
          "Closed invoices are financially immutable",
          409,
        );
      }
      if (getBillingAllocationState(billing) !== "DURABLE") {
        throw new BillingSettlementError(
          "Legacy Billing requires explicit financial migration before Charge reconciliation",
          409,
        );
      }
      const links = await validateInvoiceChargeIntegrity(billing, session);
      const link = links.find(({ charge }) => charge._id.equals(chargeId));
      if (!link || link.charge.status !== "RECONCILIATION_REQUIRED") {
        throw new BillingSettlementError(
          "Charge is not awaiting reconciliation on this invoice",
          409,
        );
      }
      recalculate(billing);
      let amount: number;
      try {
        amount = getEffectiveAllocatedAmountForBillingLine(
          billing,
          link.lineItem._id.toString(),
        );
      } catch (error) {
        if (error instanceof BillingCalculationError) {
          throw new BillingSettlementError(error.message, 409);
        }
        throw error;
      }
      if (amount === 0) {
        throw new BillingSettlementError(
          "This Charge has no effective Payment to refund; started or unpaid work requires separate financial review",
          409,
        );
      }
      const transactionId = appendRefundWithReversals(
        billing,
        actorId,
        idempotencyKey,
        { ...input, amount },
        link.lineItem._id.toString(),
        chargeId,
      );
      recalculate(billing);
      if (
        getEffectiveAllocatedAmountForBillingLine(
          billing,
          link.lineItem._id.toString(),
        ) !== 0
      ) {
        throw new BillingSettlementError(
          "Charge allocation was not fully reversed",
          409,
        );
      }
      const now = new Date();
      const updatedCharge = await Charge.findOneAndUpdate(
        { _id: chargeId, billingId: billing._id, status: "RECONCILIATION_REQUIRED" },
        {
          $set: {
            status: "VOID",
            voidedBy: actorId,
            voidedAt: now,
            voidReason: input.reason,
            updatedBy: actorId,
          },
        },
        { returnDocument: "after", runValidators: true, session },
      );
      if (!updatedCharge) {
        throw new BillingSettlementError(
          "Charge changed before reconciliation could be saved",
          409,
        );
      }
      link.lineItem.financialStatus = "VOID";
      link.lineItem.paymentStatus = "PENDING_PAYMENT";
      recalculate(billing);
      await validateInvoiceChargeIntegrity(billing, session);
      billing.updatedBy = actorId;
      await billing.save({ session });
      const transaction = billing.refundTransactions.find(
        (item) => item._id.equals(transactionId),
      );
      if (!transaction) throw new Error("Saved reconciliation Refund was not found");
      return {
        ...refundResult(billing, transaction, false),
        charge: { id: chargeId.toString(), status: "VOID" as const },
        lineItem: {
          id: link.lineItem._id.toString(),
          financialStatus: "VOID" as const,
        },
      };
    });
    if (!result) throw new Error("Charge reconciliation did not return a result");
    return result;
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      const billing = await Billing.findOne({
        "refundTransactions.idempotencyKey": idempotencyKey,
      });
      if (billing?.appointmentId.equals(appointmentId)) {
        const replay = existingRefund(
          billing,
          idempotencyKey,
          input,
          chargeId.toString(),
        );
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
  await Promise.all([prepareBillingPersistence(), Charge.init()]);
  const session = await mongoose.startSession();

  try {
    const result = await session.withTransaction(async () => {
      const billing = await loadCompletedBilling(appointmentId, session);
      if (billing.billingStatus === "CLOSED") {
        return {
          billingStatus: billing.billingStatus,
          closedAt: billing.closedAt,
          closedBy: billing.closedBy?.toString(),
          replayed: true,
        };
      }
      const chargeLinks = await validateInvoiceChargeIntegrity(
        billing,
        session,
      );
      recalculate(billing);
      if (
        getBillingAllocationState(billing) === "LEGACY_UNALLOCATED" &&
        (billing.paymentTransactions.length > 0 || billing.amountPaid > 0)
      ) {
        throw new BillingSettlementError(
          "Legacy Billing payment allocation must be reconciled before this invoice can be closed",
          409,
        );
      }
      if (
        chargeLinks.some(
          ({ charge }) => charge.status === "RECONCILIATION_REQUIRED",
        )
      ) {
        throw new BillingSettlementError(
          "Diagnostic Charges requiring reconciliation must be resolved before this invoice can be closed",
          409,
        );
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
      if (
        billing.insurancePlan !== "NONE" &&
        billing.insuranceVerificationStatus !== "VERIFIED"
      ) {
        throw new BillingSettlementError(
          "Insurance must be verified before this invoice can be closed",
          409,
        );
      }
      const now = new Date();
      billing.updatedBy = actorId;
      billing.updatedAt = now;
      await billing.save({ session });

      const closedBilling = await Billing.findOneAndUpdate(
        { _id: billing._id, billingStatus: "OPEN" },
        {
          $set: {
            billingStatus: "CLOSED",
            closedAt: now,
            closedBy: actorId,
            updatedBy: actorId,
          },
        },
        { returnDocument: "after", runValidators: true, session },
      );
      if (!closedBilling) {
        throw new BillingSettlementError(
          "Invoice state changed before it could be closed",
          409,
        );
      }
      return {
        billingStatus: closedBilling.billingStatus,
        closedAt: closedBilling.closedAt,
        closedBy: closedBilling.closedBy?.toString(),
        replayed: false,
      };
    });
    if (!result) throw new Error("Billing close did not return a result");
    return result;
  } finally {
    await session.endSession();
  }
}
