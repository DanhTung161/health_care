import { NextRequest, NextResponse } from "next/server";
import { authorizeAdmin } from "@/lib/auth";
import connectDB from "@/lib/db";
import Specialty from "@/models/Specialty";

interface CreateSpecialtyRequest {
  name: string;
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

function parseCreateSpecialtyRequest(
  value: unknown,
): { data: CreateSpecialtyRequest } | { error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { error: "Invalid request body" };
  }

  const body = value as Record<string, unknown>;
  if (Object.keys(body).some((key) => key !== "name" && key !== "description")) {
    return { error: "Invalid request body" };
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return { error: "Specialty name is required" };
  }

  if ("description" in body && typeof body.description !== "string") {
    return { error: "Description must be a string" };
  }

  const description =
    typeof body.description === "string" ? body.description.trim() : undefined;

  return {
    data: {
      name,
      ...(description ? { description } : {}),
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
  const authorization = await authorizeAdmin(request);
  if (!authorization.ok) {
    return authorizationError(authorization.status);
  }

  try {
    await connectDB();
    const specialties = await Specialty.find({})
      .select("name description createdAt updatedAt updatedBy")
      .sort({ name: 1 });

    return NextResponse.json({ success: true, data: specialties });
  } catch {
    return NextResponse.json(
      { success: false, error: "Unable to load specialties" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
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

  const parsed = parseCreateSpecialtyRequest(requestBody);
  if ("error" in parsed) {
    return NextResponse.json(
      { success: false, error: parsed.error },
      { status: 400 },
    );
  }

  try {
    await connectDB();
    if (await Specialty.exists({ name: parsed.data.name })) {
      return NextResponse.json(
        { success: false, error: "A specialty with this name already exists" },
        { status: 409 },
      );
    }

    const specialty = await Specialty.create(parsed.data);
    return NextResponse.json(
      {
        success: true,
        data: {
          _id: specialty._id.toString(),
          name: specialty.name,
          description: specialty.description,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return NextResponse.json(
        { success: false, error: "A specialty with this name already exists" },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { success: false, error: "Unable to create specialty" },
      { status: 500 },
    );
  }
}
