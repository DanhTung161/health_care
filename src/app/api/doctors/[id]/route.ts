import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { authorizeAdmin } from "@/lib/auth";
import connectDB from "@/lib/db";
import Specialty from "@/models/Specialty";
import User from "@/models/User";

type RouteContext = { params: Promise<{ id: string }> };

const BCRYPT_SALT_ROUNDS = 10;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EDITABLE_FIELDS = new Set(["name", "email", "password", "phone", "specialtyId", "isActive"]);

interface UpdateDoctorRequest {
  name?: string;
  email?: string;
  password?: string;
  phone?: string;
  specialtyId?: string;
  isActive?: boolean;
}

function authorizationError(status: 401 | 403) {
  return NextResponse.json(
    { success: false, error: status === 401 ? "Authentication required" : "Forbidden: administrator access required" },
    { status },
  );
}

function invalidIdError() {
  return NextResponse.json({ success: false, error: "Invalid doctor id" }, { status: 400 });
}

function parseUpdateDoctorRequest(value: unknown): { data: UpdateDoctorRequest } | { error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { error: "Invalid request body" };
  const body = value as Record<string, unknown>;
  const keys = Object.keys(body);
  if (!keys.length || keys.some((key) => !EDITABLE_FIELDS.has(key))) return { error: "Invalid request body" };

  const data: UpdateDoctorRequest = {};
  if ("name" in body) {
    if (typeof body.name !== "string" || !body.name.trim() || body.name.trim().length > 100) return { error: "Name must be between 1 and 100 characters" };
    data.name = body.name.trim();
  }
  if ("email" in body) {
    if (typeof body.email !== "string") return { error: "Email address is invalid" };
    const email = body.email.trim().toLowerCase();
    if (email.length > 254 || !EMAIL_PATTERN.test(email)) return { error: "Email address is invalid" };
    data.email = email;
  }
  if ("password" in body) {
    if (typeof body.password !== "string") return { error: "Password must be between 8 and 128 characters" };
    if (body.password) {
      if (body.password.length < 8 || body.password.length > 128) return { error: "Password must be between 8 and 128 characters" };
      data.password = body.password;
    }
  }
  if ("phone" in body) {
    if (typeof body.phone !== "string" || body.phone.trim().length > 30) return { error: "Phone number must be 30 characters or fewer" };
    data.phone = body.phone.trim();
  }
  if ("specialtyId" in body) {
    if (typeof body.specialtyId !== "string") return { error: "Specialty is invalid" };
    const specialtyId = body.specialtyId.trim();
    if (!specialtyId || !mongoose.isValidObjectId(specialtyId)) return { error: "A valid specialty is required" };
    data.specialtyId = specialtyId;
  }
  if ("isActive" in body) {
    if (typeof body.isActive !== "boolean") return { error: "Account status must be active or inactive" };
    data.isActive = body.isActive;
  }
  if (!Object.keys(data).length) return { error: "No doctor changes were provided" };
  return { data };
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const authorization = await authorizeAdmin(request);
  if (!authorization.ok) return authorizationError(authorization.status);
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return invalidIdError();

  try {
    await connectDB();
    const doctor = await User.findOne({ _id: id, role: "DOCTOR" })
      .select("name email phone specialtyId isActive createdAt updatedAt updatedBy")
      .populate("specialtyId", "name");
    if (!doctor) return NextResponse.json({ success: false, error: "Doctor not found" }, { status: 404 });
    return NextResponse.json({ success: true, data: doctor });
  } catch {
    return NextResponse.json({ success: false, error: "Unable to load doctor" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  const authorization = await authorizeAdmin(request);
  if (!authorization.ok) return authorizationError(authorization.status);
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return invalidIdError();

  let requestBody: unknown;
  try { requestBody = (await request.json()) as unknown; } catch {
    return NextResponse.json({ success: false, error: "Request body must be valid JSON" }, { status: 400 });
  }
  const parsed = parseUpdateDoctorRequest(requestBody);
  if ("error" in parsed) return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });

  try {
    await connectDB();
    if (parsed.data.email && await User.exists({ email: parsed.data.email, _id: { $ne: id } })) {
      return NextResponse.json({ success: false, error: "An account with this email already exists" }, { status: 409 });
    }
    if (parsed.data.specialtyId && !(await Specialty.exists({ _id: parsed.data.specialtyId }))) {
      return NextResponse.json({ success: false, error: "Specialty not found" }, { status: 404 });
    }

    const update: UpdateDoctorRequest = { ...parsed.data };
    if (update.password) update.password = await bcrypt.hash(update.password, BCRYPT_SALT_ROUNDS);
    else delete update.password;

    const doctor = await User.findOneAndUpdate(
      { _id: id, role: "DOCTOR" },
      { ...update, updatedBy: authorization.user.id },
      { new: true, runValidators: true },
    )
      .select("name email phone specialtyId isActive updatedAt updatedBy")
      .populate("specialtyId", "name");
    if (!doctor) return NextResponse.json({ success: false, error: "Doctor not found" }, { status: 404 });
    return NextResponse.json({ success: true, data: doctor });
  } catch (error) {
    if (isDuplicateKeyError(error)) return NextResponse.json({ success: false, error: "An account with this email already exists" }, { status: 409 });
    return NextResponse.json({ success: false, error: "Unable to update doctor" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const authorization = await authorizeAdmin(request);
  if (!authorization.ok) return authorizationError(authorization.status);
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return invalidIdError();

  try {
    await connectDB();
    const doctor = await User.findOneAndDelete({ _id: id, role: "DOCTOR" });
    if (!doctor) return NextResponse.json({ success: false, error: "Doctor not found" }, { status: 404 });
    return NextResponse.json({ success: true, message: "Doctor deleted successfully" });
  } catch {
    return NextResponse.json({ success: false, error: "Unable to delete doctor" }, { status: 500 });
  }
}
