import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { authenticateRequest } from "@/lib/auth";
import {
  hasAppointmentConflict,
  parseAppointmentSlot,
} from "@/lib/appointment-scheduling";
import connectDB from "@/lib/db";
import Appointment from "@/models/Appointment";
import Patient from "@/models/Patient";
import User from "@/models/User";

interface CreateAppointmentRequest {
  patientId: string;
  doctorId: string;
  appointmentDate: Date;
  timeSlot: string;
  reason?: string;
}

function authorizationError(status: 401 | 403) {
  return NextResponse.json(
    {
      success: false,
      error:
        status === 401
          ? "Authentication required"
          : "Forbidden: appointment booking is limited to administrators and staff",
    },
    { status },
  );
}

function parseCreateAppointmentRequest(
  value: unknown,
): { data: CreateAppointmentRequest } | { error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { error: "Invalid request body" };
  }

  const body = value as Record<string, unknown>;
  const allowedFields = new Set([
    "patientId",
    "doctorId",
    "appointmentDate",
    "timeSlot",
    "reason",
  ]);
  if (Object.keys(body).some((key) => !allowedFields.has(key))) {
    return { error: "Invalid request body" };
  }

  const patientId = typeof body.patientId === "string" ? body.patientId.trim() : "";
  const slot = parseAppointmentSlot(
    body.doctorId,
    body.appointmentDate,
    body.timeSlot,
  );

  if (!patientId || !mongoose.isValidObjectId(patientId)) return { error: "A valid patient is required" };
  if ("error" in slot) return slot;
  if ("reason" in body && typeof body.reason !== "string") return { error: "Reason must be a string" };

  const reason = typeof body.reason === "string" ? body.reason.trim() : undefined;
  return {
    data: {
      patientId,
      ...slot.data,
      ...(reason ? { reason } : {}),
    },
  };
}

export async function GET(request: NextRequest) {
  if (!(await authenticateRequest(request))) return authorizationError(401);

  try {
    await connectDB();
    const appointments = await Appointment.find()
      .populate("patientId", "fullName phone")
      .populate("doctorId", "name")
      .sort({ appointmentDate: -1 });
    return NextResponse.json({ success: true, data: appointments });
  } catch {
    return NextResponse.json({ success: false, error: "Unable to load appointments" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const currentUser = await authenticateRequest(request);
  if (!currentUser) return authorizationError(401);
  if (currentUser.role !== "ADMIN" && currentUser.role !== "STAFF") {
    return authorizationError(403);
  }

  let requestBody: unknown;
  try {
    requestBody = (await request.json()) as unknown;
  } catch {
    return NextResponse.json({ success: false, error: "Request body must be valid JSON" }, { status: 400 });
  }

  const parsed = parseCreateAppointmentRequest(requestBody);
  if ("error" in parsed) {
    return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });
  }

  try {
    await connectDB();
    const [patient, doctor] = await Promise.all([
      Patient.exists({ _id: parsed.data.patientId, deletedAt: null }),
      User.exists({ _id: parsed.data.doctorId, role: "DOCTOR", isActive: true }),
    ]);
    if (!patient) return NextResponse.json({ success: false, error: "Patient not found" }, { status: 404 });
    if (!doctor) return NextResponse.json({ success: false, error: "Active doctor not found" }, { status: 404 });

    if (await hasAppointmentConflict(parsed.data)) {
      return NextResponse.json(
        { success: false, error: "This doctor already has an appointment at the selected date and time" },
        { status: 409 },
      );
    }

    const appointment = await Appointment.create(parsed.data);
    return NextResponse.json(
      {
        success: true,
        data: {
          _id: appointment._id.toString(),
          patientId: appointment.patientId.toString(),
          doctorId: appointment.doctorId.toString(),
          appointmentDate: appointment.appointmentDate,
          timeSlot: appointment.timeSlot,
          status: appointment.status,
          reason: appointment.reason,
        },
      },
      { status: 201 },
    );
  } catch {
    return NextResponse.json({ success: false, error: "Unable to create appointment" }, { status: 500 });
  }
}
