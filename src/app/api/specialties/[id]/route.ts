import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { authorizeAdmin } from "@/lib/auth";
import connectDB from "@/lib/db";
import Specialty from "@/models/Specialty";
import User from "@/models/User";

type RouteContext = { params: Promise<{ id: string }> };

interface UpdateSpecialtyRequest {
  name?: string;
  description?: string;
}

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
    { success: false, error: "Invalid specialty id" },
    { status: 400 },
  );
}

function parseUpdateSpecialtyRequest(
  value: unknown,
): { data: UpdateSpecialtyRequest } | { error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { error: "Invalid request body" };
  }

  const body = value as Record<string, unknown>;
  const keys = Object.keys(body);
  if (!keys.length || keys.some((key) => key !== "name" && key !== "description")) {
    return { error: "Invalid request body" };
  }

  const data: UpdateSpecialtyRequest = {};
  if ("name" in body) {
    if (typeof body.name !== "string" || !body.name.trim()) {
      return { error: "Specialty name is required" };
    }
    data.name = body.name.trim();
  }

  if ("description" in body) {
    if (typeof body.description !== "string") {
      return { error: "Description must be a string" };
    }
    data.description = body.description.trim();
  }

  return { data };
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 11000
  );
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const authorization = await authorizeAdmin(request);
  if (!authorization.ok) {
    return authorizationError(authorization.status);
  }

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    return invalidIdError();
  }

  try {
    await connectDB();
    const specialty = await Specialty.findById(id).select(
      "name description createdAt updatedAt updatedBy",
    );
    if (!specialty) {
      return NextResponse.json(
        { success: false, error: "Specialty not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: specialty });
  } catch {
    return NextResponse.json(
      { success: false, error: "Unable to load specialty" },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  const authorization = await authorizeAdmin(request);
  if (!authorization.ok) {
    return authorizationError(authorization.status);
  }

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    return invalidIdError();
  }

  let requestBody: unknown;
  try {
    requestBody = (await request.json()) as unknown;
  } catch {
    return NextResponse.json(
      { success: false, error: "Request body must be valid JSON" },
      { status: 400 },
    );
  }

  const parsed = parseUpdateSpecialtyRequest(requestBody);
  if ("error" in parsed) {
    return NextResponse.json(
      { success: false, error: parsed.error },
      { status: 400 },
    );
  }

  try {
    await connectDB();
    if (
      parsed.data.name &&
      (await Specialty.exists({ name: parsed.data.name, _id: { $ne: id } }))
    ) {
      return NextResponse.json(
        { success: false, error: "A specialty with this name already exists" },
        { status: 409 },
      );
    }

    const specialty = await Specialty.findByIdAndUpdate(
      id,
      { ...parsed.data, updatedBy: authorization.user.id },
      { new: true, runValidators: true },
    ).select("name description createdAt updatedAt updatedBy");
    if (!specialty) {
      return NextResponse.json(
        { success: false, error: "Specialty not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: specialty });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return NextResponse.json(
        { success: false, error: "A specialty with this name already exists" },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { success: false, error: "Unable to update specialty" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const authorization = await authorizeAdmin(request);
  if (!authorization.ok) {
    return authorizationError(authorization.status);
  }

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    return invalidIdError();
  }

  try {
    await connectDB();
    const assignedDoctorCount = await User.countDocuments({
      role: "DOCTOR",
      specialtyId: id,
    });
    if (assignedDoctorCount > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot delete this specialty because it is assigned to ${assignedDoctorCount} doctor${assignedDoctorCount === 1 ? "" : "s"}`,
        },
        { status: 409 },
      );
    }

    const specialty = await Specialty.findByIdAndDelete(id);
    if (!specialty) {
      return NextResponse.json(
        { success: false, error: "Specialty not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, message: "Specialty deleted successfully" });
  } catch {
    return NextResponse.json(
      { success: false, error: "Unable to delete specialty" },
      { status: 500 },
    );
  }
}
