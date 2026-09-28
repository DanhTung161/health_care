import { NextRequest, NextResponse } from "next/server";
import {
  createPublicAppointment,
  parsePublicAppointmentRequest,
  PublicAppointmentError,
} from "@/lib/public-appointment-booking";

const MAX_REQUEST_BYTES = 10_000;

function isSameOriginRequest(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    return new URL(origin).origin === request.nextUrl.origin;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { success: false, error: "Cross-origin booking requests are not allowed" },
      { status: 403 },
    );
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return NextResponse.json(
      { success: false, error: "Content-Type must be application/json" },
      { status: 415 },
    );
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return NextResponse.json(
      { success: false, error: "Request body is too large" },
      { status: 413 },
    );
  }

  let requestBody: unknown;
  try {
    const rawBody = await request.text();
    if (rawBody.length > MAX_REQUEST_BYTES) {
      return NextResponse.json(
        { success: false, error: "Request body is too large" },
        { status: 413 },
      );
    }
    requestBody = JSON.parse(rawBody) as unknown;
  } catch {
    return NextResponse.json(
      { success: false, error: "Request body must be valid JSON" },
      { status: 400 },
    );
  }

  const parsed = parsePublicAppointmentRequest(requestBody);
  if ("error" in parsed) {
    return NextResponse.json(
      { success: false, error: parsed.error },
      { status: 400 },
    );
  }

  try {
    const result = await createPublicAppointment(parsed.data);
    return NextResponse.json(
      {
        success: true,
        appointmentId: result.appointmentId,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof PublicAppointmentError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status },
      );
    }

    return NextResponse.json(
      { success: false, error: "Unable to submit appointment request" },
      { status: 500 },
    );
  }
}
