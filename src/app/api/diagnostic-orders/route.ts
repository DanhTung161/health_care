import mongoose from "mongoose";
import { type NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import connectDB from "@/lib/db";
import {
  canCreateDiagnosticOrder,
  canReadDiagnosticOrders,
  createDiagnosticOrder,
  DiagnosticOrderError,
  listDiagnosticOrders,
  parseCreateDiagnosticOrderInput,
  parseDiagnosticOrderListInput,
} from "@/lib/diagnostic-orders";

function authorizationError(status: 401 | 403, action: "create" | "read") {
  return NextResponse.json(
    {
      success: false,
      error:
        status === 401
          ? "Authentication required"
          : action === "create"
            ? "Forbidden: only the assigned doctor can create diagnostic orders"
            : "Forbidden: diagnostic order access denied",
    },
    { status },
  );
}

function operationError(error: unknown, fallback: string) {
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
    { success: false, error: fallback },
    { status: 500 },
  );
}

export async function GET(request: NextRequest) {
  const user = await authenticateRequest(request);
  if (!user) return authorizationError(401, "read");
  if (!canReadDiagnosticOrders(user.role)) {
    return authorizationError(403, "read");
  }

  const parsed = parseDiagnosticOrderListInput(request.nextUrl.searchParams);
  if ("error" in parsed) {
    return operationError(parsed.error, "Unable to load diagnostic orders");
  }

  try {
    await connectDB();
    const result = await listDiagnosticOrders(parsed.data, user);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return operationError(error, "Unable to load diagnostic orders");
  }
}

export async function POST(request: NextRequest) {
  const user = await authenticateRequest(request);
  if (!user) return authorizationError(401, "create");
  if (!canCreateDiagnosticOrder(user.role)) {
    return authorizationError(403, "create");
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

  const parsed = parseCreateDiagnosticOrderInput(body);
  if ("error" in parsed) {
    return operationError(parsed.error, "Unable to create diagnostic order");
  }

  try {
    await connectDB();
    const order = await createDiagnosticOrder(user, parsed.data);
    return NextResponse.json({ success: true, data: order }, { status: 201 });
  } catch (error) {
    return operationError(error, "Unable to create diagnostic order");
  }
}
