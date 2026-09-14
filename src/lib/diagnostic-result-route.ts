import "server-only";

import mongoose from "mongoose";
import { type NextRequest, NextResponse } from "next/server";
import { DiagnosticResultError } from "@/lib/diagnostic-result-service";

export function diagnosticResultAuthorizationError(status: 401 | 403) {
  return NextResponse.json(
    {
      success: false,
      error:
        status === 401
          ? "Authentication required"
          : "Forbidden: Result operation is not permitted for this role",
    },
    { status },
  );
}

export function diagnosticResultOperationError(
  error: unknown,
  fallback: string,
) {
  if (error instanceof DiagnosticResultError) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: error.status },
    );
  }
  if (error instanceof mongoose.Error.ValidationError) {
    return NextResponse.json(
      { success: false, error: "Result data failed validation" },
      { status: 400 },
    );
  }
  return NextResponse.json(
    { success: false, error: fallback },
    { status: 500 },
  );
}

export async function readResultJsonBody(
  request: NextRequest,
): Promise<{ data: unknown } | { error: NextResponse }> {
  try {
    return { data: (await request.json()) as unknown };
  } catch {
    return {
      error: NextResponse.json(
        { success: false, error: "Request body must be valid JSON" },
        { status: 400 },
      ),
    };
  }
}

export async function requireEmptyResultBody(
  request: NextRequest,
): Promise<NextResponse | null> {
  const body = await request.text();
  if (!body.trim()) return null;
  return NextResponse.json(
    { success: false, error: "Finalization request body must be empty" },
    { status: 400 },
  );
}

export function diagnosticResultSuccess(
  data: unknown,
  status: 200 | 201 = 200,
) {
  const response = NextResponse.json({ success: true, data }, { status });
  if (
    typeof data === "object" &&
    data !== null &&
    "latestRevision" in data &&
    typeof data.latestRevision === "object" &&
    data.latestRevision !== null &&
    "revisionToken" in data.latestRevision &&
    typeof data.latestRevision.revisionToken === "string"
  ) {
    response.headers.set("ETag", `"${data.latestRevision.revisionToken}"`);
  }
  return response;
}
