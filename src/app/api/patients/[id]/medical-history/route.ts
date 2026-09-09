import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import {
  authenticateRequest,
  type AuthenticatedUser,
} from "@/lib/auth";
import connectDB from "@/lib/db";
import { parseMedicalVisitInput } from "@/lib/medical-visit";
import MedicalVisit from "@/models/MedicalVisit";
import Patient from "@/models/Patient";

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

  try {
    await connectDB();
    if (!(await Patient.exists({ _id: id }))) {
      return NextResponse.json(
        { success: false, error: "Patient not found" },
        { status: 404 },
      );
    }
    const visit = await MedicalVisit.create({
      ...parsed.data,
      patientId: id,
      doctorId: authorization.user.id,
      doctorName: authorization.user.name,
    });
    return NextResponse.json({ success: true, data: visit }, { status: 201 });
  } catch {
    return NextResponse.json(
      { success: false, error: "Unable to create medical visit" },
      { status: 500 },
    );
  }
}
