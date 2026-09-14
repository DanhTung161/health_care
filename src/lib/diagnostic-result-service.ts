import "server-only";

import mongoose, { type ClientSession } from "mongoose";
import type { AuthenticatedUser } from "@/lib/auth";
import {
  DIAGNOSTIC_RESULT_LIMITS,
  isLabResultInterpretation,
} from "@/lib/diagnostic-results";
import { isDiagnosticStatus, isDiagnosticType } from "@/lib/diagnostic";
import type { Role } from "@/lib/roles";
import DiagnosticOrder from "@/models/DiagnosticOrder";
import DiagnosticOrderItem from "@/models/DiagnosticOrderItem";
import ImagingResult, { type IImagingResult } from "@/models/ImagingResult";
import ImagingResultRevision, {
  type IImagingResultRevision,
} from "@/models/ImagingResultRevision";
import LabResult, { type ILabResult } from "@/models/LabResult";
import LabResultRevision, {
  type ILabAnalyteResult,
  type ILabResultRevision,
} from "@/models/LabResultRevision";
import User from "@/models/User";

const RESULT_READ_ROLES = ["ADMIN", "DOCTOR", "STAFF"] as const;
const DEFAULT_HISTORY_LIMIT = 50;
const MAX_HISTORY_LIMIT = 100;

type ResultType = "LAB" | "IMAGING";

export interface LabDraftContent {
  analytes: ILabAnalyteResult[];
  clinicalComment?: string;
}

export interface ImagingDraftContent {
  findings: string;
  impression: string;
  technique?: string;
  comparison?: string;
  recommendation?: string;
}

type ResultDraftContent = LabDraftContent | ImagingDraftContent;

export interface ResultHistoryInput {
  page: number;
  limit: number;
}

export interface ResultRevisionToken {
  revisionId: mongoose.Types.ObjectId;
  documentVersion: number;
}

export class DiagnosticResultError extends Error {
  readonly status: 400 | 403 | 404 | 409;

  constructor(message: string, status: 400 | 403 | 404 | 409) {
    super(message);
    this.name = "DiagnosticResultError";
    this.status = status;
  }
}

function hasRole<T extends Role>(
  role: Role,
  roles: readonly T[],
): role is T {
  return roles.some((allowedRole) => allowedRole === role);
}

export function canReadDiagnosticResults(role: Role): boolean {
  return hasRole(role, RESULT_READ_ROLES);
}

export function canMutateDiagnosticResults(role: Role): boolean {
  return role === "DOCTOR";
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertAllowedFields(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  label: string,
): void {
  const unsupported = Object.keys(value).find((field) => !allowed.has(field));
  if (unsupported) {
    throw new DiagnosticResultError(
      `Unsupported ${label} field: ${unsupported}`,
      400,
    );
  }
}

function requiredText(
  value: unknown,
  label: string,
  maximumLength: number,
  allowEmpty = false,
): string {
  if (typeof value !== "string") {
    throw new DiagnosticResultError(`${label} must be a string`, 400);
  }
  const normalized = value.trim();
  if ((!allowEmpty && !normalized) || normalized.length > maximumLength) {
    throw new DiagnosticResultError(
      allowEmpty
        ? `${label} must not exceed ${maximumLength} characters`
        : `${label} must be between 1 and ${maximumLength} characters`,
      400,
    );
  }
  return normalized;
}

function optionalText(
  value: unknown,
  label: string,
  maximumLength: number,
): string | undefined {
  if (value === undefined) return undefined;
  const normalized = requiredText(value, label, maximumLength, true);
  return normalized || undefined;
}

function parseLabDraftContent(value: unknown): LabDraftContent {
  if (!isPlainObject(value)) {
    throw new DiagnosticResultError("Invalid Lab result request body", 400);
  }
  assertAllowedFields(
    value,
    new Set(["analytes", "clinicalComment"]),
    "Lab result",
  );
  if (!Array.isArray(value.analytes)) {
    throw new DiagnosticResultError("analytes must be an array", 400);
  }
  if (value.analytes.length > DIAGNOSTIC_RESULT_LIMITS.maxLabAnalytes) {
    throw new DiagnosticResultError(
      `Lab results support at most ${DIAGNOSTIC_RESULT_LIMITS.maxLabAnalytes} analytes`,
      400,
    );
  }

  const analytes = value.analytes.map((analyte, index) => {
    if (!isPlainObject(analyte)) {
      throw new DiagnosticResultError(
        `Invalid analyte at index ${index}`,
        400,
      );
    }
    assertAllowedFields(
      analyte,
      new Set([
        "code",
        "name",
        "value",
        "unit",
        "referenceRange",
        "interpretation",
      ]),
      `analyte at index ${index}`,
    );
    if (
      analyte.interpretation !== undefined &&
      !isLabResultInterpretation(analyte.interpretation)
    ) {
      throw new DiagnosticResultError(
        `Invalid interpretation at analyte index ${index}`,
        400,
      );
    }

    const code = optionalText(
      analyte.code,
      `analyte code at index ${index}`,
      DIAGNOSTIC_RESULT_LIMITS.analyteCode,
    );
    const unit = optionalText(
      analyte.unit,
      `analyte unit at index ${index}`,
      DIAGNOSTIC_RESULT_LIMITS.analyteUnit,
    );
    const referenceRange = optionalText(
      analyte.referenceRange,
      `analyte referenceRange at index ${index}`,
      DIAGNOSTIC_RESULT_LIMITS.referenceRange,
    );

    return {
      ...(code ? { code } : {}),
      name: requiredText(
        analyte.name,
        `analyte name at index ${index}`,
        DIAGNOSTIC_RESULT_LIMITS.analyteName,
      ),
      value: requiredText(
        analyte.value,
        `analyte value at index ${index}`,
        DIAGNOSTIC_RESULT_LIMITS.analyteValue,
      ),
      ...(unit ? { unit } : {}),
      ...(referenceRange ? { referenceRange } : {}),
      interpretation: isLabResultInterpretation(analyte.interpretation)
        ? analyte.interpretation
        : "UNKNOWN",
    } satisfies ILabAnalyteResult;
  });

  const clinicalComment = optionalText(
    value.clinicalComment,
    "clinicalComment",
    DIAGNOSTIC_RESULT_LIMITS.clinicalComment,
  );
  return {
    analytes,
    ...(clinicalComment ? { clinicalComment } : {}),
  };
}

function parseImagingDraftContent(value: unknown): ImagingDraftContent {
  if (!isPlainObject(value)) {
    throw new DiagnosticResultError(
      "Invalid Imaging result request body",
      400,
    );
  }
  assertAllowedFields(
    value,
    new Set([
      "findings",
      "impression",
      "technique",
      "comparison",
      "recommendation",
    ]),
    "Imaging result",
  );

  const technique = optionalText(
    value.technique,
    "technique",
    DIAGNOSTIC_RESULT_LIMITS.imagingOptionalSection,
  );
  const comparison = optionalText(
    value.comparison,
    "comparison",
    DIAGNOSTIC_RESULT_LIMITS.imagingOptionalSection,
  );
  const recommendation = optionalText(
    value.recommendation,
    "recommendation",
    DIAGNOSTIC_RESULT_LIMITS.imagingOptionalSection,
  );

  return {
    findings: requiredText(
      value.findings,
      "findings",
      DIAGNOSTIC_RESULT_LIMITS.imagingFindings,
      true,
    ),
    impression: requiredText(
      value.impression,
      "impression",
      DIAGNOSTIC_RESULT_LIMITS.imagingImpression,
      true,
    ),
    ...(technique ? { technique } : {}),
    ...(comparison ? { comparison } : {}),
    ...(recommendation ? { recommendation } : {}),
  };
}

function parseDraftContent(
  type: ResultType,
  value: unknown,
): ResultDraftContent {
  return type === "LAB"
    ? parseLabDraftContent(value)
    : parseImagingDraftContent(value);
}

export function parseCorrectionReason(value: unknown): string {
  if (!isPlainObject(value)) {
    throw new DiagnosticResultError("Invalid correction request body", 400);
  }
  assertAllowedFields(value, new Set(["correctionReason"]), "correction");
  return requiredText(
    value.correctionReason,
    "correctionReason",
    DIAGNOSTIC_RESULT_LIMITS.correctionReason,
  );
}

export function parseResultRevisionToken(
  value: string | null,
): ResultRevisionToken {
  if (!value) {
    throw new DiagnosticResultError(
      "If-Match revision token is required",
      400,
    );
  }
  const match = value.trim().match(/^"([a-fA-F0-9]{24}):(\d+)"$/);
  if (!match) {
    throw new DiagnosticResultError("Invalid If-Match revision token", 400);
  }
  const [, revisionId, documentVersionValue] = match;
  if (!mongoose.isValidObjectId(revisionId)) {
    throw new DiagnosticResultError("Invalid If-Match revision token", 400);
  }
  const documentVersion = Number(documentVersionValue);
  if (!Number.isSafeInteger(documentVersion) || documentVersion < 0) {
    throw new DiagnosticResultError("Invalid If-Match revision token", 400);
  }
  return {
    revisionId: new mongoose.Types.ObjectId(revisionId),
    documentVersion,
  };
}

function parseHistoryInteger(
  value: string | null,
  fallback: number,
  maximum: number,
  label: string,
): number {
  if (value === null || value === "") return fallback;
  if (!/^\d+$/.test(value)) {
    throw new DiagnosticResultError(`Invalid history ${label}`, 400);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new DiagnosticResultError(`Invalid history ${label}`, 400);
  }
  return parsed;
}

export function parseResultHistoryInput(
  searchParams: URLSearchParams,
): ResultHistoryInput {
  return {
    page: parseHistoryInteger(
      searchParams.get("page"),
      1,
      Number.MAX_SAFE_INTEGER,
      "page",
    ),
    limit: parseHistoryInteger(
      searchParams.get("limit"),
      DEFAULT_HISTORY_LIMIT,
      MAX_HISTORY_LIMIT,
      "limit",
    ),
  };
}

function validateIdentifiers(
  orderIdValue: string,
  itemIdValue: string,
): { orderId: mongoose.Types.ObjectId; itemId: mongoose.Types.ObjectId } {
  if (!mongoose.isValidObjectId(orderIdValue)) {
    throw new DiagnosticResultError("Invalid diagnostic order id", 400);
  }
  if (!mongoose.isValidObjectId(itemIdValue)) {
    throw new DiagnosticResultError("Invalid diagnostic order item id", 400);
  }
  return {
    orderId: new mongoose.Types.ObjectId(orderIdValue),
    itemId: new mongoose.Types.ObjectId(itemIdValue),
  };
}

async function revalidateMutationActor(
  user: AuthenticatedUser,
  session: ClientSession,
): Promise<mongoose.Types.ObjectId> {
  if (!canMutateDiagnosticResults(user.role)) {
    throw new DiagnosticResultError(
      "Forbidden: Result clinical mutation is limited to the assigned doctor",
      403,
    );
  }
  if (!mongoose.isValidObjectId(user.id)) {
    throw new DiagnosticResultError("Invalid authenticated user id", 400);
  }
  const actorId = new mongoose.Types.ObjectId(user.id);
  const actor = await User.findOne({
    _id: actorId,
    role: user.role,
    isActive: true,
  })
    .select("_id role")
    .session(session);
  if (!actor) {
    throw new DiagnosticResultError(
      "Forbidden: active Result workflow actor not found",
      403,
    );
  }
  return actorId;
}

async function loadResultContext(
  orderId: mongoose.Types.ObjectId,
  itemId: mongoose.Types.ObjectId,
  user: AuthenticatedUser,
  operation: "read" | "mutate",
  session?: ClientSession,
) {
  if (!mongoose.isValidObjectId(user.id)) {
    throw new DiagnosticResultError("Invalid authenticated user id", 400);
  }
  if (operation === "read" && !canReadDiagnosticResults(user.role)) {
    throw new DiagnosticResultError("Forbidden: Result access denied", 403);
  }
  if (operation === "mutate" && !canMutateDiagnosticResults(user.role)) {
    throw new DiagnosticResultError(
      "Forbidden: Result clinical mutation is limited to the assigned doctor",
      403,
    );
  }

  const order = await DiagnosticOrder.findById(orderId)
    .select("_id orderedByDoctorId")
    .session(session ?? null);
  if (!order) {
    throw new DiagnosticResultError("Diagnostic order not found", 404);
  }
  if (
    user.role === "DOCTOR" &&
    !order.orderedByDoctorId.equals(new mongoose.Types.ObjectId(user.id))
  ) {
    throw new DiagnosticResultError(
      "Forbidden: doctors may only access Results for their own diagnostic orders",
      403,
    );
  }

  const item = await DiagnosticOrderItem.findById(itemId)
    .select("_id diagnosticOrderId type status")
    .session(session ?? null);
  if (!item || !item.diagnosticOrderId.equals(orderId)) {
    throw new DiagnosticResultError(
      "Diagnostic order item not found for this order",
      404,
    );
  }
  if (!isDiagnosticType(item.type) || !isDiagnosticStatus(item.status)) {
    throw new DiagnosticResultError(
      "Diagnostic order item has invalid stored workflow data",
      409,
    );
  }

  return { order, item, type: item.type as ResultType };
}

async function prepareResultPersistence(): Promise<void> {
  await Promise.all([
    LabResult.init(),
    LabResultRevision.init(),
    ImagingResult.init(),
    ImagingResultRevision.init(),
  ]);
}

async function inResultTransaction<T>(
  work: (session: ClientSession) => Promise<T>,
): Promise<T> {
  await prepareResultPersistence();
  const session = await mongoose.startSession();
  try {
    const result = await session.withTransaction(() => work(session));
    if (result === undefined) {
      throw new Error("Result transaction did not return a result");
    }
    return result;
  } finally {
    await session.endSession();
  }
}

type DuplicateKeyError = {
  code?: unknown;
  keyPattern?: Record<string, unknown>;
};

function translateDuplicateResultError(error: unknown): never {
  const candidate = error as DuplicateKeyError;
  if (candidate?.code !== 11000) throw error;

  if (candidate.keyPattern?.diagnosticOrderItemId === 1) {
    throw new DiagnosticResultError(
      "A Result already exists for this diagnostic order item",
      409,
    );
  }
  if (
    candidate.keyPattern?.version === 1 &&
    (candidate.keyPattern?.labResultId === 1 ||
      candidate.keyPattern?.imagingResultId === 1)
  ) {
    throw new DiagnosticResultError(
      "Result revision version conflicts with an existing revision",
      409,
    );
  }
  throw new DiagnosticResultError(
    "Result data conflicts with an existing record",
    409,
  );
}

function revisionToken(
  revision: ILabResultRevision | IImagingResultRevision,
): string {
  const documentVersion = revision.get("__v");
  if (
    typeof documentVersion !== "number" ||
    !Number.isSafeInteger(documentVersion) ||
    documentVersion < 0
  ) {
    throw new Error("Result revision has an invalid concurrency version");
  }
  return `${revision._id.toString()}:${documentVersion}`;
}

function serializeLogical(
  type: ResultType,
  result: ILabResult | IImagingResult,
) {
  return {
    id: result._id.toString(),
    diagnosticOrderItemId: result.diagnosticOrderItemId.toString(),
    resultType: type,
    latestRevisionVersion: result.latestRevisionVersion,
    currentFinalVersion: result.currentFinalVersion ?? null,
    createdBy: result.createdBy.toString(),
    updatedBy: result.updatedBy.toString(),
    createdAt: result.createdAt.toISOString(),
    updatedAt: result.updatedAt.toISOString(),
  };
}

function serializeLabRevision(revision: ILabResultRevision) {
  return {
    id: revision._id.toString(),
    version: revision.version,
    status: revision.status,
    analytes: revision.analytes.map((analyte) => ({
      code: analyte.code ?? null,
      name: analyte.name,
      value: analyte.value,
      unit: analyte.unit ?? null,
      referenceRange: analyte.referenceRange ?? null,
      interpretation: analyte.interpretation,
    })),
    clinicalComment: revision.clinicalComment ?? null,
    correctsRevisionId: revision.correctsRevisionId?.toString() ?? null,
    correctionReason: revision.correctionReason ?? null,
    createdBy: revision.createdBy.toString(),
    updatedBy: revision.updatedBy.toString(),
    finalizedBy: revision.finalizedBy?.toString() ?? null,
    finalizedAt: revision.finalizedAt?.toISOString() ?? null,
    createdAt: revision.createdAt.toISOString(),
    updatedAt: revision.updatedAt.toISOString(),
    revisionToken: revisionToken(revision),
  };
}

function serializeImagingRevision(revision: IImagingResultRevision) {
  return {
    id: revision._id.toString(),
    version: revision.version,
    status: revision.status,
    findings: revision.findings,
    impression: revision.impression,
    technique: revision.technique ?? null,
    comparison: revision.comparison ?? null,
    recommendation: revision.recommendation ?? null,
    correctsRevisionId: revision.correctsRevisionId?.toString() ?? null,
    correctionReason: revision.correctionReason ?? null,
    createdBy: revision.createdBy.toString(),
    updatedBy: revision.updatedBy.toString(),
    finalizedBy: revision.finalizedBy?.toString() ?? null,
    finalizedAt: revision.finalizedAt?.toISOString() ?? null,
    createdAt: revision.createdAt.toISOString(),
    updatedAt: revision.updatedAt.toISOString(),
    revisionToken: revisionToken(revision),
  };
}

function serializeItemContext(context: Awaited<ReturnType<typeof loadResultContext>>) {
  return {
    id: context.item._id.toString(),
    diagnosticOrderId: context.order._id.toString(),
    type: context.type,
    status: context.item.status,
  };
}

async function assertNoCrossTypeResult(
  type: ResultType,
  itemId: mongoose.Types.ObjectId,
  session?: ClientSession,
): Promise<void> {
  const conflict =
    type === "LAB"
      ? await ImagingResult.exists({ diagnosticOrderItemId: itemId }).session(
          session ?? null,
        )
      : await LabResult.exists({ diagnosticOrderItemId: itemId }).session(
          session ?? null,
        );
  if (conflict) {
    throw new DiagnosticResultError(
      "A conflicting Result type already exists for this diagnostic order item",
      409,
    );
  }
}

async function loadLabView(
  context: Awaited<ReturnType<typeof loadResultContext>>,
  session?: ClientSession,
) {
  await assertNoCrossTypeResult("LAB", context.item._id, session);
  const logical = await LabResult.findOne({
    diagnosticOrderItemId: context.item._id,
  }).session(session ?? null);
  if (!logical) throw new DiagnosticResultError("Result not found", 404);

  const latest = await LabResultRevision.findOne({
    labResultId: logical._id,
    version: logical.latestRevisionVersion,
  }).session(session ?? null);
  if (!latest) {
    throw new DiagnosticResultError("Latest Result revision not found", 409);
  }
  const currentFinal =
    logical.currentFinalVersion === undefined
      ? null
      : logical.currentFinalVersion === latest.version
        ? latest
        : await LabResultRevision.findOne({
            labResultId: logical._id,
            version: logical.currentFinalVersion,
            status: "FINAL",
          }).session(session ?? null);
  if (logical.currentFinalVersion !== undefined && !currentFinal) {
    throw new DiagnosticResultError(
      "Current FINAL Result revision not found",
      409,
    );
  }
  if (currentFinal && currentFinal.status !== "FINAL") {
    throw new DiagnosticResultError(
      "Current FINAL Result pointer references a non-final revision",
      409,
    );
  }
  return {
    item: serializeItemContext(context),
    result: serializeLogical("LAB", logical),
    latestRevision: serializeLabRevision(latest),
    currentFinalRevision: currentFinal
      ? serializeLabRevision(currentFinal)
      : null,
  };
}

async function loadImagingView(
  context: Awaited<ReturnType<typeof loadResultContext>>,
  session?: ClientSession,
) {
  await assertNoCrossTypeResult("IMAGING", context.item._id, session);
  const logical = await ImagingResult.findOne({
    diagnosticOrderItemId: context.item._id,
  }).session(session ?? null);
  if (!logical) throw new DiagnosticResultError("Result not found", 404);

  const latest = await ImagingResultRevision.findOne({
    imagingResultId: logical._id,
    version: logical.latestRevisionVersion,
  }).session(session ?? null);
  if (!latest) {
    throw new DiagnosticResultError("Latest Result revision not found", 409);
  }
  const currentFinal =
    logical.currentFinalVersion === undefined
      ? null
      : logical.currentFinalVersion === latest.version
        ? latest
        : await ImagingResultRevision.findOne({
            imagingResultId: logical._id,
            version: logical.currentFinalVersion,
            status: "FINAL",
          }).session(session ?? null);
  if (logical.currentFinalVersion !== undefined && !currentFinal) {
    throw new DiagnosticResultError(
      "Current FINAL Result revision not found",
      409,
    );
  }
  if (currentFinal && currentFinal.status !== "FINAL") {
    throw new DiagnosticResultError(
      "Current FINAL Result pointer references a non-final revision",
      409,
    );
  }
  return {
    item: serializeItemContext(context),
    result: serializeLogical("IMAGING", logical),
    latestRevision: serializeImagingRevision(latest),
    currentFinalRevision: currentFinal
      ? serializeImagingRevision(currentFinal)
      : null,
  };
}

export async function createDiagnosticResult(
  orderIdValue: string,
  itemIdValue: string,
  user: AuthenticatedUser,
  body: unknown,
) {
  const { orderId, itemId } = validateIdentifiers(orderIdValue, itemIdValue);
  try {
    return await inResultTransaction(async (session) => {
      const actorId = await revalidateMutationActor(user, session);
      const context = await loadResultContext(
        orderId,
        itemId,
        user,
        "mutate",
        session,
      );
      if (
        context.item.status !== "IN_PROGRESS" &&
        context.item.status !== "COMPLETED"
      ) {
        throw new DiagnosticResultError(
          "A Result draft can only be created after diagnostic work has started",
          409,
        );
      }
      const content = parseDraftContent(context.type, body);
      await assertNoCrossTypeResult(context.type, itemId, session);

      if (context.type === "LAB") {
        if (
          await LabResult.exists({ diagnosticOrderItemId: itemId }).session(
            session,
          )
        ) {
          throw new DiagnosticResultError(
            "A Result already exists for this diagnostic order item",
            409,
          );
        }
        const labContent = content as LabDraftContent;
        const [logical] = await LabResult.create(
          [
            {
              diagnosticOrderItemId: itemId,
              latestRevisionVersion: 1,
              createdBy: actorId,
              updatedBy: actorId,
            },
          ],
          { session },
        );
        const [revision] = await LabResultRevision.create(
          [
            {
              labResultId: logical._id,
              version: 1,
              status: "DRAFT",
              analytes: labContent.analytes,
              ...(labContent.clinicalComment
                ? { clinicalComment: labContent.clinicalComment }
                : {}),
              createdBy: actorId,
              updatedBy: actorId,
            },
          ],
          { session },
        );
        return {
          item: serializeItemContext(context),
          result: serializeLogical("LAB", logical),
          latestRevision: serializeLabRevision(revision),
          currentFinalRevision: null,
        };
      }

      if (
        await ImagingResult.exists({ diagnosticOrderItemId: itemId }).session(
          session,
        )
      ) {
        throw new DiagnosticResultError(
          "A Result already exists for this diagnostic order item",
          409,
        );
      }
      const imagingContent = content as ImagingDraftContent;
      const [logical] = await ImagingResult.create(
        [
          {
            diagnosticOrderItemId: itemId,
            latestRevisionVersion: 1,
            createdBy: actorId,
            updatedBy: actorId,
          },
        ],
        { session },
      );
      const [revision] = await ImagingResultRevision.create(
        [
          {
            imagingResultId: logical._id,
            version: 1,
            status: "DRAFT",
            ...imagingContent,
            createdBy: actorId,
            updatedBy: actorId,
          },
        ],
        { session },
      );
      return {
        item: serializeItemContext(context),
        result: serializeLogical("IMAGING", logical),
        latestRevision: serializeImagingRevision(revision),
        currentFinalRevision: null,
      };
    });
  } catch (error) {
    if (error instanceof DiagnosticResultError) throw error;
    translateDuplicateResultError(error);
  }
}

export async function getCurrentDiagnosticResult(
  orderIdValue: string,
  itemIdValue: string,
  user: AuthenticatedUser,
) {
  const { orderId, itemId } = validateIdentifiers(orderIdValue, itemIdValue);
  const context = await loadResultContext(orderId, itemId, user, "read");
  return context.type === "LAB"
    ? loadLabView(context)
    : loadImagingView(context);
}

export async function getDiagnosticResultHistory(
  orderIdValue: string,
  itemIdValue: string,
  user: AuthenticatedUser,
  input: ResultHistoryInput,
) {
  const { orderId, itemId } = validateIdentifiers(orderIdValue, itemIdValue);
  const context = await loadResultContext(orderId, itemId, user, "read");
  await assertNoCrossTypeResult(context.type, itemId);

  if (context.type === "LAB") {
    const logical = await LabResult.findOne({ diagnosticOrderItemId: itemId });
    if (!logical) throw new DiagnosticResultError("Result not found", 404);
    const filter = { labResultId: logical._id };
    const [total, revisions] = await Promise.all([
      LabResultRevision.countDocuments(filter),
      LabResultRevision.find(filter)
        .sort({ version: 1 })
        .skip((input.page - 1) * input.limit)
        .limit(input.limit),
    ]);
    return {
      item: serializeItemContext(context),
      result: serializeLogical("LAB", logical),
      revisions: revisions.map((revision) => ({
        ...serializeLabRevision(revision),
        isLatest: revision.version === logical.latestRevisionVersion,
        isCurrentFinal: revision.version === logical.currentFinalVersion,
      })),
      pagination: {
        page: input.page,
        limit: input.limit,
        total,
        totalPages: Math.ceil(total / input.limit),
      },
    };
  }

  const logical = await ImagingResult.findOne({ diagnosticOrderItemId: itemId });
  if (!logical) throw new DiagnosticResultError("Result not found", 404);
  const filter = { imagingResultId: logical._id };
  const [total, revisions] = await Promise.all([
    ImagingResultRevision.countDocuments(filter),
    ImagingResultRevision.find(filter)
      .sort({ version: 1 })
      .skip((input.page - 1) * input.limit)
      .limit(input.limit),
  ]);
  return {
    item: serializeItemContext(context),
    result: serializeLogical("IMAGING", logical),
    revisions: revisions.map((revision) => ({
      ...serializeImagingRevision(revision),
      isLatest: revision.version === logical.latestRevisionVersion,
      isCurrentFinal: revision.version === logical.currentFinalVersion,
    })),
    pagination: {
      page: input.page,
      limit: input.limit,
      total,
      totalPages: Math.ceil(total / input.limit),
    },
  };
}

function optionalUnset(fields: readonly string[], content: Record<string, unknown>) {
  return Object.fromEntries(
    fields.filter((field) => content[field] === undefined).map((field) => [field, 1]),
  );
}

export async function updateDiagnosticResultDraft(
  orderIdValue: string,
  itemIdValue: string,
  user: AuthenticatedUser,
  body: unknown,
  expectedRevisionToken: ResultRevisionToken,
) {
  const { orderId, itemId } = validateIdentifiers(orderIdValue, itemIdValue);
  try {
    return await inResultTransaction(async (session) => {
      const actorId = await revalidateMutationActor(user, session);
      const context = await loadResultContext(
        orderId,
        itemId,
        user,
        "mutate",
        session,
      );
      if (
        context.item.status !== "IN_PROGRESS" &&
        context.item.status !== "COMPLETED"
      ) {
        throw new DiagnosticResultError(
          "Result drafts cannot be edited in the current item state",
          409,
        );
      }
      const content = parseDraftContent(context.type, body);
      await assertNoCrossTypeResult(context.type, itemId, session);

      if (context.type === "LAB") {
        const logical = await LabResult.findOne({
          diagnosticOrderItemId: itemId,
        }).session(session);
        if (!logical) throw new DiagnosticResultError("Result not found", 404);
        const labContent = content as LabDraftContent;
        const unset = optionalUnset(
          ["clinicalComment"],
          labContent as unknown as Record<string, unknown>,
        );
        const revision = await LabResultRevision.findOneAndUpdate(
          {
            _id: expectedRevisionToken.revisionId,
            labResultId: logical._id,
            version: logical.latestRevisionVersion,
            status: "DRAFT",
            __v: expectedRevisionToken.documentVersion,
          },
          {
            $set: {
              analytes: labContent.analytes,
              ...(labContent.clinicalComment
                ? { clinicalComment: labContent.clinicalComment }
                : {}),
              updatedBy: actorId,
            },
            ...(Object.keys(unset).length ? { $unset: unset } : {}),
            $inc: { __v: 1 },
          },
          { returnDocument: "after", runValidators: true, session },
        );
        if (!revision) {
          throw new DiagnosticResultError(
            "Result draft changed or finalized before this edit could be saved",
            409,
          );
        }
        await revision.validate();
        const updatedLogical = await LabResult.findOneAndUpdate(
          {
            _id: logical._id,
            latestRevisionVersion: logical.latestRevisionVersion,
          },
          { $set: { updatedBy: actorId } },
          { returnDocument: "after", runValidators: true, session },
        );
        if (!updatedLogical) {
          throw new DiagnosticResultError(
            "Result version changed before this edit could be saved",
            409,
          );
        }
        return loadLabView(context, session);
      }

      const logical = await ImagingResult.findOne({
        diagnosticOrderItemId: itemId,
      }).session(session);
      if (!logical) throw new DiagnosticResultError("Result not found", 404);
      const imagingContent = content as ImagingDraftContent;
      const unset = optionalUnset(
        ["technique", "comparison", "recommendation"],
        imagingContent as unknown as Record<string, unknown>,
      );
      const revision = await ImagingResultRevision.findOneAndUpdate(
        {
          _id: expectedRevisionToken.revisionId,
          imagingResultId: logical._id,
          version: logical.latestRevisionVersion,
          status: "DRAFT",
          __v: expectedRevisionToken.documentVersion,
        },
        {
          $set: { ...imagingContent, updatedBy: actorId },
          ...(Object.keys(unset).length ? { $unset: unset } : {}),
          $inc: { __v: 1 },
        },
        { returnDocument: "after", runValidators: true, session },
      );
      if (!revision) {
        throw new DiagnosticResultError(
          "Result draft changed or finalized before this edit could be saved",
          409,
        );
      }
      await revision.validate();
      const updatedLogical = await ImagingResult.findOneAndUpdate(
        {
          _id: logical._id,
          latestRevisionVersion: logical.latestRevisionVersion,
        },
        { $set: { updatedBy: actorId } },
        { returnDocument: "after", runValidators: true, session },
      );
      if (!updatedLogical) {
        throw new DiagnosticResultError(
          "Result version changed before this edit could be saved",
          409,
        );
      }
      return loadImagingView(context, session);
    });
  } catch (error) {
    if (error instanceof DiagnosticResultError) throw error;
    translateDuplicateResultError(error);
  }
}

function currentFinalFilter(
  currentFinalVersion: number | undefined,
): number | { $exists: false } {
  return currentFinalVersion === undefined
    ? { $exists: false }
    : currentFinalVersion;
}

export async function finalizeDiagnosticResult(
  orderIdValue: string,
  itemIdValue: string,
  user: AuthenticatedUser,
  expectedRevisionToken: ResultRevisionToken,
) {
  const { orderId, itemId } = validateIdentifiers(orderIdValue, itemIdValue);
  try {
    return await inResultTransaction(async (session) => {
      const actorId = await revalidateMutationActor(user, session);
      const context = await loadResultContext(
        orderId,
        itemId,
        user,
        "mutate",
        session,
      );
      if (context.item.status !== "COMPLETED") {
        throw new DiagnosticResultError(
          "A Result can only be finalized after the diagnostic item is completed",
          409,
        );
      }
      await assertNoCrossTypeResult(context.type, itemId, session);
      const now = new Date();

      if (context.type === "LAB") {
        const logical = await LabResult.findOne({
          diagnosticOrderItemId: itemId,
        }).session(session);
        if (!logical) throw new DiagnosticResultError("Result not found", 404);
        const draft = await LabResultRevision.findOne({
          labResultId: logical._id,
          version: logical.latestRevisionVersion,
          status: "DRAFT",
        }).session(session);
        if (!draft) {
          throw new DiagnosticResultError(
            "Latest Result revision is not an editable DRAFT",
            409,
          );
        }
        draft.status = "FINAL";
        draft.finalizedBy = actorId;
        draft.finalizedAt = now;
        draft.updatedBy = actorId;
        await draft.validate();

        const revision = await LabResultRevision.findOneAndUpdate(
          {
            _id: expectedRevisionToken.revisionId,
            labResultId: logical._id,
            version: logical.latestRevisionVersion,
            status: "DRAFT",
            __v: expectedRevisionToken.documentVersion,
          },
          {
            $set: {
              status: "FINAL",
              finalizedBy: actorId,
              finalizedAt: now,
              updatedBy: actorId,
            },
            $inc: { __v: 1 },
          },
          { returnDocument: "after", runValidators: true, session },
        );
        if (!revision) {
          throw new DiagnosticResultError(
            "Result draft changed or finalized before finalization completed",
            409,
          );
        }
        await revision.validate();
        const updatedLogical = await LabResult.findOneAndUpdate(
          {
            _id: logical._id,
            latestRevisionVersion: logical.latestRevisionVersion,
            currentFinalVersion: currentFinalFilter(
              logical.currentFinalVersion,
            ),
          },
          {
            $set: {
              currentFinalVersion: logical.latestRevisionVersion,
              updatedBy: actorId,
            },
          },
          { returnDocument: "after", runValidators: true, session },
        );
        if (!updatedLogical) {
          throw new DiagnosticResultError(
            "Result version pointers changed before finalization completed",
            409,
          );
        }
        return loadLabView(context, session);
      }

      const logical = await ImagingResult.findOne({
        diagnosticOrderItemId: itemId,
      }).session(session);
      if (!logical) throw new DiagnosticResultError("Result not found", 404);
      const draft = await ImagingResultRevision.findOne({
        imagingResultId: logical._id,
        version: logical.latestRevisionVersion,
        status: "DRAFT",
      }).session(session);
      if (!draft) {
        throw new DiagnosticResultError(
          "Latest Result revision is not an editable DRAFT",
          409,
        );
      }
      draft.status = "FINAL";
      draft.finalizedBy = actorId;
      draft.finalizedAt = now;
      draft.updatedBy = actorId;
      await draft.validate();

      const revision = await ImagingResultRevision.findOneAndUpdate(
        {
          _id: expectedRevisionToken.revisionId,
          imagingResultId: logical._id,
          version: logical.latestRevisionVersion,
          status: "DRAFT",
          __v: expectedRevisionToken.documentVersion,
        },
        {
          $set: {
            status: "FINAL",
            finalizedBy: actorId,
            finalizedAt: now,
            updatedBy: actorId,
          },
          $inc: { __v: 1 },
        },
        { returnDocument: "after", runValidators: true, session },
      );
      if (!revision) {
        throw new DiagnosticResultError(
          "Result draft changed or finalized before finalization completed",
          409,
        );
      }
      await revision.validate();
      const updatedLogical = await ImagingResult.findOneAndUpdate(
        {
          _id: logical._id,
          latestRevisionVersion: logical.latestRevisionVersion,
          currentFinalVersion: currentFinalFilter(logical.currentFinalVersion),
        },
        {
          $set: {
            currentFinalVersion: logical.latestRevisionVersion,
            updatedBy: actorId,
          },
        },
        { returnDocument: "after", runValidators: true, session },
      );
      if (!updatedLogical) {
        throw new DiagnosticResultError(
          "Result version pointers changed before finalization completed",
          409,
        );
      }
      return loadImagingView(context, session);
    });
  } catch (error) {
    if (error instanceof DiagnosticResultError) throw error;
    translateDuplicateResultError(error);
  }
}

export async function startDiagnosticResultCorrection(
  orderIdValue: string,
  itemIdValue: string,
  user: AuthenticatedUser,
  body: unknown,
) {
  const { orderId, itemId } = validateIdentifiers(orderIdValue, itemIdValue);
  const correctionReason = parseCorrectionReason(body);
  try {
    return await inResultTransaction(async (session) => {
      const actorId = await revalidateMutationActor(user, session);
      const context = await loadResultContext(
        orderId,
        itemId,
        user,
        "mutate",
        session,
      );
      if (context.item.status !== "COMPLETED") {
        throw new DiagnosticResultError(
          "A Result correction requires a completed diagnostic item",
          409,
        );
      }
      await assertNoCrossTypeResult(context.type, itemId, session);

      if (context.type === "LAB") {
        const logical = await LabResult.findOne({
          diagnosticOrderItemId: itemId,
        }).session(session);
        if (!logical) throw new DiagnosticResultError("Result not found", 404);
        if (
          logical.currentFinalVersion === undefined ||
          logical.latestRevisionVersion !== logical.currentFinalVersion
        ) {
          throw new DiagnosticResultError(
            "A correction requires the latest revision to be the current FINAL Result",
            409,
          );
        }
        const source = await LabResultRevision.findOne({
          labResultId: logical._id,
          version: logical.currentFinalVersion,
          status: "FINAL",
        }).session(session);
        if (!source) {
          throw new DiagnosticResultError(
            "Current FINAL Result revision not found",
            409,
          );
        }
        const nextVersion = logical.latestRevisionVersion + 1;
        if (!Number.isSafeInteger(nextVersion)) {
          throw new DiagnosticResultError(
            "Result revision version limit reached",
            409,
          );
        }
        const [revision] = await LabResultRevision.create(
          [
            {
              labResultId: logical._id,
              version: nextVersion,
              status: "DRAFT",
              analytes: source.analytes.map((analyte: ILabAnalyteResult) => ({
                ...(analyte.code ? { code: analyte.code } : {}),
                name: analyte.name,
                value: analyte.value,
                ...(analyte.unit ? { unit: analyte.unit } : {}),
                ...(analyte.referenceRange
                  ? { referenceRange: analyte.referenceRange }
                  : {}),
                interpretation: analyte.interpretation,
              })),
              ...(source.clinicalComment
                ? { clinicalComment: source.clinicalComment }
                : {}),
              correctsRevisionId: source._id,
              correctionReason,
              createdBy: actorId,
              updatedBy: actorId,
            },
          ],
          { session },
        );
        const updatedLogical = await LabResult.findOneAndUpdate(
          {
            _id: logical._id,
            latestRevisionVersion: logical.latestRevisionVersion,
            currentFinalVersion: logical.currentFinalVersion,
          },
          {
            $set: { latestRevisionVersion: nextVersion, updatedBy: actorId },
          },
          { returnDocument: "after", runValidators: true, session },
        );
        if (!updatedLogical) {
          throw new DiagnosticResultError(
            "Result version changed before the correction could be created",
            409,
          );
        }
        return {
          item: serializeItemContext(context),
          result: serializeLogical("LAB", updatedLogical),
          latestRevision: serializeLabRevision(revision),
          currentFinalRevision: serializeLabRevision(source),
        };
      }

      const logical = await ImagingResult.findOne({
        diagnosticOrderItemId: itemId,
      }).session(session);
      if (!logical) throw new DiagnosticResultError("Result not found", 404);
      if (
        logical.currentFinalVersion === undefined ||
        logical.latestRevisionVersion !== logical.currentFinalVersion
      ) {
        throw new DiagnosticResultError(
          "A correction requires the latest revision to be the current FINAL Result",
          409,
        );
      }
      const source = await ImagingResultRevision.findOne({
        imagingResultId: logical._id,
        version: logical.currentFinalVersion,
        status: "FINAL",
      }).session(session);
      if (!source) {
        throw new DiagnosticResultError(
          "Current FINAL Result revision not found",
          409,
        );
      }
      const nextVersion = logical.latestRevisionVersion + 1;
      if (!Number.isSafeInteger(nextVersion)) {
        throw new DiagnosticResultError(
          "Result revision version limit reached",
          409,
        );
      }
      const [revision] = await ImagingResultRevision.create(
        [
          {
            imagingResultId: logical._id,
            version: nextVersion,
            status: "DRAFT",
            findings: source.findings,
            impression: source.impression,
            ...(source.technique ? { technique: source.technique } : {}),
            ...(source.comparison ? { comparison: source.comparison } : {}),
            ...(source.recommendation
              ? { recommendation: source.recommendation }
              : {}),
            correctsRevisionId: source._id,
            correctionReason,
            createdBy: actorId,
            updatedBy: actorId,
          },
        ],
        { session },
      );
      const updatedLogical = await ImagingResult.findOneAndUpdate(
        {
          _id: logical._id,
          latestRevisionVersion: logical.latestRevisionVersion,
          currentFinalVersion: logical.currentFinalVersion,
        },
        {
          $set: { latestRevisionVersion: nextVersion, updatedBy: actorId },
        },
        { returnDocument: "after", runValidators: true, session },
      );
      if (!updatedLogical) {
        throw new DiagnosticResultError(
          "Result version changed before the correction could be created",
          409,
        );
      }
      return {
        item: serializeItemContext(context),
        result: serializeLogical("IMAGING", updatedLogical),
        latestRevision: serializeImagingRevision(revision),
        currentFinalRevision: serializeImagingRevision(source),
      };
    });
  } catch (error) {
    if (error instanceof DiagnosticResultError) throw error;
    translateDuplicateResultError(error);
  }
}
