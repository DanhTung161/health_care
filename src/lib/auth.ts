import "server-only";

import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { cache } from "react";
import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE } from "@/lib/auth-constants";
import connectDB from "@/lib/db";
import { isRole, type Role } from "@/lib/roles";
import User from "@/models/User";

interface JwtPayload {
  userId: string;
  email: string;
  role: Role;
}

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export type AuthenticationResult =
  | { ok: true; user: AuthenticatedUser }
  | { ok: false; status: 401 | 403 };

function verifyAuthToken(token: string | undefined): JwtPayload | null {
  const jwtSecret = process.env.JWT_SECRET;
  if (!token || !jwtSecret) {
    return null;
  }

  try {
    const payload = jwt.verify(token, jwtSecret, {
      algorithms: ["HS256"],
    });

    if (
      typeof payload === "string" ||
      typeof payload.userId !== "string" ||
      typeof payload.email !== "string" ||
      !isRole(payload.role)
    ) {
      return null;
    }

    return {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
    };
  } catch {
    return null;
  }
}

async function getAuthenticatedUserFromToken(
  token: string | undefined,
): Promise<AuthenticatedUser | null> {
  const session = verifyAuthToken(token);
  if (!session || !mongoose.isValidObjectId(session.userId)) {
    return null;
  }

  await connectDB();
  const user = await User.findOne({ _id: session.userId, isActive: true }).select(
    "name email role",
  );

  if (!user || !isRole(user.role)) {
    return null;
  }

  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

export const getCurrentUser = cache(async (): Promise<AuthenticatedUser | null> => {
  const token = (await cookies()).get(AUTH_COOKIE)?.value;
  return getAuthenticatedUserFromToken(token);
});

export async function authenticateRequest(
  request: NextRequest,
): Promise<AuthenticatedUser | null> {
  return getAuthenticatedUserFromToken(request.cookies.get(AUTH_COOKIE)?.value);
}

export async function authorizeAdmin(
  request: NextRequest,
): Promise<AuthenticationResult> {
  const user = await authenticateRequest(request);

  if (!user) {
    return { ok: false, status: 401 };
  }

  if (user.role !== "ADMIN") {
    return { ok: false, status: 403 };
  }

  return { ok: true, user };
}
