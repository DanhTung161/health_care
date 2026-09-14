export const DIAGNOSTIC_RESULT_REVISION_STATUSES = ["DRAFT", "FINAL"] as const;

export type DiagnosticResultRevisionStatus =
  (typeof DIAGNOSTIC_RESULT_REVISION_STATUSES)[number];

export const LAB_RESULT_INTERPRETATIONS = [
  "NORMAL",
  "HIGH",
  "LOW",
  "ABNORMAL",
  "CRITICAL",
  "UNKNOWN",
] as const;

export type LabResultInterpretation =
  (typeof LAB_RESULT_INTERPRETATIONS)[number];

export function isDiagnosticResultRevisionStatus(
  value: unknown,
): value is DiagnosticResultRevisionStatus {
  return (
    typeof value === "string" &&
    DIAGNOSTIC_RESULT_REVISION_STATUSES.includes(
      value as DiagnosticResultRevisionStatus,
    )
  );
}

export function isLabResultInterpretation(
  value: unknown,
): value is LabResultInterpretation {
  return (
    typeof value === "string" &&
    LAB_RESULT_INTERPRETATIONS.includes(value as LabResultInterpretation)
  );
}
