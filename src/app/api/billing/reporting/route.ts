import { type NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { buildBillingReport, BillingReportingError, parseReportingRange } from "@/lib/billing-reporting";
import connectDB from "@/lib/db";

export async function GET(request: NextRequest) {
  const user = await authenticateRequest(request);
  if (!user) return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
  if (user.role !== "ADMIN" && user.role !== "STAFF") {
    return NextResponse.json({ success: false, error: "Forbidden: financial reports are limited to ADMIN and STAFF" }, { status: 403 });
  }
  try {
    const range = parseReportingRange(request.nextUrl.searchParams);
    await connectDB();
    const data = await buildBillingReport(range);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof BillingReportingError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    return NextResponse.json({ success: false, error: "Financial report failed consistency validation or could not be loaded" }, { status: 500 });
  }
}
