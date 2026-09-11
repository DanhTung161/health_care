import mongoose from "mongoose";
import { type NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import {
  BillingInsuranceError,
  parseInsuranceUpdate,
  updateBillingInsurance,
} from "@/lib/billing-insurance-management";
import connectDB from "@/lib/db";

type RouteContext = { params: Promise<{ id: string }> };

function authorizationError(status: 401 | 403) {
  return NextResponse.json(
    {
      success: false,
      error:
        status === 401
          ? "Authentication required"
          : "Forbidden: insurance may only be managed by ADMIN or STAFF",
    },
    { status },
  );
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  const user = await authenticateRequest(request);
  if (!user) return authorizationError(401);
  if (user.role !== "ADMIN" && user.role !== "STAFF") {
    return authorizationError(403);
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

  const parsed = parseInsuranceUpdate(body);
  if ("error" in parsed) {
    return NextResponse.json(
      { success: false, error: parsed.error.message },
      { status: parsed.error.status },
    );
  }

  try {
    await connectDB();
    const { id } = await params;
    const billing = await updateBillingInsurance(id, user.id, parsed.data);
    return NextResponse.json({ success: true, data: { billing } });
  } catch (error) {
    if (error instanceof BillingInsuranceError) {
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
      { success: false, error: "Unable to update insurance" },
      { status: 500 },
    );
  }
}
