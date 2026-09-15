import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import {
  authenticateRequest,
  type AuthenticatedUser,
} from "@/lib/auth";
import connectDB from "@/lib/db";
import { parseMedicalVisitInput } from "@/lib/medical-visit";
import Appointment from "@/models/Appointment";
import MedicalVisit from "@/models/MedicalVisit";
import Patient from "@/models/Patient";
import User from "@/models/User";

type RouteContext = { params: Promise<{ id: string }> };

function authorizationError(status: 401 | 403) {
  return NextResponse.json(
    {
      success: false,
      error:
        status === 401
          ? "Authentication required"
          : "Forbidden: medical visit access denied",
    },
    { status },
  );
}

async function authorizeMedicalWriter(
  request: NextRequest,
): Promise<
  { ok: true; user: AuthenticatedUser } | { ok: false; status: 401 | 403 }
> {
  const user = await authenticateRequest(request);
  if (!user) return { ok: false, status: 401 };
  if (user.role !== "ADMIN" && user.role !== "DOCTOR") {
    return { ok: false, status: 403 };
  }
  return { ok: true, user };
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  if (!(await authenticateRequest(request))) return authorizationError(401);
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json(
      { success: false, error: "Invalid patient id" },
      { status: 400 },
    );
  }

  try {
    await connectDB();
    if (!(await Patient.exists({ _id: id }))) {
      return NextResponse.json(
        { success: false, error: "Patient not found" },
        { status: 404 },
      );
    }
    const visits = await MedicalVisit.find({ patientId: id })
      .populate("doctorId", "name role")
      .sort({ visitDate: -1, createdAt: -1 });
    return NextResponse.json({ success: true, data: visits });
  } catch {
    return NextResponse.json(
      { success: false, error: "Unable to load medical history" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const authorization = await authorizeMedicalWriter(request);
  if (!authorization.ok) return authorizationError(authorization.status);

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json(
      { success: false, error: "Invalid patient id" },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = (await request.json()) as unknown;
  } catch {
    return NextResponse.json(
      { success: false, error: "Request body must be valid JSON" },
      { status: 400 },
    );
  }

  const parsed = parseMedicalVisitInput(body);
  if ("error" in parsed) {
    return NextResponse.json(
      { success: false, error: parsed.error },
      { status: 400 },
    );
  }

  if (
    parsed.data.appointmentId &&
    !mongoose.isValidObjectId(parsed.data.appointmentId)
  ) {
    return NextResponse.json(
      { success: false, error: "Invalid appointment id" },
      { status: 400 },
    );
  }

  try {
    await connectDB();
    if (!(await Patient.exists({ _id: id }))) {
      return NextResponse.json(
        { success: false, error: "Patient not found" },
        { status: 404 },
      );
    }

    const { appointmentId, ...visitInput } = parsed.data;
    let visitDoctorId = new mongoose.Types.ObjectId(authorization.user.id);
    let visitDoctorName = authorization.user.name;

    if (appointmentId) {
      const appointment = await Appointment.findById(appointmentId).select(
        "patientId doctorId status",
      );
      if (!appointment) {
        return NextResponse.json(
          { success: false, error: "Appointment not found" },
          { status: 404 },
        );
      }
      if (appointment.patientId.toString() !== id) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Appointment patient does not match the medical visit patient",
          },
          { status: 409 },
        );
      }
      if (
        appointment.status !== "ACCEPTED" &&
        appointment.status !== "COMPLETED"
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Only accepted or completed appointments can be linked to a medical visit",
          },
          { status: 409 },
        );
      }
      if (
        authorization.user.role === "DOCTOR" &&
        appointment.doctorId.toString() !== authorization.user.id
      ) {
        return authorizationError(403);
      }

      const appointmentDoctor = await User.findOne({
        _id: appointment.doctorId,
        role: "DOCTOR",
        isActive: true,
      }).select("name");
      if (!appointmentDoctor) {
        return NextResponse.json(
          { success: false, error: "The appointment does not have an active Doctor" },
          { status: 409 },
        );
      }

      visitDoctorId = appointmentDoctor._id;
      visitDoctorName = appointmentDoctor.name;
    }

    const visit = await MedicalVisit.create({
      ...visitInput,
      ...(appointmentId ? { appointmentId } : {}),
      patientId: id,
      doctorId: visitDoctorId,
      doctorName: visitDoctorName,
      updatedBy: authorization.user.id,
    });
    return NextResponse.json({ success: true, data: visit }, { status: 201 });
  } catch {
    return NextResponse.json(
      { success: false, error: "Unable to create medical visit" },
      { status: 500 },
    );
  }
}
