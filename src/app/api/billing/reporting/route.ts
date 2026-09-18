import { type NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { buildBillingReport, BillingReportingError, parseReportingRange } from "@/lib/billing-reporting";
import connectDB from "@/lib/db";

import { buildCommerceCashFlow, combineCashFlows } from '@/lib/shopify/reporting';
import { ShopifyError } from '@/lib/shopify/config';

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
    const commerce = await buildCommerceCashFlow(range);
    const healthcare = data.cashFlow;
    const combined = combineCashFlows(healthcare, commerce);
    return NextResponse.json({ success: true, data: { ...data, sources: { healthcare, commerce, combined } } });
  } catch (error) {
    if (error instanceof ShopifyError) return NextResponse.json({ success: false, error: error.message }, { status: error.code === 'DATA_INTEGRITY' ? 409 : 503 });
    if (error instanceof BillingReportingError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    return NextResponse.json({ success: false, error: "Financial report failed consistency validation or could not be loaded" }, { status: 500 });
  }
}
