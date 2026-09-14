export const DIAGNOSTIC_TYPES = ["LAB", "IMAGING"] as const;

export type DiagnosticType = (typeof DIAGNOSTIC_TYPES)[number];

export const DIAGNOSTIC_STATUSES = [
  "ORDERED",
  "SCHEDULED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
] as const;

export type DiagnosticStatus = (typeof DIAGNOSTIC_STATUSES)[number];

export const DIAGNOSTIC_CANCELLATION_REASON_MAX_LENGTH = 1_000;

const diagnosticItemTransitions: Record<
  DiagnosticStatus,
  readonly DiagnosticStatus[]
> = {
  ORDERED: ["SCHEDULED", "IN_PROGRESS", "CANCELLED"],
  SCHEDULED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

const ISO_TIMESTAMP_WITH_TIMEZONE_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;

export const DIAGNOSTIC_PRIORITIES = ["ROUTINE", "URGENT"] as const;

export type DiagnosticPriority = (typeof DIAGNOSTIC_PRIORITIES)[number];

export function isDiagnosticType(value: unknown): value is DiagnosticType {
  return (
    typeof value === "string" &&
    DIAGNOSTIC_TYPES.includes(value as DiagnosticType)
  );
}

export function isDiagnosticStatus(value: unknown): value is DiagnosticStatus {
  return (
    typeof value === "string" &&
    DIAGNOSTIC_STATUSES.includes(value as DiagnosticStatus)
  );
}

export function isDiagnosticPriority(
  value: unknown,
): value is DiagnosticPriority {
  return (
    typeof value === "string" &&
    DIAGNOSTIC_PRIORITIES.includes(value as DiagnosticPriority)
  );
}

export function canTransitionDiagnosticItemStatus(
  from: DiagnosticStatus,
  to: DiagnosticStatus,
): boolean {
  return diagnosticItemTransitions[from].includes(to);
}

export function parseDiagnosticTimestampWithTimezone(
  value: unknown,
): Date | null {
  if (typeof value !== "string") return null;

  const normalized = value.trim();
  const match = ISO_TIMESTAMP_WITH_TIMEZONE_PATTERN.exec(normalized);
  if (!match) return null;

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const calendarDate = new Date(Date.UTC(year, month - 1, day));
  if (
    calendarDate.getUTCFullYear() !== year ||
    calendarDate.getUTCMonth() !== month - 1 ||
    calendarDate.getUTCDate() !== day
  ) {
    return null;
  }

  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function calculateDiagnosticOrderStatus(
  itemStatuses: readonly DiagnosticStatus[],
): DiagnosticStatus {
  if (!itemStatuses.length) {
    throw new Error("A diagnostic order requires at least one item status");
  }
  if (itemStatuses.some((status) => !isDiagnosticStatus(status))) {
    throw new Error("Diagnostic order contains an invalid item status");
  }

  if (itemStatuses.every((status) => status === "CANCELLED")) {
    return "CANCELLED";
  }

  const activeStatuses = itemStatuses.filter(
    (status) => status !== "CANCELLED",
  );
  if (activeStatuses.every((status) => status === "COMPLETED")) {
    return "COMPLETED";
  }
  if (
    activeStatuses.some(
      (status) => status === "IN_PROGRESS" || status === "COMPLETED",
    )
  ) {
    return "IN_PROGRESS";
  }
  if (activeStatuses.some((status) => status === "SCHEDULED")) {
    return "SCHEDULED";
  }
  return "ORDERED";
}
