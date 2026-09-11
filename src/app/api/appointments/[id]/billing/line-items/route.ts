import mongoose from "mongoose";
import { type NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import {
  addClinicalServiceOrder,
  BillingServiceOrderError,
  parseServiceOrderInput,
} from "@/lib/billing-service-orders";
import connectDB from "@/lib/db";

type RouteContext = { params: Promise<{ id: string }> };

function authorizationError(status: 401 | 403) {
  return NextResponse.json(
    {
      success: false,
      error:
        status === 401
          ? "Authentication required"
          : "Forbidden: clinical orders are limited to the assigned doctor",
    },
    { status },
  );
}

function mutationError(error: unknown) {
  if (error instanceof BillingServiceOrderError) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: error.status },
    );
  }
  if (error instanceof mongoose.Error.ValidationError) {
    return NextResponse.json(
      { success: false, error: "Billing data failed validation" },
      { status: 400 },
    );
  }
  return NextResponse.json(
    { success: false, error: "Unable to add the clinical order" },
    { status: 500 },
  );
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const user = await authenticateRequest(request);
  if (!user) return authorizationError(401);
  if (user.role !== "DOCTOR") return authorizationError(403);

  let body: unknown;
  try {
    body = (await request.json()) as unknown;
  } catch {
    return NextResponse.json(
      { success: false, error: "Request body must be valid JSON" },
      { status: 400 },
    );
  }

  const parsed = parseServiceOrderInput(body);
  if ("error" in parsed) {
    return NextResponse.json(
      { success: false, error: parsed.error.message },
      { status: parsed.error.status },
    );
  }

  try {
    await connectDB();
    const { id } = await params;
    const result = await addClinicalServiceOrder(id, user.id, parsed.data);
    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    return mutationError(error);
  }
}

