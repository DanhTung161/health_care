import { type NextRequest } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import connectDB from "@/lib/db";
import {
  canMutateDiagnosticResults,
  canReadDiagnosticResults,
  createDiagnosticResult,
  getCurrentDiagnosticResult,
} from "@/lib/diagnostic-result-service";
import {
  diagnosticResultAuthorizationError,
  diagnosticResultOperationError,
  diagnosticResultSuccess,
  readResultJsonBody,
} from "@/lib/diagnostic-result-route";

type RouteContext = {
  params: Promise<{ orderId: string; itemId: string }>;
};

export async function GET(request: NextRequest, { params }: RouteContext) {
  const user = await authenticateRequest(request);
  if (!user) return diagnosticResultAuthorizationError(401);
  if (!canReadDiagnosticResults(user.role)) {
    return diagnosticResultAuthorizationError(403);
  }

  const { orderId, itemId } = await params;
  try {
    await connectDB();
    const result = await getCurrentDiagnosticResult(orderId, itemId, user);
    return diagnosticResultSuccess(result);
  } catch (error) {
    return diagnosticResultOperationError(error, "Unable to load Result");
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const user = await authenticateRequest(request);
  if (!user) return diagnosticResultAuthorizationError(401);
  if (!canMutateDiagnosticResults(user.role)) {
    return diagnosticResultAuthorizationError(403);
  }

  const parsed = await readResultJsonBody(request);
  if ("error" in parsed) return parsed.error;
  const { orderId, itemId } = await params;
  try {
    await connectDB();
    const result = await createDiagnosticResult(
      orderId,
      itemId,
      user,
      parsed.data,
    );
    return diagnosticResultSuccess(result, 201);
  } catch (error) {
    return diagnosticResultOperationError(error, "Unable to create Result");
  }
}
