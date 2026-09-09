import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { authorizeAdmin } from "@/lib/auth";
import connectDB from "@/lib/db";
import Specialty from "@/models/Specialty";
import User from "@/models/User";

const BCRYPT_SALT_ROUNDS = 10;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface CreateDoctorRequest {
  name: string;
  email: string;
  password: string;
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

function parseCreateDoctorRequest(value: unknown): { data: CreateDoctorRequest } | { error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { error: "Invalid request body" };
  const body = value as Record<string, unknown>;
  const fields = new Set(["name", "email", "password", "phone", "specialtyId", "isActive"]);
  if (Object.keys(body).some((key) => !fields.has(key))) return { error: "Invalid request body" };

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!name || !email || !password) return { error: "Name, email, and password are required" };
  if (name.length > 100) return { error: "Name must be 100 characters or fewer" };
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) return { error: "Email address is invalid" };
  if (password.length < 8 || password.length > 128) return { error: "Password must be between 8 and 128 characters" };

  if ("phone" in body && typeof body.phone !== "string") return { error: "Phone number must be a string" };
  const phone = typeof body.phone === "string" ? body.phone.trim() : undefined;
  if (phone && phone.length > 30) return { error: "Phone number must be 30 characters or fewer" };

  if ("specialtyId" in body && typeof body.specialtyId !== "string") return { error: "Specialty is invalid" };
  const specialtyId = typeof body.specialtyId === "string" ? body.specialtyId.trim() : undefined;
  if (specialtyId && !mongoose.isValidObjectId(specialtyId)) return { error: "Specialty is invalid" };
  if ("isActive" in body && typeof body.isActive !== "boolean") return { error: "Account status must be active or inactive" };

  return {
    data: {
      name,
      email,
      password,
      ...(phone ? { phone } : {}),
      ...(specialtyId ? { specialtyId } : {}),
      ...(typeof body.isActive === "boolean" ? { isActive: body.isActive } : {}),
    },
  };
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

export async function GET(request: NextRequest) {
  const authorization = await authorizeAdmin(request);
  if (!authorization.ok) return authorizationError(authorization.status);
  try {
    await connectDB();
    const doctors = await User.find({ role: "DOCTOR" })
      .select("name email phone specialtyId isActive createdAt updatedAt")
      .populate("specialtyId", "name")
      .sort({ name: 1 });
    return NextResponse.json({ success: true, data: doctors });
  } catch {
    return NextResponse.json({ success: false, error: "Unable to load doctors" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authorization = await authorizeAdmin(request);
  if (!authorization.ok) return authorizationError(authorization.status);
  let requestBody: unknown;
  try { requestBody = (await request.json()) as unknown; } catch {
    return NextResponse.json({ success: false, error: "Request body must be valid JSON" }, { status: 400 });
  }
  const parsed = parseCreateDoctorRequest(requestBody);
  if ("error" in parsed) return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });

  try {
    await connectDB();
    if (await User.exists({ email: parsed.data.email })) {
      return NextResponse.json({ success: false, error: "An account with this email already exists" }, { status: 409 });
    }
    if (parsed.data.specialtyId && !(await Specialty.exists({ _id: parsed.data.specialtyId }))) {
      return NextResponse.json({ success: false, error: "Specialty not found" }, { status: 404 });
    }
    const doctor = await User.create({
      ...parsed.data,
      password: await bcrypt.hash(parsed.data.password, BCRYPT_SALT_ROUNDS),
      role: "DOCTOR",
    });
    return NextResponse.json({
      success: true,
      data: {
        _id: doctor._id.toString(),
        name: doctor.name,
        email: doctor.email,
        phone: doctor.phone,
        specialtyId: doctor.specialtyId?.toString(),
        isActive: doctor.isActive,
      },
    }, { status: 201 });
  } catch (error) {
    if (isDuplicateKeyError(error)) return NextResponse.json({ success: false, error: "An account with this email already exists" }, { status: 409 });
    return NextResponse.json({ success: false, error: "Unable to create doctor" }, { status: 500 });
  }
}
