import { type NextRequest } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import connectDB from "@/lib/db";
import {
  canReadDiagnosticResults,
  getDiagnosticResultHistory,
  parseResultHistoryInput,
} from "@/lib/diagnostic-result-service";
import {
  diagnosticResultAuthorizationError,
  diagnosticResultOperationError,
  diagnosticResultSuccess,
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
    const input = parseResultHistoryInput(request.nextUrl.searchParams);
    await connectDB();
    const result = await getDiagnosticResultHistory(
      orderId,
      itemId,
      user,
      input,
    );
    return diagnosticResultSuccess(result);
  } catch (error) {
    return diagnosticResultOperationError(
      error,
      "Unable to load Result history",
    );
  }
}
