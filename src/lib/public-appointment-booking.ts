import "server-only";

import mongoose from "mongoose";
import {
  hasAppointmentConflict,
  parseAppointmentSlot,
} from "@/lib/appointment-scheduling";
import { PENDING_APPOINTMENT_STATUS } from "@/lib/appointment-status";
import connectDB from "@/lib/db";
import { isDuplicateKeyError } from "@/lib/patient-management";
import Appointment from "@/models/Appointment";
import Patient from "@/models/Patient";
import Specialty from "@/models/Specialty";
import User from "@/models/User";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[0-9+().\s-]+$/;

const PUBLIC_BOOKING_FIELDS = new Set([
  "name",
  "email",
  "phone",
  "appointmentDate",
  "timeSlot",
  "specialtyId",
  "doctorId",
  "reason",
]);

export interface PublicAppointmentRequest {
  name: string;
  email: string;
  phone: string;
  appointmentDate: Date;
  timeSlot: string;
  specialtyId: string;
  doctorId: string;
  reason?: string;
}

export class PublicAppointmentError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 404 | 409,
  ) {
    super(message);
    this.name = "PublicAppointmentError";
  }
}

export function parsePublicAppointmentRequest(
  value: unknown,
): { data: PublicAppointmentRequest } | { error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { error: "Invalid request body" };
  }

  const body = value as Record<string, unknown>;
  const keys = Object.keys(body);
  if (!keys.length || keys.some((key) => !PUBLIC_BOOKING_FIELDS.has(key))) {
    return { error: "Invalid request body" };
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const specialtyId =
    typeof body.specialtyId === "string" ? body.specialtyId.trim() : "";

  if (!name || !email || !phone || !specialtyId) {
    return {
      error: "Name, email, phone, appointment date, time, specialty, and doctor are required",
    };
  }
  if (name.length > 100) {
    return { error: "Name must be 100 characters or fewer" };
  }
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    return { error: "Email address is invalid" };
  }

  const phoneDigitCount = phone.replace(/\D/g, "").length;
  if (
    phone.length > 30 ||
    phoneDigitCount < 7 ||
    phoneDigitCount > 15 ||
    !PHONE_PATTERN.test(phone)
  ) {
    return { error: "Phone number is invalid" };
  }
  if (!mongoose.isValidObjectId(specialtyId)) {
    return { error: "A valid specialty is required" };
  }

  const slot = parseAppointmentSlot(
    body.doctorId,
    body.appointmentDate,
    body.timeSlot,
  );
  if ("error" in slot) {
    return slot;
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  if (slot.data.appointmentDate < today) {
    return { error: "Appointment date cannot be in the past" };
  }

  if ("reason" in body && typeof body.reason !== "string") {
    return { error: "Appointment note must be a string" };
  }
  const reason =
    typeof body.reason === "string" ? body.reason.trim() : undefined;
  if (reason && reason.length > 1000) {
    return { error: "Appointment note must be 1000 characters or fewer" };
  }

  return {
    data: {
      name,
      email,
      phone,
      appointmentDate: slot.data.appointmentDate,
      timeSlot: slot.data.timeSlot,
      specialtyId,
      doctorId: slot.data.doctorId,
      ...(reason ? { reason } : {}),
    },
  };
}

async function resolvePatient(input: PublicAppointmentRequest) {
  let patient = await Patient.findOne({ phone: input.phone })
    .select("_id deletedAt")
    .lean();

  if (patient?.deletedAt) {
    throw new PublicAppointmentError(
      "This patient profile is archived. Please contact the clinic for assistance.",
      409,
    );
  }

  if (patient) {
    return patient._id;
  }

  try {
    const created = await Patient.create({
      fullName: input.name,
      phone: input.phone,
      deletedAt: null,
    });
    return created._id;
  } catch (error) {
    if (!isDuplicateKeyError(error)) {
      throw error;
    }

    patient = await Patient.findOne({ phone: input.phone })
      .select("_id deletedAt")
      .lean();

    if (!patient || patient.deletedAt) {
      throw new PublicAppointmentError(
        patient?.deletedAt
          ? "This patient profile is archived. Please contact the clinic for assistance."
          : "Unable to resolve patient information",
        409,
      );
    }

    return patient._id;
  }
}

export async function createPublicAppointment(
  input: PublicAppointmentRequest,
): Promise<{ appointmentId: string; status: typeof PENDING_APPOINTMENT_STATUS }> {
  await connectDB();

  const [specialty, doctor] = await Promise.all([
    Specialty.exists({ _id: input.specialtyId }),
    User.findOne({
      _id: input.doctorId,
      role: "DOCTOR",
      isActive: true,
    })
      .select("_id specialtyId")
      .lean(),
  ]);

  if (!specialty) {
    throw new PublicAppointmentError("Specialty not found", 404);
  }
  if (!doctor) {
    throw new PublicAppointmentError("Active doctor not found", 404);
  }
  if (doctor.specialtyId?.toString() !== input.specialtyId) {
    throw new PublicAppointmentError(
      "The selected doctor does not belong to the selected specialty",
      400,
    );
  }

  const slot = {
    doctorId: input.doctorId,
    appointmentDate: input.appointmentDate,
    timeSlot: input.timeSlot,
  };

  if (await hasAppointmentConflict(slot)) {
    throw new PublicAppointmentError(
      "This doctor already has an appointment at the selected date and time",
      409,
    );
  }

  const patientId = await resolvePatient(input);

  // Recheck immediately before creating so sequential retries cannot create a
  // second active booking after patient resolution.
  if (await hasAppointmentConflict(slot)) {
    throw new PublicAppointmentError(
      "This doctor already has an appointment at the selected date and time",
      409,
    );
  }

  const appointment = await Appointment.create({
    patientId,
    doctorId: input.doctorId,
    appointmentDate: input.appointmentDate,
    timeSlot: input.timeSlot,
    status: PENDING_APPOINTMENT_STATUS,
    contactEmail: input.email,
    ...(input.reason ? { reason: input.reason } : {}),
  });

  return {
    appointmentId: appointment._id.toString(),
    status: PENDING_APPOINTMENT_STATUS,
  };
}
