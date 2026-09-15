import "server-only";

import mongoose, { type ClientSession } from "mongoose";
import {
  BillingCalculationError,
  recalculateBilling,
} from "@/lib/billing-insurance";
import { isServiceOrderExecutable } from "@/lib/billing-service-orders";
import type { DiagnosticStatus, DiagnosticType } from "@/lib/diagnostic";
import Appointment from "@/models/Appointment";
import Billing, { type IBilling, type IBillingLineItem } from "@/models/Billing";
import Charge, { type ICharge } from "@/models/Charge";
import DiagnosticService, {
  type DiagnosticBillingCategory,
} from "@/models/DiagnosticService";

export class BillingChargeError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 404 | 409,
  ) {
    super(message);
    this.name = "BillingChargeError";
  }
}

export interface ResolvedDiagnosticService {
  serviceCode: string;
  serviceName: string;
  diagnosticType: DiagnosticType;
  billingCategory: DiagnosticBillingCategory;
  unitPrice: number;
  isCoveredByInsurance: boolean;
}

interface DiagnosticChargeInput {
  diagnosticOrderItemId: mongoose.Types.ObjectId;
  service: ResolvedDiagnosticService;
}

interface DiagnosticBillingContextInput {
  appointmentId?: mongoose.Types.ObjectId;
  patientId: mongoose.Types.ObjectId;
  doctorId: mongoose.Types.ObjectId;
  session: ClientSession;
}

interface ChargeContext {
  charge: ICharge;
  billing: IBilling;
  lineItem: IBillingLineItem;
}

export async function prepareDiagnosticBillingPersistence(): Promise<void> {
  await Promise.all([Billing.init(), Charge.init(), DiagnosticService.init()]);
}

function isValidDiagnosticCategory(
  diagnosticType: DiagnosticType,
  category: string,
): category is DiagnosticBillingCategory {
  return diagnosticType === "LAB"
    ? category === "LAB"
    : category === "XRAY" || category === "ULTRASOUND";
}

export async function resolveDiagnosticServices(
  serviceCodes: readonly string[],
  diagnosticType: DiagnosticType,
  session: ClientSession,
): Promise<Map<string, ResolvedDiagnosticService>> {
  const services = (await DiagnosticService.find({
    serviceCode: { $in: serviceCodes },
  })
    .select(
      "serviceCode serviceName diagnosticType billingCategory unitPrice isCoveredByInsurance isActive",
    )
    .session(session)
    .lean()) as unknown as Array<ResolvedDiagnosticService & { isActive: boolean }>;

  const byCode = new Map(services.map((service) => [service.serviceCode, service]));
  const resolved = new Map<string, ResolvedDiagnosticService>();

  for (const serviceCode of serviceCodes) {
    const service = byCode.get(serviceCode);
    if (!service || !service.isActive) {
      throw new BillingChargeError(
        `Diagnostic service ${serviceCode} is missing or inactive`,
        409,
      );
    }
    if (service.diagnosticType !== diagnosticType) {
      throw new BillingChargeError(
        `Diagnostic service ${serviceCode} does not match order type ${diagnosticType}`,
        409,
      );
    }
    if (!isValidDiagnosticCategory(diagnosticType, service.billingCategory)) {
      throw new BillingChargeError(
        `Diagnostic service ${serviceCode} has an invalid Billing category`,
        409,
      );
    }
    if (!Number.isSafeInteger(service.unitPrice) || service.unitPrice < 0) {
      throw new BillingChargeError(
        `Diagnostic service ${serviceCode} has an invalid VND price`,
        409,
      );
    }
    if (!service.serviceName.trim()) {
      throw new BillingChargeError(
        `Diagnostic service ${serviceCode} has an invalid name`,
        409,
      );
    }

    resolved.set(serviceCode, {
      serviceCode: service.serviceCode,
      serviceName: service.serviceName,
      diagnosticType: service.diagnosticType,
      billingCategory: service.billingCategory,
      unitPrice: service.unitPrice,
      isCoveredByInsurance: service.isCoveredByInsurance,
    });
  }

  return resolved;
}

export async function loadOpenDiagnosticBilling({
  appointmentId,
  patientId,
  doctorId,
  session,
}: DiagnosticBillingContextInput): Promise<IBilling> {
  if (!appointmentId) {
    throw new BillingChargeError(
      "Medical visit has no trusted Appointment linkage for Billing",
      409,
    );
  }

  const appointment = await Appointment.findById(appointmentId)
    .select("patientId doctorId status")
    .session(session);
  if (!appointment) {
    throw new BillingChargeError(
      "Linked Appointment is missing for this medical visit",
      409,
    );
  }
  if (!appointment.patientId.equals(patientId)) {
    throw new BillingChargeError(
      "Medical visit patient does not match its linked Appointment",
      409,
    );
  }
  if (!appointment.doctorId.equals(doctorId)) {
    throw new BillingChargeError(
      "Medical visit Doctor does not match its linked Appointment",
      409,
    );
  }
  if (appointment.status === "CANCELLED") {
    throw new BillingChargeError(
      "Diagnostic orders cannot be billed to a cancelled Appointment",
      409,
    );
  }

  const billing = await Billing.findOne({ appointmentId }).session(session);
  if (!billing) {
    throw new BillingChargeError(
      "Billing has not been initialized for the linked Appointment",
      409,
    );
  }
  if (!billing.patientId.equals(patientId)) {
    throw new BillingChargeError(
      "Billing patient does not match the diagnostic medical visit",
      409,
    );
  }
  if (billing.billingStatus === "CLOSED") {
    throw new BillingChargeError(
      "Closed Billing cannot receive new diagnostic charges",
      409,
    );
  }

  return billing;
}

function applyCalculation(billing: IBilling): void {
  try {
    recalculateBilling(billing);
  } catch (error) {
    if (error instanceof BillingCalculationError) {
      throw new BillingChargeError(error.message, 409);
    }
    throw error;
  }
}

export async function createDiagnosticCharges(
  billing: IBilling,
  inputs: readonly DiagnosticChargeInput[],
  actorId: mongoose.Types.ObjectId,
  session: ClientSession,
): Promise<ICharge[]> {
  const now = new Date();
  const records = inputs.map(({ diagnosticOrderItemId, service }) => {
    const chargeId = new mongoose.Types.ObjectId();
    const billingLineItemId = new mongoose.Types.ObjectId();
    const quantity = 1;
    const amount = quantity * service.unitPrice;

    if (!Number.isSafeInteger(amount)) {
      throw new BillingChargeError(
        `Diagnostic service ${service.serviceCode} produces an invalid VND amount`,
        409,
      );
    }

    return {
      charge: {
        _id: chargeId,
        billingId: billing._id,
        billingLineItemId,
        sourceType: "DIAGNOSTIC_ORDER_ITEM" as const,
        sourceId: diagnosticOrderItemId,
        category: service.billingCategory,
        serviceCode: service.serviceCode,
        description: service.serviceName,
        quantity,
        unitPrice: service.unitPrice,
        amount,
        isCoveredByInsurance: service.isCoveredByInsurance,
        status: "ACTIVE" as const,
        createdBy: actorId,
        updatedBy: actorId,
      },
      lineItem: {
        _id: billingLineItemId,
        chargeId,
        category: service.billingCategory,
        serviceCode: service.serviceCode,
        description: service.serviceName,
        quantity,
        unitPrice: service.unitPrice,
        amount,
        isCoveredByInsurance: service.isCoveredByInsurance,
        financialStatus: "ACTIVE" as const,
        paymentStatus: "PENDING_PAYMENT" as const,
        addedBy: actorId,
        createdAt: now,
      },
    };
  });

  const charges = await Charge.create(
    records.map(({ charge }) => charge),
    { session, ordered: true },
  );
  if (charges.length !== inputs.length) {
    throw new Error("Not all diagnostic charges were created");
  }

  billing.lineItems.push(...records.map(({ lineItem }) => lineItem));
  applyCalculation(billing);
  billing.updatedBy = actorId;
  await billing.save({ session });

  return charges;
}

function duplicateKeyCandidate(error: unknown): {
  code?: unknown;
  keyPattern?: Record<string, unknown>;
  message?: unknown;
} | null {
  return typeof error === "object" && error !== null
    ? (error as {
        code?: unknown;
        keyPattern?: Record<string, unknown>;
        message?: unknown;
      })
    : null;
}

export function isDuplicateChargeSourceError(error: unknown): boolean {
  const candidate = duplicateKeyCandidate(error);
  if (!candidate || candidate.code !== 11000) return false;

  return (
    (candidate.keyPattern?.sourceType === 1 &&
      candidate.keyPattern?.sourceId === 1) ||
    (typeof candidate.message === "string" &&
      candidate.message.includes("unique_charge_source"))
  );
}

async function loadChargeContext(
  sourceId: mongoose.Types.ObjectId,
  session: ClientSession,
): Promise<ChargeContext> {
  const charge = await Charge.findOne({
    sourceType: "DIAGNOSTIC_ORDER_ITEM",
    sourceId,
  }).session(session);
  if (!charge) {
    throw new BillingChargeError(
      "Diagnostic item has no Charge; legacy or inconsistent financial state must be reconciled before this transition",
      409,
    );
  }

  const billing = await Billing.findById(charge.billingId).session(session);
  if (!billing) {
    throw new BillingChargeError(
      "Diagnostic Charge references missing Billing",
      409,
    );
  }

  const matchingLines = billing.lineItems.filter(
    (lineItem: IBillingLineItem) =>
      lineItem._id.equals(charge.billingLineItemId) &&
      lineItem.chargeId?.equals(charge._id),
  );
  if (matchingLines.length !== 1) {
    throw new BillingChargeError(
      "Diagnostic Charge does not match exactly one Billing line",
      409,
    );
  }

  return { charge, billing, lineItem: matchingLines[0] };
}

function chargeStatusError(charge: ICharge): BillingChargeError {
  return new BillingChargeError(
    charge.status === "VOID"
      ? "Void diagnostic Charges cannot be executed or cancelled again"
      : "Diagnostic Charge requires financial reconciliation",
    409,
  );
}

export async function assertDiagnosticItemFinanciallyExecutable(
  sourceId: mongoose.Types.ObjectId,
  session: ClientSession,
): Promise<void> {
  const { charge, billing, lineItem } = await loadChargeContext(sourceId, session);
  if (charge.status !== "ACTIVE") throw chargeStatusError(charge);
  if (billing.billingStatus === "CLOSED") {
    throw new BillingChargeError(
      "Closed Billing cannot authorize diagnostic execution",
      409,
    );
  }
  if (lineItem.financialStatus !== "ACTIVE") {
    throw new BillingChargeError(
      "Void diagnostic Billing lines cannot be executed",
      409,
    );
  }
  if (!isServiceOrderExecutable(lineItem)) {
    throw new BillingChargeError(
      "Diagnostic service is not financially settled",
      409,
    );
  }
}

export async function applyDiagnosticCancellationFinancials(
  sourceId: mongoose.Types.ObjectId,
  currentItemStatus: DiagnosticStatus,
  cancellationReason: string,
  actorId: mongoose.Types.ObjectId,
  session: ClientSession,
): Promise<"VOID" | "RECONCILIATION_REQUIRED"> {
  const { charge, billing, lineItem } = await loadChargeContext(sourceId, session);
  if (charge.status !== "ACTIVE") throw chargeStatusError(charge);
  if (billing.billingStatus === "CLOSED") {
    throw new BillingChargeError(
      "Closed Billing requires explicit financial reconciliation before diagnostic cancellation",
      409,
    );
  }
  if (lineItem.financialStatus !== "ACTIVE") {
    throw new BillingChargeError(
      "Diagnostic Billing line is already void",
      409,
    );
  }

  const now = new Date();
  const requiresReconciliation =
    currentItemStatus === "IN_PROGRESS" || lineItem.paymentStatus === "PAID";
  const targetStatus = requiresReconciliation
    ? "RECONCILIATION_REQUIRED"
    : "VOID";
  const auditUpdate = requiresReconciliation
    ? {
        status: targetStatus,
        reconciliationRequiredBy: actorId,
        reconciliationRequiredAt: now,
        reconciliationReason: cancellationReason,
        updatedBy: actorId,
      }
    : {
        status: targetStatus,
        voidedBy: actorId,
        voidedAt: now,
        voidReason: cancellationReason,
        updatedBy: actorId,
      };

  const updatedCharge = await Charge.findOneAndUpdate(
    { _id: charge._id, status: "ACTIVE" },
    { $set: auditUpdate },
    { returnDocument: "after", runValidators: true, session },
  );
  if (!updatedCharge) {
    throw new BillingChargeError(
      "Diagnostic Charge changed before cancellation could be saved",
      409,
    );
  }
  await updatedCharge.validate();

  if (!requiresReconciliation) {
    lineItem.financialStatus = "VOID";
    lineItem.paymentStatus = "PENDING_PAYMENT";
    applyCalculation(billing);
    billing.updatedBy = actorId;
    await billing.save({ session });
  }

  return targetStatus;
}
