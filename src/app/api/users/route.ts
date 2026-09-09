import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { authorizeAdmin } from "@/lib/auth";
import connectDB from "@/lib/db";
import { isRole, type Role } from "@/lib/roles";
import User from "@/models/User";

const BCRYPT_SALT_ROUNDS = 10;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface CreateUserRequest {
  name: string;
  email: string;
  password: string;
  role: Role;
  phone?: string;
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

function parseCreateUserRequest(
  value: unknown,
): { data: CreateUserRequest } | { error: string } {
  if (!value || typeof value !== "object") {
    return { error: "Invalid request body" };
  }

  const body = value as Record<string, unknown>;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : undefined;

  if (!name || !email || !password || !isRole(body.role)) {
    return { error: "Name, email, password, and a valid role are required" };
  }

  if (name.length > 100) {
    return { error: "Name must be 100 characters or fewer" };
  }

  if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    return { error: "Email address is invalid" };
  }

  if (password.length < 8 || password.length > 128) {
    return { error: "Password must be between 8 and 128 characters" };
  }

  if (phone && phone.length > 30) {
    return { error: "Phone number must be 30 characters or fewer" };
  }

  return {
    data: {
      name,
      email,
      password,
      role: body.role,
      ...(phone ? { phone } : {}),
    },
  };
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 11000
  );
}

export async function GET(request: NextRequest) {
  try {
    const authorization = await authorizeAdmin(request);
    if (!authorization.ok) {
      return authorizationError(authorization.status);
    }

    await connectDB();
    const users = await User.find({})
      .select("name email role phone isActive createdAt updatedAt")
      .sort({ createdAt: -1 });

    return NextResponse.json({ success: true, data: users });
  } catch {
    return NextResponse.json(
      { success: false, error: "Unable to load users" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authorization = await authorizeAdmin(request);
    if (!authorization.ok) {
      return authorizationError(authorization.status);
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

    const parsed = parseCreateUserRequest(requestBody);
    if ("error" in parsed) {
      return NextResponse.json(
        { success: false, error: parsed.error },
        { status: 400 },
      );
    }

    await connectDB();
    const existingUser = await User.exists({ email: parsed.data.email });
    if (existingUser) {
      return NextResponse.json(
        { success: false, error: "An account with this email already exists" },
        { status: 409 },
      );
    }

    const passwordHash = await bcrypt.hash(
      parsed.data.password,
      BCRYPT_SALT_ROUNDS,
    );
    const user = await User.create({
      name: parsed.data.name,
      email: parsed.data.email,
      password: passwordHash,
      role: parsed.data.role,
      ...(parsed.data.phone ? { phone: parsed.data.phone } : {}),
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          _id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          phone: user.phone,
          isActive: user.isActive,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return NextResponse.json(
        { success: false, error: "An account with this email already exists" },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { success: false, error: "Unable to create user" },
      { status: 500 },
    );
  }
}
