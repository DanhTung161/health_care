import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, authorizeAdmin } from "@/lib/auth";
import connectDB from "@/lib/db";
import {
  isDuplicateKeyError,
  parsePatientInput,
} from "@/lib/patient-management";
import Patient from "@/models/Patient";

type RouteContext = { params: Promise<{ id: string }> };

function authorizationError(status: 401 | 403) {
  return NextResponse.json(
    {
      success: false,
      error:
        status === 401
          ? "Authentication required"
          : "Forbidden: administrator access required",
    },
    { status },
  );
}

function invalidIdError() {
  return NextResponse.json(
    { success: false, error: "Invalid patient id" },
    { status: 400 },
  );
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  if (!(await authenticateRequest(request))) return authorizationError(401);

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return invalidIdError();

  try {
    await connectDB();
    // Archived records remain directly retrievable for historical references.
    const patient = await Patient.findById(id).populate(
      "medicalRecords.doctorId",
      "name specialtyId",
    );
    if (!patient) {
      return NextResponse.json(
        { success: false, error: "Patient not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ success: true, data: patient });
  } catch {
    return NextResponse.json(
      { success: false, error: "Unable to load patient" },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  const authorization = await authorizeAdmin(request);
  if (!authorization.ok) return authorizationError(authorization.status);

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return invalidIdError();

  let body: unknown;
  try {
    body = (await request.json()) as unknown;
  } catch {
    return NextResponse.json(
      { success: false, error: "Request body must be valid JSON" },
      { status: 400 },
    );
  }

  const parsed = parsePatientInput(body, true);
  if ("error" in parsed) {
    return NextResponse.json(
      { success: false, error: parsed.error },
      { status: 400 },
    );
  }

  try {
    await connectDB();
    const patient = await Patient.findByIdAndUpdate(id, {
      ...parsed.data,
      updatedBy: authorization.user.id,
    }, {
      new: true,
      runValidators: true,
    }).select(
      "fullName phone identityCard gender dateOfBirth address deletedAt createdAt updatedAt updatedBy",
    );
    if (!patient) {
      return NextResponse.json(
        { success: false, error: "Patient not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ success: true, data: patient });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return NextResponse.json(
        { success: false, error: "A patient with this phone number already exists" },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { success: false, error: "Unable to update patient" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const authorization = await authorizeAdmin(request);
  if (!authorization.ok) return authorizationError(authorization.status);

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return invalidIdError();

  try {
    await connectDB();
    const patient = await Patient.findByIdAndUpdate(
      id,
      { deletedAt: new Date(), updatedBy: authorization.user.id },
      { new: true, runValidators: true },
    ).select(
      "fullName phone identityCard gender dateOfBirth address deletedAt createdAt updatedAt updatedBy",
    );
    if (!patient) {
      return NextResponse.json(
        { success: false, error: "Patient not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({
      success: true,
      message: "Patient archived successfully",
      data: patient,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Unable to archive patient" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const authorization = await authorizeAdmin(request);
  if (!authorization.ok) return authorizationError(authorization.status);

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return invalidIdError();

  let body: unknown;
  try {
    body = (await request.json()) as unknown;
  } catch {
    return NextResponse.json(
      { success: false, error: "Request body must be valid JSON" },
      { status: 400 },
    );
  }

  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.keys(body).length !== 1 ||
    (body as Record<string, unknown>).action !== "restore"
  ) {
    return NextResponse.json(
      { success: false, error: "Invalid restore request" },
      { status: 400 },
    );
  }

  try {
    await connectDB();
    const patient = await Patient.findByIdAndUpdate(
      id,
      { deletedAt: null, updatedBy: authorization.user.id },
      { new: true, runValidators: true },
    ).select(
      "fullName phone identityCard gender dateOfBirth address deletedAt createdAt updatedAt updatedBy",
    );
    if (!patient) {
      return NextResponse.json(
        { success: false, error: "Patient not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({
      success: true,
      message: "Patient restored successfully",
      data: patient,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Unable to restore patient" },
      { status: 500 },
    );
  }
}
