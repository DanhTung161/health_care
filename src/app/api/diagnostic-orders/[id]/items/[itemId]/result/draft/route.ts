import { type NextRequest } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import connectDB from "@/lib/db";
import {
  canMutateDiagnosticResults,
  parseResultRevisionToken,
  updateDiagnosticResultDraft,
} from "@/lib/diagnostic-result-service";
import {
  diagnosticResultAuthorizationError,
  diagnosticResultOperationError,
  diagnosticResultSuccess,
  readResultJsonBody,
} from "@/lib/diagnostic-result-route";

type RouteContext = {
  params: Promise<{ id: string; itemId: string }>;
};

export async function PATCH(request: NextRequest, { params }: RouteContext) {
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
  const parsed = await readResultJsonBody(request);
  if ("error" in parsed) return parsed.error;
  const { id: orderId, itemId } = await params;

  try {
    await connectDB();
    const result = await updateDiagnosticResultDraft(
      orderId,
      itemId,
      user,
      parsed.data,
      revisionToken,
    );
    return diagnosticResultSuccess(result);
  } catch (error) {
    return diagnosticResultOperationError(error, "Unable to update Result draft");
  }
}
