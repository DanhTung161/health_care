import mongoose from "mongoose";
import { type NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import connectDB from "@/lib/db";
import {
  parseDiagnosticItemTransitionInput,
  transitionDiagnosticOrderItem,
} from "@/lib/diagnostic-item-transitions";
import { DiagnosticOrderError } from "@/lib/diagnostic-orders";

type RouteContext = {
  params: Promise<{ orderId: string; itemId: string }>;
};

function operationError(error: unknown) {
  if (error instanceof DiagnosticOrderError) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: error.status },
    );
  }
  if (error instanceof mongoose.Error.ValidationError) {
    return NextResponse.json(
      { success: false, error: "Diagnostic item data failed validation" },
      { status: 400 },
    );
  }
  return NextResponse.json(
    { success: false, error: "Unable to transition diagnostic order item" },
    { status: 500 },
  );
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const user = await authenticateRequest(request);
  if (!user) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 },
    );
  }

  const { orderId, itemId } = await params;
  if (!mongoose.isValidObjectId(orderId)) {
    return NextResponse.json(
      { success: false, error: "Invalid diagnostic order id" },
      { status: 400 },
    );
  }
  if (!mongoose.isValidObjectId(itemId)) {
    return NextResponse.json(
      { success: false, error: "Invalid diagnostic order item id" },
      { status: 400 },
    );
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

  const parsed = parseDiagnosticItemTransitionInput(body);
  if ("error" in parsed) return operationError(parsed.error);

  try {
    await connectDB();
    const result = await transitionDiagnosticOrderItem(
      orderId,
      itemId,
      user,
      parsed.data,
    );
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return operationError(error);
  }
}
