import mongoose from "mongoose";
import { type NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import connectDB from "@/lib/db";
import {
  canReadDiagnosticOrders,
  DiagnosticOrderError,
  getDiagnosticOrder,
} from "@/lib/diagnostic-orders";

type RouteContext = { params: Promise<{ id: string }> };

function authorizationError(status: 401 | 403) {
  return NextResponse.json(
    {
      success: false,
      error:
        status === 401
          ? "Authentication required"
          : "Forbidden: diagnostic order access denied",
    },
    { status },
  );
}

function operationError(error: unknown) {
  if (error instanceof DiagnosticOrderError) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: error.status },
    );
  }
  if (error instanceof mongoose.Error.ValidationError) {
    return NextResponse.json(
      { success: false, error: "Diagnostic order data failed validation" },
      { status: 400 },
    );
  }
  return NextResponse.json(
    { success: false, error: "Unable to load diagnostic order" },
    { status: 500 },
  );
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const user = await authenticateRequest(request);
  if (!user) return authorizationError(401);
  if (!canReadDiagnosticOrders(user.role)) return authorizationError(403);

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json(
      { success: false, error: "Invalid diagnostic order id" },
      { status: 400 },
    );
  }

  try {
    await connectDB();
    const order = await getDiagnosticOrder(id, user);
    return NextResponse.json({ success: true, data: order });
  } catch (error) {
    return operationError(error);
  }
}
