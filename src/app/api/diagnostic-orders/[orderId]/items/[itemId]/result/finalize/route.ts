import { type NextRequest } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import connectDB from "@/lib/db";
import {
  canMutateDiagnosticResults,
  finalizeDiagnosticResult,
  parseResultRevisionToken,
} from "@/lib/diagnostic-result-service";
import {
  diagnosticResultAuthorizationError,
  diagnosticResultOperationError,
  diagnosticResultSuccess,
  requireEmptyResultBody,
} from "@/lib/diagnostic-result-route";

type RouteContext = {
  params: Promise<{ orderId: string; itemId: string }>;
};

export async function POST(request: NextRequest, { params }: RouteContext) {
  const user = await authenticateRequest(request);
  if (!user) return diagnosticResultAuthorizationError(401);
  if (!canMutateDiagnosticResults(user.role)) {
    return diagnosticResultAuthorizationError(403);
  }

  let revisionToken: ReturnType<typeof parseResultRevisionToken>;
  try {
    revisionToken = parseResultRevisionToken(request.headers.get("if-match"));
  } catch (error) {
    return diagnosticResultOperationError(error, "Invalid Result revision token");
  }
  const bodyError = await requireEmptyResultBody(request);
  if (bodyError) return bodyError;
  const { orderId, itemId } = await params;

  try {
    await connectDB();
    const result = await finalizeDiagnosticResult(
      orderId,
      itemId,
      user,
      revisionToken,
    );
    return diagnosticResultSuccess(result);
  } catch (error) {
    return diagnosticResultOperationError(error, "Unable to finalize Result");
  }
}
