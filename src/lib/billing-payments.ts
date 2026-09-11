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
  BILLING_PAYMENT_TYPES,
  type BillingPaymentMethod,
  type BillingPaymentType,
  type IBilling,
  type IBillingPaymentTransaction,
} from "@/models/Billing";

const PAYABLE_APPOINTMENT_STATUSES = [
  "CONFIRMED",
  "ACCEPTED",
  "COMPLETED",
] as const;

export interface PaymentInput {
  amount: number;
  method: BillingPaymentMethod;
  type: BillingPaymentType;
  reference?: string;
  note?: string;
}

export class BillingPaymentError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409,
  ) {
    super(message);
    this.name = "BillingPaymentError";
  }
}

function isPaymentMethod(value: unknown): value is BillingPaymentMethod {
  return (
    typeof value === "string" &&
    BILLING_PAYMENT_METHODS.includes(value as BillingPaymentMethod)
  );
}

function isPaymentType(value: unknown): value is BillingPaymentType {
  return (
    typeof value === "string" &&
    BILLING_PAYMENT_TYPES.includes(value as BillingPaymentType)
  );
}

function optionalText(
  value: unknown,
  label: string,
  maximumLength: number,
): { value?: string } | { error: BillingPaymentError } {
  if (value === undefined) return {};
  if (typeof value !== "string") {
    return { error: new BillingPaymentError(`${label} must be text`, 400) };
  }
  const trimmed = value.trim();
  if (trimmed.length > maximumLength) {
    return {
      error: new BillingPaymentError(
        `${label} must be ${maximumLength} characters or fewer`,
        400,
      ),
    };
  }
  return trimmed ? { value: trimmed } : {};
}

export function parsePaymentInput(
  value: unknown,
): { data: PaymentInput } | { error: BillingPaymentError } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { error: new BillingPaymentError("Invalid request body", 400) };
  }

  const body = value as Record<string, unknown>;
  const allowedFields = new Set([
    "amount",
    "method",
    "type",
    "reference",
    "note",
  ]);
  if (Object.keys(body).some((key) => !allowedFields.has(key))) {
    return {
      error: new BillingPaymentError(
        "Payment totals and audit fields cannot be supplied by the client",
        400,
      ),
    };
  }
  if (!Number.isSafeInteger(body.amount) || (body.amount as number) <= 0) {
    return {
      error: new BillingPaymentError(
        "Payment amount must be a positive integer VND amount",
        400,
      ),
    };
  }
  if (!isPaymentMethod(body.method)) {
    return { error: new BillingPaymentError("Invalid payment method", 400) };
  }
  if (!isPaymentType(body.type)) {
    return { error: new BillingPaymentError("Invalid payment type", 400) };
  }

  const reference = optionalText(body.reference, "Reference", 200);
  if ("error" in reference) return reference;
  const note = optionalText(body.note, "Note", 500);
  if ("error" in note) return note;

  return {
    data: {
      amount: body.amount as number,
      method: body.method,
      type: body.type,
      ...(reference.value ? { reference: reference.value } : {}),
      ...(note.value ? { note: note.value } : {}),
    },
  };
}

export function parseIdempotencyKey(value: string | null): string {
  const key = value?.trim() ?? "";
  if (!/^[A-Za-z0-9._:-]{8,128}$/.test(key)) {
    throw new BillingPaymentError(
      "A valid Idempotency-Key header is required",
      400,
    );
  }
  return key;
}

interface PaymentResultTransaction {
  id: string;
  amount: number;
  method: BillingPaymentMethod;
  type: BillingPaymentType;
  reference?: string;
  note?: string;
  collectedBy: string;
  collectedAt: Date;
}

export interface PaymentResult {
  replayed: boolean;
  transaction: PaymentResultTransaction;
  amountPaid: number;
  balanceDue: number;
  paymentStatus: IBilling["paymentStatus"];
  lineItems: Array<{ id: string; paymentStatus: "PENDING_PAYMENT" | "PAID" }>;
}

function samePayment(
  transaction: IBillingPaymentTransaction,
  input: PaymentInput,
): boolean {
  return (
    transaction.amount === input.amount &&
    transaction.method === input.method &&
    transaction.type === input.type &&
    (transaction.reference ?? undefined) === input.reference &&
    (transaction.note ?? undefined) === input.note
  );
}

function paymentResult(
  billing: IBilling,
  transaction: IBillingPaymentTransaction,
  replayed: boolean,
): PaymentResult {
  return {
    replayed,
    transaction: {
      id: transaction._id.toString(),
      amount: transaction.amount,
      method: transaction.method,
      type: transaction.type,
      ...(transaction.reference ? { reference: transaction.reference } : {}),
      ...(transaction.note ? { note: transaction.note } : {}),
      collectedBy: transaction.collectedBy.toString(),
      collectedAt: transaction.collectedAt,
    },
    amountPaid: billing.amountPaid,
    balanceDue: billing.balanceDue,
    paymentStatus: billing.paymentStatus,
    lineItems: billing.lineItems.map((item) => ({
      id: item._id.toString(),
      paymentStatus: item.paymentStatus,
    })),
  };
}

function existingPaymentResult(
  billing: IBilling,
  idempotencyKey: string,
  input: PaymentInput,
): PaymentResult | null {
  const existing = billing.paymentTransactions.find(
    (transaction) => transaction.idempotencyKey === idempotencyKey,
  );
  if (!existing) return null;
  if (!samePayment(existing, input)) {
    throw new BillingPaymentError(
      "The Idempotency-Key was already used for a different payment",
      409,
    );
  }
  return paymentResult(billing, existing, true);
}

async function loadPayableBilling(
  appointmentId: mongoose.Types.ObjectId,
  session: ClientSession,
): Promise<IBilling> {
  const appointment = await Appointment.findById(appointmentId)
    .select("status")
    .session(session);
  if (!appointment) {
    throw new BillingPaymentError("Appointment not found", 404);
  }
  if (
    !PAYABLE_APPOINTMENT_STATUSES.includes(
      appointment.status as (typeof PAYABLE_APPOINTMENT_STATUSES)[number],
    )
  ) {
    throw new BillingPaymentError(
      `Payments cannot be collected for a ${appointment.status} appointment`,
      409,
    );
  }

  const billing = await Billing.findOne({ appointmentId }).session(session);
  if (!billing) {
    throw new BillingPaymentError(
      "Billing has not been initialized for this appointment",
      404,
    );
  }
  return billing;
}

function applyCalculation(billing: IBilling): void {
  try {
    recalculateBilling(billing);
  } catch (error) {
    if (error instanceof BillingCalculationError) {
      throw new BillingPaymentError(error.message, 409);
    }
    throw error;
  }
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === 11000
  );
}

export async function collectBillingPayment(
  appointmentIdValue: string,
  actorIdValue: string,
  idempotencyKey: string,
  input: PaymentInput,
): Promise<PaymentResult> {
  if (!mongoose.isValidObjectId(appointmentIdValue)) {
    throw new BillingPaymentError("Invalid appointment id", 400);
  }
  if (!mongoose.isValidObjectId(actorIdValue)) {
    throw new BillingPaymentError("Invalid authenticated user id", 400);
  }

  await prepareBillingPersistence();
  const appointmentId = new mongoose.Types.ObjectId(appointmentIdValue);
  const actorId = new mongoose.Types.ObjectId(actorIdValue);
  const session = await mongoose.startSession();

  try {
    const result = await session.withTransaction(async () => {
      const billing = await loadPayableBilling(appointmentId, session);
      const replay = existingPaymentResult(billing, idempotencyKey, input);
      if (replay) return replay;

      applyCalculation(billing);
      if (input.amount > billing.balanceDue) {
        throw new BillingPaymentError(
          "Payment amount exceeds the remaining balance",
          409,
        );
      }

      const transactionId = new mongoose.Types.ObjectId();
      billing.paymentTransactions.push({
        _id: transactionId,
        idempotencyKey,
        ...input,
        collectedBy: actorId,
        collectedAt: new Date(),
      });
      applyCalculation(billing);
      billing.updatedBy = actorId;
      await billing.save({ session });
      const transaction = billing.paymentTransactions.find(
        (item) => item._id.toString() === transactionId.toString(),
      );
      if (!transaction) {
        throw new Error("Saved payment transaction was not found");
      }
      return paymentResult(billing, transaction, false);
    });

    if (!result) throw new Error("Payment transaction did not return a result");
    return result;
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      const billing = await Billing.findOne({
        "paymentTransactions.idempotencyKey": idempotencyKey,
      });
      if (billing) {
        const replay = existingPaymentResult(billing, idempotencyKey, input);
        if (replay && billing.appointmentId.toString() === appointmentIdValue) {
          return replay;
        }
      }
      throw new BillingPaymentError(
        "The Idempotency-Key was already used for another payment",
        409,
      );
    }
    throw error;
  } finally {
    await session.endSession();
  }
}
