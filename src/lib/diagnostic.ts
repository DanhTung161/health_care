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
