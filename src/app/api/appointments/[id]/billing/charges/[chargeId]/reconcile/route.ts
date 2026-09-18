import mongoose from "mongoose";
import { type NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import {
  BillingSettlementError,
  parseChargeReconciliationInput,
  parseSettlementIdempotencyKey,
  reconcileDiagnosticChargeRefund,
} from "@/lib/billing-settlement";
import connectDB from "@/lib/db";

type RouteContext = { params: Promise<{ id: string; chargeId: string }> };

export async function POST(request: NextRequest, { params }: RouteContext) {
  const user = await authenticateRequest(request);
  if (!user) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 },
    );
  }
  if (user.role !== "ADMIN" && user.role !== "STAFF") {
    return NextResponse.json(
      { success: false, error: "Only ADMIN or STAFF may reconcile Charges" },
      { status: 403 },
    );
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
  const parsed = parseChargeReconciliationInput(body);
  if ("error" in parsed) {
    return NextResponse.json(
      { success: false, error: parsed.error.message },
      { status: parsed.error.status },
    );
  }

  try {
    await connectDB();
    const { id, chargeId } = await params;
    const result = await reconcileDiagnosticChargeRefund(
      id,
      chargeId,
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
        { success: false, error: "Reconciliation failed validation" },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { success: false, error: "Unable to reconcile Charge" },
      { status: 500 },
    );
  }
}
