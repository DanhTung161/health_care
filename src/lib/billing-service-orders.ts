import "server-only";

import mongoose, { type ClientSession } from "mongoose";
import { prepareBillingPersistence } from "@/lib/billing";
import {
  BillingCalculationError,
  recalculateBilling,
} from "@/lib/billing-insurance";
import Appointment from "@/models/Appointment";
import Billing, {
  BILLING_LINE_ITEM_CATEGORIES,
  type BillingLineItemCategory,
  type BillingLineItemPaymentStatus,
  type IBilling,
  type IBillingLineItem,
} from "@/models/Billing";

const ORDERABLE_APPOINTMENT_STATUSES = ["CONFIRMED", "ACCEPTED"] as const;

export const EXECUTABLE_SERVICE_ORDER_PAYMENT_STATUS = "PAID" as const;

export interface ServiceOrderInput {
  category: BillingLineItemCategory;
  description: string;
  quantity: number;
  unitPrice: number;
  isCoveredByInsurance: boolean;
}

export interface ServiceOrderMutationResult {
  lineItem?: {
    _id: string;
    category: BillingLineItemCategory;
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
    isCoveredByInsurance: boolean;
    paymentStatus: BillingLineItemPaymentStatus;
    addedBy: string;
    createdAt: Date;
  };
  removedLineItemId?: string;
  subtotal: number;
  totalPatientPayable: number;
  amountPaid: number;
  balanceDue: number;
  paymentStatus: IBilling["paymentStatus"];
}

export class BillingServiceOrderError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 404 | 409,
  ) {
    super(message);
    this.name = "BillingServiceOrderError";
  }
}

export function isServiceOrderExecutable(
  lineItem: Pick<IBillingLineItem, "paymentStatus">,
): boolean {
  return lineItem.paymentStatus === EXECUTABLE_SERVICE_ORDER_PAYMENT_STATUS;
}

function isLineItemCategory(value: unknown): value is BillingLineItemCategory {
  return (
    typeof value === "string" &&
    BILLING_LINE_ITEM_CATEGORIES.includes(value as BillingLineItemCategory)
  );
}

function insuranceEligibility(
  category: BillingLineItemCategory,
  suppliedValue: unknown,
): boolean | BillingServiceOrderError {
  if (category === "MEDICATION") {
    return typeof suppliedValue === "boolean"
      ? suppliedValue
      : new BillingServiceOrderError(
          "Medication orders require explicit insurance eligibility",
          400,
        );
  }

  if (
    category === "CONSULTATION" ||
    category === "LAB" ||
    category === "XRAY" ||
    category === "ULTRASOUND"
  ) {
    return true;
  }

  if (suppliedValue !== undefined && typeof suppliedValue !== "boolean") {
    return new BillingServiceOrderError(
      "Insurance eligibility must be a boolean",
      400,
    );
  }
  return suppliedValue === true;
}

export function parseServiceOrderInput(
  value: unknown,
): { data: ServiceOrderInput } | { error: BillingServiceOrderError } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      error: new BillingServiceOrderError("Invalid request body", 400),
    };
  }

  const body = value as Record<string, unknown>;
  const allowedFields = new Set([
    "category",
    "description",
    "quantity",
    "unitPrice",
    "isCoveredByInsurance",
  ]);
  if (Object.keys(body).some((key) => !allowedFields.has(key))) {
    return {
      error: new BillingServiceOrderError(
        "Only clinical order fields may be changed",
        400,
      ),
    };
  }

  if (!isLineItemCategory(body.category)) {
    return {
      error: new BillingServiceOrderError(
        "Service order category is invalid",
        400,
      ),
    };
  }

  const description =
    typeof body.description === "string" ? body.description.trim() : "";
  if (!description || description.length > 200) {
    return {
      error: new BillingServiceOrderError(
        "Description is required and must be 200 characters or fewer",
        400,
      ),
    };
  }

  if (
    !Number.isSafeInteger(body.quantity) ||
    (body.quantity as number) < 1
  ) {
    return {
      error: new BillingServiceOrderError(
        "Quantity must be a positive integer",
        400,
      ),
    };
  }
  if (
    !Number.isSafeInteger(body.unitPrice) ||
    (body.unitPrice as number) < 0
  ) {
    return {
      error: new BillingServiceOrderError(
        "Unit price must be a non-negative VND integer",
        400,
      ),
    };
  }

  const amount = (body.quantity as number) * (body.unitPrice as number);
  if (!Number.isSafeInteger(amount)) {
    return {
      error: new BillingServiceOrderError(
        "Quantity and unit price produce an unsafe VND amount",
        400,
      ),
    };
  }

  const covered = insuranceEligibility(
    body.category,
    body.isCoveredByInsurance,
  );
  if (covered instanceof BillingServiceOrderError) {
    return { error: covered };
  }

  return {
    data: {
      category: body.category,
      description,
      quantity: body.quantity as number,
      unitPrice: body.unitPrice as number,
      isCoveredByInsurance: covered,
    },
  };
}

function calculateAmount(input: ServiceOrderInput): number {
  const amount = input.quantity * input.unitPrice;
  if (!Number.isSafeInteger(amount)) {
    throw new BillingServiceOrderError(
      "Quantity and unit price produce an unsafe VND amount",
      400,
    );
  }
  return amount;
}

function applyBillingCalculation(billing: IBilling): void {
  try {
    recalculateBilling(billing);
  } catch (error) {
    if (error instanceof BillingCalculationError) {
      throw new BillingServiceOrderError(error.message, 409);
    }
    throw error;
  }
}

async function loadOwnedBilling(
  appointmentId: mongoose.Types.ObjectId,
  doctorId: mongoose.Types.ObjectId,
  session: ClientSession,
): Promise<IBilling> {
  const appointment = await Appointment.findById(appointmentId)
    .select("doctorId status")
    .session(session);
  if (!appointment) {
    throw new BillingServiceOrderError("Appointment not found", 404);
  }
  if (appointment.doctorId.toString() !== doctorId.toString()) {
    throw new BillingServiceOrderError(
      "Only the assigned doctor can manage clinical orders",
      403,
    );
  }
  if (
    !ORDERABLE_APPOINTMENT_STATUSES.includes(
      appointment.status as (typeof ORDERABLE_APPOINTMENT_STATUSES)[number],
    )
  ) {
    throw new BillingServiceOrderError(
      `Clinical orders cannot be changed for a ${appointment.status} appointment`,
      409,
    );
  }

  const billing = await Billing.findOne({ appointmentId }).session(session);
  if (!billing) {
    throw new BillingServiceOrderError(
      "Billing has not been initialized for this appointment",
      409,
    );
  }
  return billing;
}

function findLineItem(billing: IBilling, lineItemId: string) {
  const lineItem = billing.lineItems.find(
    (item) => item._id.toString() === lineItemId,
  );
  if (!lineItem) {
    throw new BillingServiceOrderError("Billing line item not found", 404);
  }
  return lineItem;
}

function assertDoctorCanChangeLineItem(
  lineItem: IBillingLineItem,
  doctorId: mongoose.Types.ObjectId,
): void {
  if (lineItem.addedBy.toString() !== doctorId.toString()) {
    throw new BillingServiceOrderError(
      "Doctors may only change clinical orders they created",
      403,
    );
  }
  if (lineItem.paymentStatus !== "PENDING_PAYMENT") {
    throw new BillingServiceOrderError(
      "Paid clinical orders cannot be changed or removed",
      409,
    );
  }
}

function resultFor(
  billing: IBilling,
  lineItem?: IBillingLineItem,
  removedLineItemId?: string,
): ServiceOrderMutationResult {
  return {
    ...(lineItem
      ? {
          lineItem: {
            _id: lineItem._id.toString(),
            category: lineItem.category,
            description: lineItem.description,
            quantity: lineItem.quantity,
            unitPrice: lineItem.unitPrice,
            amount: lineItem.amount,
            isCoveredByInsurance: lineItem.isCoveredByInsurance,
            paymentStatus: lineItem.paymentStatus,
            addedBy: lineItem.addedBy.toString(),
            createdAt: lineItem.createdAt,
          },
        }
      : {}),
    ...(removedLineItemId ? { removedLineItemId } : {}),
    subtotal: billing.subtotal,
    totalPatientPayable: billing.totalPatientPayable,
    amountPaid: billing.amountPaid,
    balanceDue: billing.balanceDue,
    paymentStatus: billing.paymentStatus,
  };
}

async function inBillingTransaction<T>(
  work: (session: ClientSession) => Promise<T>,
): Promise<T> {
  await prepareBillingPersistence();
  const session = await mongoose.startSession();
  try {
    const result = await session.withTransaction(() => work(session));
    if (result === undefined) {
      throw new Error("Billing transaction did not return a result");
    }
    return result;
  } finally {
    await session.endSession();
  }
}

function objectId(value: string, label: string): mongoose.Types.ObjectId {
  if (!mongoose.isValidObjectId(value)) {
    throw new BillingServiceOrderError(`Invalid ${label}`, 400);
  }
  return new mongoose.Types.ObjectId(value);
}

export async function addClinicalServiceOrder(
  appointmentIdValue: string,
  doctorIdValue: string,
  input: ServiceOrderInput,
): Promise<ServiceOrderMutationResult> {
  const appointmentId = objectId(appointmentIdValue, "appointment id");
  const doctorId = objectId(doctorIdValue, "authenticated user id");

  return inBillingTransaction(async (session) => {
    const billing = await loadOwnedBilling(appointmentId, doctorId, session);
    const lineItemId = new mongoose.Types.ObjectId();
    billing.lineItems.push({
      _id: lineItemId,
      ...input,
      amount: calculateAmount(input),
      paymentStatus: "PENDING_PAYMENT",
      addedBy: doctorId,
      createdAt: new Date(),
    });
    applyBillingCalculation(billing);
    billing.updatedBy = doctorId;
    await billing.save({ session });
    return resultFor(billing, findLineItem(billing, lineItemId.toString()));
  });
}

export async function updateClinicalServiceOrder(
  appointmentIdValue: string,
  lineItemIdValue: string,
  doctorIdValue: string,
  input: ServiceOrderInput,
): Promise<ServiceOrderMutationResult> {
  const appointmentId = objectId(appointmentIdValue, "appointment id");
  const lineItemId = objectId(lineItemIdValue, "line item id").toString();
  const doctorId = objectId(doctorIdValue, "authenticated user id");

  return inBillingTransaction(async (session) => {
    const billing = await loadOwnedBilling(appointmentId, doctorId, session);
    const lineItem = findLineItem(billing, lineItemId);
    assertDoctorCanChangeLineItem(lineItem, doctorId);

    lineItem.category = input.category;
    lineItem.description = input.description;
    lineItem.quantity = input.quantity;
    lineItem.unitPrice = input.unitPrice;
    lineItem.amount = calculateAmount(input);
    lineItem.isCoveredByInsurance = input.isCoveredByInsurance;
    applyBillingCalculation(billing);
    billing.updatedBy = doctorId;
    await billing.save({ session });
    return resultFor(billing, lineItem);
  });
}

export async function removeClinicalServiceOrder(
  appointmentIdValue: string,
  lineItemIdValue: string,
  doctorIdValue: string,
): Promise<ServiceOrderMutationResult> {
  const appointmentId = objectId(appointmentIdValue, "appointment id");
  const lineItemId = objectId(lineItemIdValue, "line item id").toString();
  const doctorId = objectId(doctorIdValue, "authenticated user id");

  return inBillingTransaction(async (session) => {
    const billing = await loadOwnedBilling(appointmentId, doctorId, session);
    const lineItem = findLineItem(billing, lineItemId);
    assertDoctorCanChangeLineItem(lineItem, doctorId);
    const index = billing.lineItems.findIndex(
      (item) => item._id.toString() === lineItemId,
    );
    billing.lineItems.splice(index, 1);
    applyBillingCalculation(billing);
    billing.updatedBy = doctorId;
    await billing.save({ session });
    return resultFor(billing, undefined, lineItemId);
  });
}
