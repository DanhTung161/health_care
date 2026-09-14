import {
  canTransitionDiagnosticItemStatus,
  type DiagnosticStatus,
} from "@/lib/diagnostic";
import type { Role } from "@/lib/roles";

export const DIAGNOSTIC_WORKFLOW_ACTIONS = [
  "SCHEDULE",
  "START",
  "COMPLETE",
  "CANCEL",
] as const;

export type DiagnosticWorkflowAction =
  (typeof DIAGNOSTIC_WORKFLOW_ACTIONS)[number];

const actionTargets: Record<DiagnosticWorkflowAction, DiagnosticStatus> = {
  SCHEDULE: "SCHEDULED",
  START: "IN_PROGRESS",
  COMPLETE: "COMPLETED",
  CANCEL: "CANCELLED",
};

function roleAllowsTarget(
  role: Role,
  isAssignedDoctor: boolean,
  target: DiagnosticStatus,
): boolean {
  if (role === "DOCTOR") return isAssignedDoctor;
  return target === "SCHEDULED" || target === "CANCELLED";
}

export function getDiagnosticWorkflowActions(
  role: Role,
  isAssignedDoctor: boolean,
  status: DiagnosticStatus,
): DiagnosticWorkflowAction[] {
  return DIAGNOSTIC_WORKFLOW_ACTIONS.filter((action) => {
    const target = actionTargets[action];
    return (
      roleAllowsTarget(role, isAssignedDoctor, target) &&
      canTransitionDiagnosticItemStatus(status, target)
    );
  });
}

const LOCAL_DATE_TIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;

export function diagnosticLocalDateTimeToIso(value: string): string | null {
  const match = LOCAL_DATE_TIME_PATTERN.exec(value.trim());
  if (!match) return null;

  const [, yearText, monthText, dayText, hourText, minuteText, secondText] =
    match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText ?? "0");
  const localDate = new Date(year, month - 1, day, hour, minute, second, 0);

  if (
    localDate.getFullYear() !== year ||
    localDate.getMonth() !== month - 1 ||
    localDate.getDate() !== day ||
    localDate.getHours() !== hour ||
    localDate.getMinutes() !== minute ||
    localDate.getSeconds() !== second
  ) {
    return null;
  }

  return localDate.toISOString();
}
