import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { authorizeAdmin } from "@/lib/auth";
import connectDB from "@/lib/db";
import { isRole, type Role } from "@/lib/roles";
import User from "@/models/User";

type RouteContext = { params: Promise<{ id: string }> };

const BCRYPT_SALT_ROUNDS = 10;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EDITABLE_FIELDS = new Set([
  "name", "email", "password", "role", "phone", "isActive",
]);

interface UpdateUserRequest {
  name?: string;
  email?: string;
  password?: string;
  role?: Role;
  phone?: string;
  isActive?: boolean;
}

function authorizationError(status: 401 | 403) {
  return NextResponse.json({ success: false, error: status === 401 ? "Authentication required" : "Forbidden: administrator access required" }, { status });
}

function invalidIdError() {
  return NextResponse.json({ success: false, error: "Invalid user id" }, { status: 400 });
}

function parseUpdateUserRequest(value: unknown): { data: UpdateUserRequest } | { error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { error: "Invalid request body" };

  const body = value as Record<string, unknown>;
  const keys = Object.keys(body);
  if (!keys.length || keys.some((key) => !EDITABLE_FIELDS.has(key))) return { error: "Invalid request body" };

  const data: UpdateUserRequest = {};
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
    // An empty password is the UI convention for retaining the existing password.
    if (body.password) {
      if (body.password.length < 8 || body.password.length > 128) return { error: "Password must be between 8 and 128 characters" };
      data.password = body.password;
    }
  }
  if ("role" in body) {
    if (!isRole(body.role)) return { error: "Role must be ADMIN, DOCTOR, or STAFF" };
    data.role = body.role;
  }
  if ("phone" in body) {
    if (typeof body.phone !== "string" || body.phone.trim().length > 30) return { error: "Phone number must be 30 characters or fewer" };
    data.phone = body.phone.trim();
  }
  if ("isActive" in body) {
    if (typeof body.isActive !== "boolean") return { error: "Account status must be active or inactive" };
    data.isActive = body.isActive;
  }
  if (!Object.keys(data).length) return { error: "No user changes were provided" };
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
    const user = await User.findById(id).select("name email role phone isActive createdAt updatedAt");
    if (!user) return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    return NextResponse.json({ success: true, data: user });
  } catch {
    return NextResponse.json({ success: false, error: "Unable to load user" }, { status: 500 });
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
  const parsed = parseUpdateUserRequest(requestBody);
  if ("error" in parsed) return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });

  try {
    await connectDB();
    if (parsed.data.email) {
      const existingUser = await User.exists({ email: parsed.data.email, _id: { $ne: id } });
      if (existingUser) return NextResponse.json({ success: false, error: "An account with this email already exists" }, { status: 409 });
    }

    const update: UpdateUserRequest = { ...parsed.data };
    if (update.password) update.password = await bcrypt.hash(update.password, BCRYPT_SALT_ROUNDS);
    else delete update.password;

    const updatedUser = await User.findByIdAndUpdate(id, update, { new: true, runValidators: true })
      .select("name email role phone isActive");
    if (!updatedUser) return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    return NextResponse.json({
      success: true,
      data: { _id: updatedUser._id.toString(), name: updatedUser.name, email: updatedUser.email, role: updatedUser.role, phone: updatedUser.phone, isActive: updatedUser.isActive },
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) return NextResponse.json({ success: false, error: "An account with this email already exists" }, { status: 409 });
    return NextResponse.json({ success: false, error: "Unable to update user" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const authorization = await authorizeAdmin(request);
  if (!authorization.ok) return authorizationError(authorization.status);
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return invalidIdError();
  if (authorization.user.id === id) return NextResponse.json({ success: false, error: "You cannot delete your own account" }, { status: 400 });

  try {
    await connectDB();
    const deletedUser = await User.findByIdAndDelete(id);
    if (!deletedUser) return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    return NextResponse.json({ success: true, message: "User deleted successfully" });
  } catch {
    return NextResponse.json({ success: false, error: "Unable to delete user" }, { status: 500 });
  }
}
