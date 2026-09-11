import mongoose from "mongoose";
import { type NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import {
  BillingPaymentError,
  collectBillingPayment,
  parseIdempotencyKey,
  parsePaymentInput,
} from "@/lib/billing-payments";
import connectDB from "@/lib/db";

type RouteContext = { params: Promise<{ id: string }> };

function authorizationError(status: 401 | 403) {
  return NextResponse.json(
    {
      success: false,
      error:
        status === 401
          ? "Authentication required"
          : "Forbidden: payments may only be collected by ADMIN or STAFF",
    },
    { status },
  );
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const user = await authenticateRequest(request);
  if (!user) return authorizationError(401);
  if (user.role !== "ADMIN" && user.role !== "STAFF") {
    return authorizationError(403);
  }

  let idempotencyKey: string;
  try {
    idempotencyKey = parseIdempotencyKey(
      request.headers.get("Idempotency-Key"),
    );
  } catch (error) {
    if (error instanceof BillingPaymentError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status },
      );
    }
    throw error;
  }

  let body: unknown;
  try {
    body = (await request.json()) as unknown;
  } catch {
    return NextResponse.json(
      { success: false, error: "Request body must be valid JSON" },
      { status: 400 },
    );
  }
  const parsed = parsePaymentInput(body);
  if ("error" in parsed) {
    return NextResponse.json(
      { success: false, error: parsed.error.message },
      { status: parsed.error.status },
    );
  }

  try {
    await connectDB();
    const { id } = await params;
    const result = await collectBillingPayment(
      id,
      user.id,
      idempotencyKey,
      parsed.data,
    );
    return NextResponse.json(
      { success: true, data: result },
      { status: result.replayed ? 200 : 201 },
    );
  } catch (error) {
    if (error instanceof BillingPaymentError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status },
      );
    }
    if (error instanceof mongoose.Error.ValidationError) {
      return NextResponse.json(
        { success: false, error: "Payment data failed validation" },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { success: false, error: "Unable to collect payment" },
      { status: 500 },
    );
  }
}
