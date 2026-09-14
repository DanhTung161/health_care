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

export const DIAGNOSTIC_RESULT_LIMITS = {
  maxLabAnalytes: 500,
  analyteCode: 64,
  analyteName: 200,
  analyteValue: 500,
  analyteUnit: 100,
  referenceRange: 500,
  clinicalComment: 5_000,
  imagingFindings: 20_000,
  imagingImpression: 10_000,
  imagingOptionalSection: 5_000,
  correctionReason: 2_000,
} as const;

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
