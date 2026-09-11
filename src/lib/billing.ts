import "server-only";

import { randomBytes } from "node:crypto";
import mongoose, { ClientSession, model, models, Schema } from "mongoose";
import {
  INITIAL_CONSULTATION_DESCRIPTION,
  INITIAL_CONSULTATION_FEE_VND,
} from "@/lib/billing-config";
import { calculateBillingAmounts } from "@/lib/billing-insurance";
import Billing, { type IBilling } from "@/models/Billing";

interface IBillingInvoiceSequence {
  _id: string;
  value: number;
}

const BillingInvoiceSequenceSchema = new Schema<IBillingInvoiceSequence>(
  {
    _id: { type: String, required: true },
    value: { type: Number, required: true, min: 0 },
  },
  { versionKey: false },
);

const BillingInvoiceSequence =
  models.BillingInvoiceSequence ||
  model<IBillingInvoiceSequence>(
    "BillingInvoiceSequence",
    BillingInvoiceSequenceSchema,
  );

interface EnsureBillingInput {
  appointmentId: mongoose.Types.ObjectId;
  patientId: mongoose.Types.ObjectId;
  actorId: mongoose.Types.ObjectId;
  session: ClientSession;
}

export async function prepareBillingPersistence(): Promise<void> {
  await Promise.all([Billing.init(), BillingInvoiceSequence.init()]);
}

function invoiceDateKey(date: Date): string {
  return date.toISOString().slice(0, 10).replaceAll("-", "");
}

async function nextInvoiceNumber(
  date: Date,
  session: ClientSession,
): Promise<string> {
  const dateKey = invoiceDateKey(date);
  const sequence = await BillingInvoiceSequence.findOneAndUpdate(
    { _id: dateKey },
    { $inc: { value: 1 } },
    {
      upsert: true,
      returnDocument: "after",
      setDefaultsOnInsert: true,
      session,
    },
  );

  if (!sequence) {
    throw new Error("Unable to allocate an invoice number");
  }

  return `INV-${dateKey}-${String(sequence.value).padStart(3, "0")}`;
}

function generateLookupCode(): string {
  return randomBytes(8).toString("base64url").toUpperCase();
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === 11000
  );
}

export async function ensureBillingForAppointment({
  appointmentId,
  patientId,
  actorId,
  session,
}: EnsureBillingInput): Promise<IBilling> {
  const existing = await Billing.findOne({ appointmentId }).session(session);
  if (existing) {
    return existing;
  }

  const now = new Date();
  const invoiceNo = await nextInvoiceNumber(now, session);
  const initialAmount = INITIAL_CONSULTATION_FEE_VND;
  const initialLineItems = [
    {
      category: "CONSULTATION" as const,
      description: INITIAL_CONSULTATION_DESCRIPTION,
      quantity: 1,
      unitPrice: initialAmount,
      amount: initialAmount,
      isCoveredByInsurance: true,
      paymentStatus: "PENDING_PAYMENT" as const,
      addedBy: actorId,
      createdAt: now,
    },
  ];
  const totals = calculateBillingAmounts({
    lineItems: initialLineItems,
    insurancePlan: "NONE",
    insuranceOverrideEnabled: false,
    insuranceOverrideAmount: 0,
    amountPaid: 0,
  });

  try {
    const billing = await Billing.findOneAndUpdate(
      { appointmentId },
      {
        $setOnInsert: {
          appointmentId,
          patientId,
          invoiceNo,
          lookupCode: generateLookupCode(),
          lineItems: initialLineItems,
          insurancePlan: "NONE",
          insuranceOverrideEnabled: false,
          insuranceOverrideAmount: 0,
          insuranceVerificationStatus: "NONE",
          grossSubtotal: totals.grossSubtotal,
          coveredSubtotal: totals.coveredSubtotal,
          calculatedInsurancePaid: totals.calculatedInsurancePaid,
          effectiveInsurancePaid: totals.effectiveInsurancePaid,
          postInsuranceAmount: totals.postInsuranceAmount,
          subtotal: totals.grossSubtotal,
          insurancePaid: totals.effectiveInsurancePaid,
          vatAmount: totals.vatAmount,
          totalPatientPayable: totals.totalPatientPayable,
          amountPaid: 0,
          balanceDue: totals.balanceDue,
          paymentStatus: totals.paymentStatus,
          updatedBy: actorId,
        },
      },
      {
        upsert: true,
        returnDocument: "after",
        runValidators: true,
        setDefaultsOnInsert: true,
        session,
      },
    );

    if (!billing) {
      throw new Error("Unable to initialize billing");
    }

    return billing;
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      const billing = await Billing.findOne({ appointmentId }).session(session);
      if (billing) {
        return billing;
      }
    }
    throw error;
  }
}
