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
import Charge, {
  CHARGE_SOURCE_TYPES,
  type ICharge,
} from "@/models/Charge";
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

export type ValidatedChargeBillingLink = ChargeContext;

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
  if (billing.billingStatus !== "OPEN") {
    throw new BillingChargeError(
      "Closed Billing cannot receive new diagnostic charges",
      409,
    );
  }
  await validateBillingChargeInvariants(billing, session);

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
  await validateBillingChargeInvariants(billing, session);
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

export function isDuplicateChargeBillingLineError(error: unknown): boolean {
  const candidate = duplicateKeyCandidate(error);
  if (!candidate || candidate.code !== 11000) return false;

  return (
    (candidate.keyPattern?.billingId === 1 &&
      candidate.keyPattern?.billingLineItemId === 1) ||
    (typeof candidate.message === "string" &&
      candidate.message.includes("unique_charge_billing_line"))
  );
}

export function isDuplicateChargeIdentityError(error: unknown): boolean {
  return (
    isDuplicateChargeSourceError(error) ||
    isDuplicateChargeBillingLineError(error)
  );
}

export function isChargeBackedInvoiceLine(
  lineItem: IBillingLineItem,
): lineItem is IBillingLineItem & { chargeId: mongoose.Types.ObjectId } {
  return lineItem.chargeId instanceof mongoose.Types.ObjectId;
}

function consistencyError(message: string): never {
  throw new BillingChargeError(
    `Invoice Charge consistency error: ${message}`,
    409,
  );
}

function effectiveFinancialStatus(
  lineItem: IBillingLineItem,
): "ACTIVE" | "VOID" {
  return lineItem.financialStatus ?? "ACTIVE";
}

function validateReciprocalState(
  charge: ICharge,
  lineItem: IBillingLineItem,
): void {
  const lineStatus = effectiveFinancialStatus(lineItem);
  if (charge.status === "ACTIVE" && lineStatus !== "ACTIVE") {
    consistencyError("an ACTIVE Charge points to a VOID Billing line");
  }
  if (charge.status === "VOID" && lineStatus !== "VOID") {
    consistencyError("a VOID Charge points to an ACTIVE Billing line");
  }
  if (
    charge.status === "RECONCILIATION_REQUIRED" &&
    lineStatus !== "ACTIVE"
  ) {
    consistencyError(
      "a reconciliation-required Charge lost its active historical Billing line",
    );
  }
}

function validateHistoricalSnapshot(
  charge: ICharge,
  lineItem: IBillingLineItem,
): void {
  if (
    lineItem.serviceCode !== charge.serviceCode ||
    lineItem.category !== charge.category ||
    lineItem.description !== charge.description ||
    lineItem.quantity !== charge.quantity ||
    lineItem.unitPrice !== charge.unitPrice ||
    lineItem.amount !== charge.amount ||
    lineItem.isCoveredByInsurance !== charge.isCoveredByInsurance ||
    !lineItem.addedBy.equals(charge.createdBy)
  ) {
    consistencyError(
      "a Charge and its Billing line have different historical snapshots",
    );
  }
}

export async function validateBillingChargeInvariants(
  billing: IBilling,
  session: ClientSession,
): Promise<ValidatedChargeBillingLink[]> {
  const chargeBackedLines = billing.lineItems.filter(isChargeBackedInvoiceLine);
  const linesByChargeId = new Map<string, IBillingLineItem[]>();

  for (const lineItem of chargeBackedLines) {
    const chargeId = lineItem.chargeId.toString();
    const lines = linesByChargeId.get(chargeId) ?? [];
    lines.push(lineItem);
    linesByChargeId.set(chargeId, lines);
    if (lines.length > 1) {
      consistencyError("multiple Billing lines reference the same Charge");
    }
  }

  const chargeIds = [...linesByChargeId.keys()].map(
    (value) => new mongoose.Types.ObjectId(value),
  );
  const relatedCharges = await Charge.find(
    chargeIds.length > 0
      ? {
          $or: [
            { billingId: billing._id },
            { _id: { $in: chargeIds } },
          ],
        }
      : { billingId: billing._id },
  ).session(session);
  const chargesById = new Map(
    relatedCharges.map((charge) => [charge._id.toString(), charge]),
  );

  for (const lineItem of chargeBackedLines) {
    const charge = chargesById.get(lineItem.chargeId.toString());
    if (!charge) {
      consistencyError("a Charge-backed Billing line references a missing Charge");
    }
    if (!charge.billingId.equals(billing._id)) {
      consistencyError("a Billing line references a Charge owned by another invoice");
    }
    if (!charge.billingLineItemId.equals(lineItem._id)) {
      consistencyError("Charge.billingLineItemId does not match its Billing line");
    }
    validateReciprocalState(charge, lineItem);
    validateHistoricalSnapshot(charge, lineItem);
  }

  for (const charge of relatedCharges) {
    if (!charge.billingId.equals(billing._id)) continue;
    if (!CHARGE_SOURCE_TYPES.includes(charge.sourceType)) {
      consistencyError("a Charge has an unsupported source identity");
    }
    const lines = linesByChargeId.get(charge._id.toString()) ?? [];
    if (lines.length !== 1) {
      consistencyError("a Charge references a missing Billing line");
    }
    const [lineItem] = lines;
    if (!charge.billingLineItemId.equals(lineItem._id)) {
      consistencyError("Charge.billingLineItemId does not match its Billing line");
    }
  }

  if (relatedCharges.length > 0) {
    const sourceConditions = relatedCharges.map((charge) => ({
      sourceType: charge.sourceType,
      sourceId: charge.sourceId,
    }));
    const sourceMatches = await Charge.find({ $or: sourceConditions })
      .select("sourceType sourceId")
      .session(session);
    const sourceCounts = new Map<string, number>();
    for (const charge of sourceMatches) {
      const key = `${charge.sourceType}:${charge.sourceId.toString()}`;
      const count = (sourceCounts.get(key) ?? 0) + 1;
      sourceCounts.set(key, count);
      if (count > 1) {
        consistencyError("duplicate Charge source identity was detected");
      }
    }
  }

  return chargeBackedLines.map((lineItem) => ({
    charge: chargesById.get(lineItem.chargeId.toString())!,
    billing,
    lineItem,
  }));
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

  const links = await validateBillingChargeInvariants(billing, session);
  const link = links.find(({ charge: linkedCharge }) =>
    linkedCharge._id.equals(charge._id),
  );
  if (!link) {
    throw new BillingChargeError(
      "Diagnostic Charge does not match exactly one Billing line",
      409,
    );
  }

  return link;
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
  }

  await validateBillingChargeInvariants(billing, session);
  billing.updatedBy = actorId;
  // A reconciliation-only transition does not change line totals, but it must
  // still write the Billing document so it conflicts safely with invoice close.
  billing.updatedAt = now;
  await billing.save({ session });

  return targetStatus;
}
