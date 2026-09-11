import mongoose from "mongoose";
import { type NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import {
  BillingServiceOrderError,
  parseServiceOrderInput,
  removeClinicalServiceOrder,
  updateClinicalServiceOrder,
} from "@/lib/billing-service-orders";
import connectDB from "@/lib/db";

type RouteContext = {
  params: Promise<{ id: string; lineItemId: string }>;
};

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

function mutationError(error: unknown, action: "update" | "remove") {
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
    { success: false, error: `Unable to ${action} the clinical order` },
    { status: 500 },
  );
}

async function requireDoctor(request: NextRequest) {
  const user = await authenticateRequest(request);
  if (!user) return { response: authorizationError(401) } as const;
  if (user.role !== "DOCTOR") {
    return { response: authorizationError(403) } as const;
  }
  return { user } as const;
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  const authorization = await requireDoctor(request);
  if ("response" in authorization) return authorization.response;

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
    const { id, lineItemId } = await params;
    const result = await updateClinicalServiceOrder(
      id,
      lineItemId,
      authorization.user.id,
      parsed.data,
    );
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return mutationError(error, "update");
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: RouteContext,
) {
  const authorization = await requireDoctor(request);
  if ("response" in authorization) return authorization.response;

  try {
    await connectDB();
    const { id, lineItemId } = await params;
    const result = await removeClinicalServiceOrder(
      id,
      lineItemId,
      authorization.user.id,
    );
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return mutationError(error, "remove");
  }
}

