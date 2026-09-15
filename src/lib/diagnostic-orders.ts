import "server-only";

import mongoose, { type ClientSession } from "mongoose";
import type { AuthenticatedUser } from "@/lib/auth";
import {
  BillingChargeError,
  createDiagnosticCharges,
  isDuplicateChargeIdentityError,
  loadOpenDiagnosticBilling,
  prepareDiagnosticBillingPersistence,
  resolveDiagnosticServices,
} from "@/lib/billing-charges";
import {
  calculateDiagnosticOrderStatus,
  isDiagnosticPriority,
  isDiagnosticStatus,
  isDiagnosticType,
  parseDiagnosticTimestampWithTimezone,
  type DiagnosticPriority,
  type DiagnosticStatus,
  type DiagnosticType,
} from "@/lib/diagnostic";
import type { Role } from "@/lib/roles";
import DiagnosticOrder from "@/models/DiagnosticOrder";
import DiagnosticOrderItem from "@/models/DiagnosticOrderItem";
import MedicalVisit from "@/models/MedicalVisit";
import Patient from "@/models/Patient";
import User from "@/models/User";

const SERVICE_CODE_PATTERN = /^[A-Z0-9]+(?:[-_.][A-Z0-9]+)*$/;
const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MAX_ITEMS_PER_ORDER = 100;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export const DIAGNOSTIC_ORDER_CREATE_ROLES = ["DOCTOR"] as const;
export const DIAGNOSTIC_ORDER_READ_ROLES = [
  "ADMIN",
  "DOCTOR",
  "STAFF",
] as const;

export interface DiagnosticOrderItemInput {
  serviceCode: string;
  serviceName: string;
  notes?: string;
}

export interface CreateDiagnosticOrderInput {
  medicalVisitId: string;
  type: DiagnosticType;
  clinicalIndication: string;
  priority: DiagnosticPriority;
  notes?: string;
  items: DiagnosticOrderItemInput[];
}

export interface DiagnosticOrderListInput {
  patientId?: string;
  medicalVisitId?: string;
  type?: DiagnosticType;
  status?: DiagnosticStatus;
  orderedByDoctorId?: string;
  from?: Date;
  to?: Date;
  page: number;
  limit: number;
}

export class DiagnosticOrderError extends Error {
  readonly status: 400 | 403 | 404 | 409;

  constructor(message: string, status: 400 | 403 | 404 | 409) {
    super(message);
    this.name = "DiagnosticOrderError";
    this.status = status;
  }
}

function hasRole<T extends Role>(
  role: Role,
  allowedRoles: readonly T[],
): role is T {
  return allowedRoles.some((allowedRole) => allowedRole === role);
}

export function canCreateDiagnosticOrder(role: Role): boolean {
  return hasRole(role, DIAGNOSTIC_ORDER_CREATE_ROLES);
}

export function canReadDiagnosticOrders(role: Role): boolean {
  return hasRole(role, DIAGNOSTIC_ORDER_READ_ROLES);
}

function optionalText(
  value: unknown,
  label: string,
  maximumLength: number,
): { value?: string } | { error: DiagnosticOrderError } {
  if (value === undefined) return {};
  if (typeof value !== "string") {
    return { error: new DiagnosticOrderError(`${label} must be a string`, 400) };
  }
  const normalized = value.trim();
  if (normalized.length > maximumLength) {
    return {
      error: new DiagnosticOrderError(
        `${label} must be ${maximumLength} characters or fewer`,
        400,
      ),
    };
  }
  return normalized ? { value: normalized } : {};
}

export function parseCreateDiagnosticOrderInput(
  value: unknown,
): { data: CreateDiagnosticOrderInput } | { error: DiagnosticOrderError } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { error: new DiagnosticOrderError("Invalid request body", 400) };
  }

  const body = value as Record<string, unknown>;
  const allowedFields = new Set([
    "medicalVisitId",
    "type",
    "clinicalIndication",
    "priority",
    "notes",
    "items",
  ]);
  if (
    !Object.keys(body).length ||
    Object.keys(body).some((key) => !allowedFields.has(key))
  ) {
    return {
      error: new DiagnosticOrderError(
        "Only diagnostic order request fields may be supplied",
        400,
      ),
    };
  }

  const medicalVisitId =
    typeof body.medicalVisitId === "string" ? body.medicalVisitId.trim() : "";
  if (!medicalVisitId || !mongoose.isValidObjectId(medicalVisitId)) {
    return {
      error: new DiagnosticOrderError("Invalid medical visit id", 400),
    };
  }
  if (!isDiagnosticType(body.type)) {
    return {
      error: new DiagnosticOrderError("Invalid diagnostic type", 400),
    };
  }

  const clinicalIndication =
    typeof body.clinicalIndication === "string"
      ? body.clinicalIndication.trim()
      : "";
  if (!clinicalIndication || clinicalIndication.length > 2_000) {
    return {
      error: new DiagnosticOrderError(
        "Clinical indication is required and must be 2000 characters or fewer",
        400,
      ),
    };
  }

  const priority = body.priority === undefined ? "ROUTINE" : body.priority;
  if (!isDiagnosticPriority(priority)) {
    return {
      error: new DiagnosticOrderError("Invalid diagnostic priority", 400),
    };
  }
  const notes = optionalText(body.notes, "Notes", 2_000);
  if ("error" in notes) return notes;

  if (
    !Array.isArray(body.items) ||
    body.items.length < 1 ||
    body.items.length > MAX_ITEMS_PER_ORDER
  ) {
    return {
      error: new DiagnosticOrderError(
        `Diagnostic orders require between 1 and ${MAX_ITEMS_PER_ORDER} items`,
        400,
      ),
    };
  }

  const items: DiagnosticOrderItemInput[] = [];
  const serviceCodes = new Set<string>();
  for (const valueItem of body.items) {
    if (!valueItem || typeof valueItem !== "object" || Array.isArray(valueItem)) {
      return {
        error: new DiagnosticOrderError("Invalid diagnostic order item", 400),
      };
    }
    const item = valueItem as Record<string, unknown>;
    const allowedItemFields = new Set(["serviceCode", "serviceName", "notes"]);
    if (
      Object.keys(item).some((key) => !allowedItemFields.has(key)) ||
      typeof item.serviceCode !== "string" ||
      typeof item.serviceName !== "string"
    ) {
      return {
        error: new DiagnosticOrderError("Invalid diagnostic order item", 400),
      };
    }

    const serviceCode = item.serviceCode.trim().toUpperCase();
    if (
      !serviceCode ||
      serviceCode.length > 64 ||
      !SERVICE_CODE_PATTERN.test(serviceCode)
    ) {
      return {
        error: new DiagnosticOrderError(
          "Service codes must contain only letters, numbers, hyphens, underscores, or periods",
          400,
        ),
      };
    }
    if (serviceCodes.has(serviceCode)) {
      return {
        error: new DiagnosticOrderError(
          `Duplicate service code in diagnostic order: ${serviceCode}`,
          409,
        ),
      };
    }

    const serviceName = item.serviceName.trim();
    if (!serviceName || serviceName.length > 200) {
      return {
        error: new DiagnosticOrderError(
          "Service name is required and must be 200 characters or fewer",
          400,
        ),
      };
    }
    const itemNotes = optionalText(item.notes, "Item notes", 2_000);
    if ("error" in itemNotes) return itemNotes;

    serviceCodes.add(serviceCode);
    items.push({
      serviceCode,
      serviceName,
      ...(itemNotes.value ? { notes: itemNotes.value } : {}),
    });
  }

  return {
    data: {
      medicalVisitId: new mongoose.Types.ObjectId(medicalVisitId).toString(),
      type: body.type,
      clinicalIndication,
      priority,
      ...(notes.value ? { notes: notes.value } : {}),
      items,
    },
  };
}

function parsePositiveInteger(
  value: string | null,
  fallback: number,
  maximum: number,
): number | DiagnosticOrderError {
  if (value === null) return fallback;
  if (!/^\d+$/.test(value)) {
    return new DiagnosticOrderError(
      "Pagination values must be positive integers",
      400,
    );
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) {
    return new DiagnosticOrderError("Pagination value is out of range", 400);
  }
  return parsed;
}

function parseObjectIdFilter(
  value: string | null,
  label: string,
): string | undefined | DiagnosticOrderError {
  if (value === null) return undefined;
  const normalized = value.trim();
  if (!normalized || !mongoose.isValidObjectId(normalized)) {
    return new DiagnosticOrderError(`Invalid ${label}`, 400);
  }
  return new mongoose.Types.ObjectId(normalized).toString();
}

function parseDateFilter(
  value: string | null,
  label: string,
  endOfDay: boolean,
): Date | undefined | DiagnosticOrderError {
  if (value === null) return undefined;
  const normalized = value.trim();
  if (!normalized || normalized.length > 50) {
    return new DiagnosticOrderError(`Invalid ${label}`, 400);
  }

  const dateOnlyMatch = DATE_ONLY_PATTERN.exec(normalized);
  const timestamp = dateOnlyMatch
    ? null
    : parseDiagnosticTimestampWithTimezone(normalized);
  if (!dateOnlyMatch && !timestamp) {
    return new DiagnosticOrderError(
      `Invalid ${label}; use YYYY-MM-DD (UTC) or an ISO timestamp with timezone`,
      400,
    );
  }

  if (dateOnlyMatch) {
    const [, yearText, monthText, dayText] = dateOnlyMatch;
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const calendarDate = new Date(Date.UTC(year, month - 1, day));
    if (
      calendarDate.getUTCFullYear() !== year ||
      calendarDate.getUTCMonth() !== month - 1 ||
      calendarDate.getUTCDate() !== day
    ) {
      return new DiagnosticOrderError(`Invalid ${label}`, 400);
    }
  }

  const date = dateOnlyMatch
    ? new Date(
        `${normalized}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`,
      )
    : timestamp;
  if (!date) return new DiagnosticOrderError(`Invalid ${label}`, 400);
  if (Number.isNaN(date.getTime())) {
    return new DiagnosticOrderError(`Invalid ${label}`, 400);
  }
  return date;
}

export function isDiagnosticDuplicateServiceError(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return false;
  }
  const candidate = error as {
    code?: unknown;
    keyPattern?: Record<string, unknown>;
    message?: unknown;
  };
  if (candidate.code !== 11000) return false;

  return (
    (candidate.keyPattern?.diagnosticOrderId === 1 &&
      candidate.keyPattern?.serviceCode === 1) ||
    (typeof candidate.message === "string" &&
      candidate.message.includes("unique_service_code_per_diagnostic_order"))
  );
}

export function parseDiagnosticOrderListInput(
  searchParams: URLSearchParams,
): { data: DiagnosticOrderListInput } | { error: DiagnosticOrderError } {
  const patientId = parseObjectIdFilter(
    searchParams.get("patientId"),
    "patient id",
  );
  const medicalVisitId = parseObjectIdFilter(
    searchParams.get("medicalVisitId"),
    "medical visit id",
  );
  const orderedByDoctorId = parseObjectIdFilter(
    searchParams.get("orderedByDoctorId"),
    "ordering doctor id",
  );
  const from = parseDateFilter(searchParams.get("from"), "from date", false);
  const to = parseDateFilter(searchParams.get("to"), "to date", true);
  const page = parsePositiveInteger(searchParams.get("page"), 1, 1_000_000);
  const limit = parsePositiveInteger(
    searchParams.get("limit"),
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
  );

  for (const parsed of [
    patientId,
    medicalVisitId,
    orderedByDoctorId,
    from,
    to,
    page,
    limit,
  ]) {
    if (parsed instanceof DiagnosticOrderError) return { error: parsed };
  }

  const typeValue = searchParams.get("type")?.trim();
  let type: DiagnosticType | undefined;
  if (typeValue) {
    if (!isDiagnosticType(typeValue)) {
      return {
        error: new DiagnosticOrderError("Invalid diagnostic type", 400),
      };
    }
    type = typeValue;
  }
  const statusValue = searchParams.get("status")?.trim();
  let status: DiagnosticStatus | undefined;
  if (statusValue) {
    if (!isDiagnosticStatus(statusValue)) {
      return {
        error: new DiagnosticOrderError("Invalid diagnostic status", 400),
      };
    }
    status = statusValue;
  }
  if (from instanceof Date && to instanceof Date && from > to) {
    return {
      error: new DiagnosticOrderError(
        "From date must not be later than to date",
        400,
      ),
    };
  }

  return {
    data: {
      ...(typeof patientId === "string" ? { patientId } : {}),
      ...(typeof medicalVisitId === "string" ? { medicalVisitId } : {}),
      ...(type ? { type } : {}),
      ...(status ? { status } : {}),
      ...(typeof orderedByDoctorId === "string"
        ? { orderedByDoctorId }
        : {}),
      ...(from instanceof Date ? { from } : {}),
      ...(to instanceof Date ? { to } : {}),
      page: page as number,
      limit: limit as number,
    },
  };
}

type DiagnosticOrderRecord = {
  _id: mongoose.Types.ObjectId;
  medicalVisitId: mongoose.Types.ObjectId;
  patientId: mongoose.Types.ObjectId;
  orderedByDoctorId: mongoose.Types.ObjectId;
  orderedByDoctorName: string;
  type: DiagnosticType;
  clinicalIndication: string;
  priority: DiagnosticPriority;
  status: DiagnosticStatus;
  notes?: string;
  orderedAt: Date;
  updatedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

type DiagnosticOrderItemRecord = {
  _id: mongoose.Types.ObjectId;
  diagnosticOrderId: mongoose.Types.ObjectId;
  type: DiagnosticType;
  serviceCode: string;
  serviceName: string;
  status: DiagnosticStatus;
  notes?: string;
  scheduledAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  performedBy?: mongoose.Types.ObjectId;
  cancellationReason?: string;
  cancelledAt?: Date;
  cancelledBy?: mongoose.Types.ObjectId;
  updatedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

function serializeOrder(order: DiagnosticOrderRecord) {
  return {
    id: order._id.toString(),
    medicalVisitId: order.medicalVisitId.toString(),
    patientId: order.patientId.toString(),
    orderedByDoctor: {
      id: order.orderedByDoctorId.toString(),
      name: order.orderedByDoctorName,
    },
    type: order.type,
    clinicalIndication: order.clinicalIndication,
    priority: order.priority,
    status: order.status,
    notes: order.notes ?? null,
    orderedAt: order.orderedAt.toISOString(),
    updatedBy: order.updatedBy.toString(),
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}

function serializeItem(item: DiagnosticOrderItemRecord) {
  return {
    id: item._id.toString(),
    diagnosticOrderId: item.diagnosticOrderId.toString(),
    type: item.type,
    serviceCode: item.serviceCode,
    serviceName: item.serviceName,
    status: item.status,
    notes: item.notes ?? null,
    scheduledAt: item.scheduledAt?.toISOString() ?? null,
    startedAt: item.startedAt?.toISOString() ?? null,
    completedAt: item.completedAt?.toISOString() ?? null,
    performedBy: item.performedBy?.toString() ?? null,
    cancellationReason: item.cancellationReason ?? null,
    cancelledAt: item.cancelledAt?.toISOString() ?? null,
    cancelledBy: item.cancelledBy?.toString() ?? null,
    updatedBy: item.updatedBy.toString(),
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

function assertReadAccess(
  user: AuthenticatedUser,
  order: Pick<DiagnosticOrderRecord, "orderedByDoctorId">,
): void {
  if (!canReadDiagnosticOrders(user.role)) {
    throw new DiagnosticOrderError(
      "Forbidden: diagnostic order access denied",
      403,
    );
  }
  if (
    user.role === "DOCTOR" &&
    order.orderedByDoctorId.toString() !== user.id
  ) {
    throw new DiagnosticOrderError(
      "Forbidden: diagnostic order access denied",
      403,
    );
  }
}

async function prepareDiagnosticPersistence(): Promise<void> {
  await Promise.all([
    DiagnosticOrder.init(),
    DiagnosticOrderItem.init(),
    prepareDiagnosticBillingPersistence(),
  ]);
}

async function inDiagnosticTransaction<T>(
  work: (session: ClientSession) => Promise<T>,
): Promise<T> {
  await prepareDiagnosticPersistence();
  const session = await mongoose.startSession();
  try {
    const result = await session.withTransaction(() => work(session));
    if (result === undefined) {
      throw new Error("Diagnostic transaction did not return a result");
    }
    return result;
  } finally {
    await session.endSession();
  }
}

export async function createDiagnosticOrder(
  user: AuthenticatedUser,
  input: CreateDiagnosticOrderInput,
) {
  if (!canCreateDiagnosticOrder(user.role)) {
    throw new DiagnosticOrderError(
      "Forbidden: only the assigned doctor can create diagnostic orders",
      403,
    );
  }
  if (!mongoose.isValidObjectId(user.id)) {
    throw new DiagnosticOrderError("Invalid authenticated user id", 400);
  }

  const medicalVisitId = new mongoose.Types.ObjectId(input.medicalVisitId);
  const doctorId = new mongoose.Types.ObjectId(user.id);

  try {
    return await inDiagnosticTransaction(async (session) => {
      const doctor = await User.findOne({
        _id: doctorId,
        role: "DOCTOR",
        isActive: true,
      })
        .select("name")
        .session(session);
      if (!doctor) {
        throw new DiagnosticOrderError(
          "Active ordering doctor not found",
          403,
        );
      }

      const visit = await MedicalVisit.findById(medicalVisitId)
        .select("appointmentId patientId doctorId")
        .session(session);
      if (!visit) {
        throw new DiagnosticOrderError("Medical visit not found", 404);
      }
      if (visit.doctorId.toString() !== user.id) {
        throw new DiagnosticOrderError(
          "Forbidden: only the MedicalVisit doctor can create diagnostic orders",
          403,
        );
      }

      const patient = await Patient.findById(visit.patientId)
        .select("deletedAt")
        .session(session);
      if (!patient) {
        throw new DiagnosticOrderError("Patient not found", 404);
      }
      if (patient.deletedAt) {
        throw new DiagnosticOrderError(
          "Archived patients cannot receive new diagnostic orders",
          409,
        );
      }

      const billing = await loadOpenDiagnosticBilling({
        appointmentId: visit.appointmentId,
        patientId: visit.patientId,
        doctorId,
        session,
      });
      const servicesByCode = await resolveDiagnosticServices(
        input.items.map(({ serviceCode }) => serviceCode),
        input.type,
        session,
      );
      const resolvedItems = input.items.map((item) => {
        const service = servicesByCode.get(item.serviceCode);
        if (!service) {
          throw new BillingChargeError(
            `Diagnostic service ${item.serviceCode} could not be resolved`,
            409,
          );
        }
        return { request: item, service };
      });

      const initialItemStatuses = input.items.map(() => "ORDERED" as const);
      const [order] = await DiagnosticOrder.create(
        [
          {
            medicalVisitId,
            patientId: visit.patientId,
            orderedByDoctorId: doctorId,
            orderedByDoctorName: doctor.name,
            type: input.type,
            clinicalIndication: input.clinicalIndication,
            priority: input.priority,
            status: calculateDiagnosticOrderStatus(initialItemStatuses),
            ...(input.notes ? { notes: input.notes } : {}),
            updatedBy: doctorId,
          },
        ],
        { session, ordered: true },
      );
      if (!order) throw new Error("Diagnostic order was not created");

      const items = await DiagnosticOrderItem.create(
        resolvedItems.map(({ request, service }) => ({
          diagnosticOrderId: order._id,
          type: input.type,
          serviceCode: service.serviceCode,
          serviceName: service.serviceName,
          status: "ORDERED",
          ...(request.notes ? { notes: request.notes } : {}),
          updatedBy: doctorId,
        })),
        { session, ordered: true },
      );
      if (items.length !== input.items.length) {
        throw new Error("Not all diagnostic order items were created");
      }

      await createDiagnosticCharges(
        billing,
        items.map((item, index) => ({
          diagnosticOrderItemId: item._id,
          service: resolvedItems[index].service,
        })),
        doctorId,
        session,
      );

      return {
        ...serializeOrder(order.toObject() as DiagnosticOrderRecord),
        items: items.map((item) =>
          serializeItem(item.toObject() as DiagnosticOrderItemRecord),
        ),
      };
    });
  } catch (error) {
    if (error instanceof BillingChargeError) {
      throw new DiagnosticOrderError(error.message, error.status);
    }
    if (isDuplicateChargeIdentityError(error)) {
      throw new DiagnosticOrderError(
        "The diagnostic financial Charge identity already exists",
        409,
      );
    }
    if (isDiagnosticDuplicateServiceError(error)) {
      throw new DiagnosticOrderError(
        "A diagnostic order cannot contain duplicate service codes",
        409,
      );
    }
    throw error;
  }
}

export async function getDiagnosticOrder(
  idValue: string,
  user: AuthenticatedUser,
) {
  if (!mongoose.isValidObjectId(idValue)) {
    throw new DiagnosticOrderError("Invalid diagnostic order id", 400);
  }

  const order = (await DiagnosticOrder.findById(idValue)
    .select(
      "medicalVisitId patientId orderedByDoctorId orderedByDoctorName type clinicalIndication priority status notes orderedAt updatedBy createdAt updatedAt",
    )
    .lean()) as unknown as DiagnosticOrderRecord | null;
  if (!order) {
    throw new DiagnosticOrderError("Diagnostic order not found", 404);
  }
  assertReadAccess(user, order);

  const items = (await DiagnosticOrderItem.find({ diagnosticOrderId: order._id })
    .select(
      "diagnosticOrderId type serviceCode serviceName status notes scheduledAt startedAt completedAt performedBy cancellationReason cancelledAt cancelledBy updatedBy createdAt updatedAt",
    )
    .sort({ createdAt: 1 })
    .lean()) as unknown as DiagnosticOrderItemRecord[];

  return {
    ...serializeOrder(order),
    items: items.map(serializeItem),
  };
}

export async function listDiagnosticOrders(
  input: DiagnosticOrderListInput,
  user: AuthenticatedUser,
) {
  if (!canReadDiagnosticOrders(user.role)) {
    throw new DiagnosticOrderError(
      "Forbidden: diagnostic order access denied",
      403,
    );
  }
  if (
    user.role === "DOCTOR" &&
    input.orderedByDoctorId &&
    input.orderedByDoctorId !== user.id
  ) {
    throw new DiagnosticOrderError(
      "Forbidden: doctors may only list their own diagnostic orders",
      403,
    );
  }

  const filter: Record<string, unknown> = {};
  if (input.patientId) filter.patientId = input.patientId;
  if (input.medicalVisitId) filter.medicalVisitId = input.medicalVisitId;
  if (input.type) filter.type = input.type;
  if (input.status) filter.status = input.status;
  if (user.role === "DOCTOR") filter.orderedByDoctorId = user.id;
  else if (input.orderedByDoctorId) {
    filter.orderedByDoctorId = input.orderedByDoctorId;
  }
  if (input.from || input.to) {
    filter.orderedAt = {
      ...(input.from ? { $gte: input.from } : {}),
      ...(input.to ? { $lte: input.to } : {}),
    };
  }

  const total = await DiagnosticOrder.countDocuments(filter);
  const totalPages = Math.max(1, Math.ceil(total / input.limit));
  const page = Math.min(input.page, totalPages);
  const orders = (await DiagnosticOrder.find(filter)
    .select(
      "medicalVisitId patientId orderedByDoctorId orderedByDoctorName type clinicalIndication priority status notes orderedAt updatedBy createdAt updatedAt",
    )
    .sort({ orderedAt: -1, _id: -1 })
    .skip((page - 1) * input.limit)
    .limit(input.limit)
    .lean()) as unknown as DiagnosticOrderRecord[];

  return {
    items: orders.map(serializeOrder),
    pagination: { page, limit: input.limit, total, totalPages },
  };
}
