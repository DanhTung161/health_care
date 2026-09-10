import "server-only";

import mongoose from "mongoose";
import Appointment from "@/models/Appointment";

export interface AppointmentSlot {
  doctorId: string;
  appointmentDate: Date;
  timeSlot: string;
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export function parseAppointmentSlot(
  doctorIdValue: unknown,
  dateValue: unknown,
  timeValue: unknown,
): { data: AppointmentSlot } | { error: string } {
  const doctorId = typeof doctorIdValue === "string" ? doctorIdValue.trim() : "";
  if (!doctorId || !mongoose.isValidObjectId(doctorId)) {
    return { error: "A valid doctor is required" };
  }

  const dateText = typeof dateValue === "string" ? dateValue.trim() : "";
  if (!DATE_PATTERN.test(dateText)) {
    return { error: "Appointment date is invalid" };
  }
  const appointmentDate = new Date(`${dateText}T00:00:00.000Z`);
  if (
    Number.isNaN(appointmentDate.getTime()) ||
    appointmentDate.toISOString().slice(0, 10) !== dateText
  ) {
    return { error: "Appointment date is invalid" };
  }

  const timeSlot = typeof timeValue === "string" ? timeValue.trim() : "";
  if (!TIME_PATTERN.test(timeSlot)) {
    return { error: "Appointment time must use the HH:MM format" };
  }

  return { data: { doctorId, appointmentDate, timeSlot } };
}

export async function hasAppointmentConflict(
  slot: AppointmentSlot,
  excludeAppointmentId?: string,
): Promise<boolean> {
  const nextDay = new Date(slot.appointmentDate);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);

  const conflict = await Appointment.exists({
    ...(excludeAppointmentId ? { _id: { $ne: excludeAppointmentId } } : {}),
    doctorId: slot.doctorId,
    appointmentDate: { $gte: slot.appointmentDate, $lt: nextDay },
    timeSlot: slot.timeSlot,
    status: { $ne: "CANCELLED" },
  });

  return Boolean(conflict);
}
