import type {
  DiagnosticPriority,
  DiagnosticStatus,
  DiagnosticType,
} from "@/lib/diagnostic";
import type {
  DiagnosticResultRevisionStatus,
  LabResultInterpretation,
} from "@/lib/diagnostic-results";

export interface DiagnosticOrderSummary {
  id: string;
  medicalVisitId: string;
  patientId: string;
  orderedByDoctor: { id: string; name: string };
  type: DiagnosticType;
  clinicalIndication: string;
  priority: DiagnosticPriority;
  status: DiagnosticStatus;
  notes: string | null;
  orderedAt: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface DiagnosticOrderItemView {
  id: string;
  diagnosticOrderId: string;
  type: DiagnosticType;
  serviceCode: string;
  serviceName: string;
  status: DiagnosticStatus;
  notes: string | null;
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  performedBy: string | null;
  cancellationReason: string | null;
  cancelledAt: string | null;
  cancelledBy: string | null;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface DiagnosticOrderDetail extends DiagnosticOrderSummary {
  items: DiagnosticOrderItemView[];
}

export interface DiagnosticOrderListResponse {
  items: DiagnosticOrderSummary[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface LabAnalyteView {
  code: string | null;
  name: string;
  value: string;
  unit: string | null;
  referenceRange: string | null;
  interpretation: LabResultInterpretation;
}

interface ResultRevisionBase {
  id: string;
  version: number;
  status: DiagnosticResultRevisionStatus;
  correctsRevisionId: string | null;
  correctionReason: string | null;
  createdBy: string;
  updatedBy: string;
  finalizedBy: string | null;
  finalizedAt: string | null;
  createdAt: string;
  updatedAt: string;
  revisionToken: string;
  isLatest?: boolean;
  isCurrentFinal?: boolean;
}

export interface LabResultRevisionView extends ResultRevisionBase {
  analytes: LabAnalyteView[];
  clinicalComment: string | null;
}

export interface ImagingResultRevisionView extends ResultRevisionBase {
  findings: string;
  impression: string;
  technique: string | null;
  comparison: string | null;
  recommendation: string | null;
}

export type DiagnosticResultRevisionView =
  | LabResultRevisionView
  | ImagingResultRevisionView;

export interface DiagnosticLogicalResultView {
  id: string;
  diagnosticOrderItemId: string;
  resultType: DiagnosticType;
  latestRevisionVersion: number;
  currentFinalVersion: number | null;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface DiagnosticResultView {
  item: {
    id: string;
    diagnosticOrderId: string;
    type: DiagnosticType;
    status: DiagnosticStatus;
  };
  result: DiagnosticLogicalResultView;
  latestRevision: DiagnosticResultRevisionView;
  currentFinalRevision: DiagnosticResultRevisionView | null;
}

export interface DiagnosticResultHistoryView {
  item: DiagnosticResultView["item"];
  result: DiagnosticLogicalResultView;
  revisions: DiagnosticResultRevisionView[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface LabDraftPayload {
  analytes: Array<{
    code?: string;
    name: string;
    value: string;
    unit?: string;
    referenceRange?: string;
    interpretation: LabResultInterpretation;
  }>;
  clinicalComment?: string;
}

export interface ImagingDraftPayload {
  findings: string;
  impression: string;
  technique?: string;
  comparison?: string;
  recommendation?: string;
}

export type DiagnosticDraftPayload = LabDraftPayload | ImagingDraftPayload;

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export class DiagnosticClientError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "DiagnosticClientError";
    this.status = status;
  }
}

async function requestData<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<{ data: T; response: Response }> {
  let response: Response;
  try {
    response = await fetch(input, {
      credentials: "same-origin",
      cache: "no-store",
      ...init,
    });
  } catch {
    throw new DiagnosticClientError("Unable to connect to the server.", 0);
  }

  let envelope: ApiEnvelope<T> | null = null;
  try {
    envelope = (await response.json()) as ApiEnvelope<T>;
  } catch {
    throw new DiagnosticClientError(
      response.ok ? "The server returned an invalid response." : "Request failed.",
      response.status,
    );
  }

  if (!response.ok || !envelope.success || envelope.data === undefined) {
    throw new DiagnosticClientError(
      envelope.error || `Request failed with status ${response.status}.`,
      response.status,
    );
  }

  return { data: envelope.data, response };
}

function resultResponse(
  data: DiagnosticResultView,
  response: Response,
): { data: DiagnosticResultView; etag: string } {
  const etag = response.headers.get("etag");
  const expected = `"${data.latestRevision.revisionToken}"`;
  if (!etag || etag !== expected) {
    throw new DiagnosticClientError(
      "The Result response did not include a matching concurrency token.",
      500,
    );
  }
  return { data, etag };
}

export async function fetchDiagnosticOrders(
  searchParams: URLSearchParams,
): Promise<DiagnosticOrderListResponse> {
  const { data } = await requestData<DiagnosticOrderListResponse>(
    `/api/diagnostic-orders?${searchParams.toString()}`,
  );
  return data;
}

export async function fetchDiagnosticOrder(
  orderId: string,
): Promise<DiagnosticOrderDetail> {
  const { data } = await requestData<DiagnosticOrderDetail>(
    `/api/diagnostic-orders/${orderId}`,
  );
  return data;
}

export async function fetchDiagnosticResult(
  orderId: string,
  itemId: string,
): Promise<{ data: DiagnosticResultView; etag: string }> {
  const { data, response } = await requestData<DiagnosticResultView>(
    `/api/diagnostic-orders/${orderId}/items/${itemId}/result`,
  );
  return resultResponse(data, response);
}

export async function createDiagnosticResultDraft(
  orderId: string,
  itemId: string,
  payload: DiagnosticDraftPayload,
): Promise<{ data: DiagnosticResultView; etag: string }> {
  const { data, response } = await requestData<DiagnosticResultView>(
    `/api/diagnostic-orders/${orderId}/items/${itemId}/result`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  return resultResponse(data, response);
}

export async function saveDiagnosticResultDraft(
  orderId: string,
  itemId: string,
  payload: DiagnosticDraftPayload,
  etag: string,
): Promise<{ data: DiagnosticResultView; etag: string }> {
  const { data, response } = await requestData<DiagnosticResultView>(
    `/api/diagnostic-orders/${orderId}/items/${itemId}/result/draft`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "If-Match": etag,
      },
      body: JSON.stringify(payload),
    },
  );
  return resultResponse(data, response);
}

export async function finalizeDiagnosticResultDraft(
  orderId: string,
  itemId: string,
  etag: string,
): Promise<{ data: DiagnosticResultView; etag: string }> {
  const { data, response } = await requestData<DiagnosticResultView>(
    `/api/diagnostic-orders/${orderId}/items/${itemId}/result/finalize`,
    {
      method: "POST",
      headers: { "If-Match": etag },
    },
  );
  return resultResponse(data, response);
}

export async function createDiagnosticResultCorrection(
  orderId: string,
  itemId: string,
  correctionReason: string,
): Promise<{ data: DiagnosticResultView; etag: string }> {
  const { data, response } = await requestData<DiagnosticResultView>(
    `/api/diagnostic-orders/${orderId}/items/${itemId}/result/corrections`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ correctionReason }),
    },
  );
  return resultResponse(data, response);
}

export async function fetchDiagnosticResultHistory(
  orderId: string,
  itemId: string,
  page: number,
  limit = 10,
): Promise<DiagnosticResultHistoryView> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  const { data } = await requestData<DiagnosticResultHistoryView>(
    `/api/diagnostic-orders/${orderId}/items/${itemId}/result/history?${params}`,
  );
  return data;
}
