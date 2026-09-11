import mongoose from "mongoose";
import { type NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import {
  BillingSettlementError,
  parseRefundInput,
  parseSettlementIdempotencyKey,
  processBillingRefund,
} from "@/lib/billing-settlement";
import connectDB from "@/lib/db";

type RouteContext = { params: Promise<{ id: string }> };

function authorizationError(status: 401 | 403) {
  return NextResponse.json(
    {
      success: false,
      error:
        status === 401
          ? "Authentication required"
          : "Forbidden: refunds may only be processed by ADMIN or STAFF",
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
    idempotencyKey = parseSettlementIdempotencyKey(
      request.headers.get("Idempotency-Key"),
    );
  } catch (error) {
    if (error instanceof BillingSettlementError) {
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
  const parsed = parseRefundInput(body);
  if ("error" in parsed) {
    return NextResponse.json(
      { success: false, error: parsed.error.message },
      { status: parsed.error.status },
    );
  }

  try {
    await connectDB();
    const { id } = await params;
    const result = await processBillingRefund(
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
    if (error instanceof BillingSettlementError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status },
      );
    }
    if (error instanceof mongoose.Error.ValidationError) {
      return NextResponse.json(
        { success: false, error: "Refund data failed validation" },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { success: false, error: "Unable to process refund" },
      { status: 500 },
    );
  }
}
