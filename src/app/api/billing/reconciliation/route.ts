import { type NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import connectDB from "@/lib/db";
import Billing, {
  BILLING_PAYMENT_METHODS,
  type BillingPaymentMethod,
} from "@/models/Billing";

type MethodTotal = { _id: BillingPaymentMethod; amount: number; count: number };

function authorizationError(status: 401 | 403) {
  return NextResponse.json(
    {
      success: false,
      error:
        status === 401
          ? "Authentication required"
          : "Forbidden: reconciliation is limited to ADMIN and STAFF",
    },
    { status },
  );
}

function parseRange(request: NextRequest) {
  const fromValue = request.nextUrl.searchParams.get("from")?.trim();
  const toValue = request.nextUrl.searchParams.get("to")?.trim();
  if (fromValue || toValue) {
    if (!fromValue || !toValue) return null;
    const from = new Date(fromValue);
    const to = new Date(toValue);
    if (
      Number.isNaN(from.getTime()) ||
      Number.isNaN(to.getTime()) ||
      to <= from ||
      to.getTime() - from.getTime() > 24 * 60 * 60 * 1_000
    ) {
      return null;
    }
    return { from, to };
  }

  const dateValue =
    request.nextUrl.searchParams.get("date")?.trim() ??
    new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) return null;
  const from = new Date(`${dateValue}T00:00:00.000Z`);
  if (
    Number.isNaN(from.getTime()) ||
    from.toISOString().slice(0, 10) !== dateValue
  ) {
    return null;
  }
  const to = new Date(from.getTime() + 24 * 60 * 60 * 1_000);
  return { from, to };
}

function indexedTotals(records: MethodTotal[]) {
  return Object.fromEntries(
    BILLING_PAYMENT_METHODS.map((method) => {
      const record = records.find(({ _id }) => _id === method);
      return [method, { amount: record?.amount ?? 0, count: record?.count ?? 0 }];
    }),
  ) as Record<BillingPaymentMethod, { amount: number; count: number }>;
}

export async function GET(request: NextRequest) {
  const user = await authenticateRequest(request);
  if (!user) return authorizationError(401);
  if (user.role !== "ADMIN" && user.role !== "STAFF") {
    return authorizationError(403);
  }

  const range = parseRange(request);
  if (!range) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Use date=YYYY-MM-DD or a valid from/to ISO range no longer than 24 hours",
      },
      { status: 400 },
    );
  }

  try {
    await connectDB();
    const [collectedRecords, refundRecords] = await Promise.all([
      Billing.aggregate<MethodTotal>([
        { $unwind: "$paymentTransactions" },
        {
          $match: {
            "paymentTransactions.collectedAt": {
              $gte: range.from,
              $lt: range.to,
            },
          },
        },
        {
          $group: {
            _id: "$paymentTransactions.method",
            amount: { $sum: "$paymentTransactions.amount" },
            count: { $sum: 1 },
          },
        },
      ]),
      Billing.aggregate<MethodTotal>([
        { $unwind: "$refundTransactions" },
        {
          $match: {
            "refundTransactions.processedAt": {
              $gte: range.from,
              $lt: range.to,
            },
          },
        },
        {
          $group: {
            _id: "$refundTransactions.method",
            amount: { $sum: "$refundTransactions.amount" },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const collected = indexedTotals(collectedRecords);
    const refunds = indexedTotals(refundRecords);
    const byMethod = Object.fromEntries(
      BILLING_PAYMENT_METHODS.map((method) => [
        method,
        {
          grossCollected: collected[method].amount,
          refunds: refunds[method].amount,
          netCollected: collected[method].amount - refunds[method].amount,
          paymentCount: collected[method].count,
          refundCount: refunds[method].count,
        },
      ]),
    );
    const grossCollected = Object.values(collected).reduce(
      (sum, item) => sum + item.amount,
      0,
    );
    const refunded = Object.values(refunds).reduce(
      (sum, item) => sum + item.amount,
      0,
    );

    return NextResponse.json({
      success: true,
      data: {
        from: range.from.toISOString(),
        to: range.to.toISOString(),
        grossCollected,
        refunds: refunded,
        netCollected: grossCollected - refunded,
        byMethod,
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Unable to load reconciliation summary" },
      { status: 500 },
    );
  }
}
