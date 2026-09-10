import "server-only";

export const APPOINTMENT_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "ACCEPTED",
  "COMPLETED",
  "CANCELLED",
] as const;

export const PENDING_APPOINTMENT_STATUS = APPOINTMENT_STATUSES[0];
export const COMPLETED_APPOINTMENT_STATUS = APPOINTMENT_STATUSES[3];

export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

const allowedTransitions: Record<AppointmentStatus, AppointmentStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["ACCEPTED", "CANCELLED"],
  ACCEPTED: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export function isAppointmentStatus(value: unknown): value is AppointmentStatus {
  return typeof value === "string" && APPOINTMENT_STATUSES.includes(value as AppointmentStatus);
}

export function canTransitionAppointmentStatus(
  from: AppointmentStatus,
  to: AppointmentStatus,
): boolean {
  return allowedTransitions[from].includes(to);
}

export function isReschedulableAppointmentStatus(
  status: AppointmentStatus,
): boolean {
  return status === "PENDING" || status === "CONFIRMED";
}
