import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { AUTH_COOKIE } from "@/lib/auth-constants";
import connectDB from "@/lib/db";
import { isRole, type Role } from "@/lib/roles";
import User from "@/models/User";

interface JwtPayload {
  userId: string;
  email: string;
  role: Role;
}

interface LoginRequestBody {
  email: string;
  password: string;
}

function isLoginRequestBody(value: unknown): value is LoginRequestBody {
  if (!value || typeof value !== "object") {
    return false;
  }

  const body = value as Record<string, unknown>;

  return typeof body.email === "string" && typeof body.password === "string";
}

export async function POST(request: NextRequest) {
  try {
    const requestBody = (await request.json()) as unknown;

    if (!isLoginRequestBody(requestBody)) {
      return NextResponse.json(
        { success: false, message: "Email và mật khẩu không hợp lệ" },
        { status: 400 },
      );
    }

    const email = requestBody.email.trim().toLowerCase();
    const password = requestBody.password;

    await connectDB();
    const user = await User.findOne({ email, isActive: true }).select("+password");

    if (!user || !user.password) {
      return NextResponse.json(
        { success: false, message: "Email hoặc mật khẩu không chính xác" },
        { status: 401 },
      );
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return NextResponse.json(
        { success: false, message: "Email hoặc mật khẩu không chính xác" },
        { status: 401 },
      );
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return NextResponse.json(
        { success: false, message: "Thiếu cấu hình JWT_SECRET" },
        { status: 500 },
      );
    }

    if (!isRole(user.role)) {
      return NextResponse.json(
        { success: false, message: "Vai trò tài khoản không hợp lệ" },
        { status: 403 },
      );
    }

    const payload: JwtPayload = {
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
    };
    const token = jwt.sign(payload, jwtSecret, {
      algorithm: "HS256",
      expiresIn: "1d",
    });

    const response = NextResponse.json({
      success: true,
      message: "Đăng nhập thành công",
      data: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });

    response.cookies.set(AUTH_COOKIE, token, {
      httpOnly: true,
      path: "/",
      maxAge: 60 * 60 * 24,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    response.cookies.set("healthnexus.session", "", {
      path: "/",
      maxAge: 0,
    });
    response.cookies.set("healthnexus.role", "", {
      path: "/",
      maxAge: 0,
    });

    return response;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "An unexpected error occurred";

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 },
    );
  }
}
