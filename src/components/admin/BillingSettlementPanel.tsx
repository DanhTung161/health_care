"use client";

import { useState } from "react";

type Method = "CASH" | "BANK_TRANSFER" | "CREDIT_CARD";

export interface SettlementBillingData {
  appointment: { id: string; status: string } | null;
  insurance: {
    plan: string;
    verificationStatus: string;
  };
  refundTransactions: Array<{
    id: string;
    amount: number;
    method: string;
    reason: string;
    processedBy: { name: string } | null;
    processedAt: string;
  }>;
  totals: {
    totalPatientPayable: number;
    amountPaid: number;
    balanceDue: number;
    refundDue: number;
    billingStatus: string;
    closedBy: { name: string } | null;
    closedAt: string | null;
  };
}

const money = (value: number) =>
  `${new Intl.NumberFormat("vi-VN").format(value)} VND`;

export default function BillingSettlementPanel({
  billing,
  onChanged,
}: {
  billing: SettlementBillingData;
  onChanged: () => Promise<void>;
}) {
  const [amount, setAmount] = useState(String(billing.totals.refundDue));
  const [method, setMethod] = useState<Method>("CASH");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function refund(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!billing.appointment) return;
    const parsedAmount = Number(amount);
    if (!Number.isSafeInteger(parsedAmount) || parsedAmount <= 0) {
      setError("Refund must be a positive whole VND amount.");
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(
        `/api/appointments/${billing.appointment.id}/billing/refunds`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": `billing-refund-ui-${crypto.randomUUID()}`,
          },
          body: JSON.stringify({ amount: parsedAmount, method, reason }),
        },
      );
      const result = (await response.json()) as {
        success: boolean;
        error?: string;
      };
      if (!response.ok || !result.success) {
        throw new Error(result.error ?? "Unable to process refund.");
      }
      setReason("");
      setAmount("");
      setMessage("Refund recorded successfully.");
      await onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to process refund.");
    } finally {
      setSaving(false);
    }
  }

  async function closeInvoice() {
    if (!billing.appointment) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(
        `/api/appointments/${billing.appointment.id}/billing/close`,
        { method: "POST", credentials: "same-origin" },
      );
      const result = (await response.json()) as {
        success: boolean;
        error?: string;
      };
      if (!response.ok || !result.success) {
        throw new Error(result.error ?? "Unable to close invoice.");
      }
      setMessage("Invoice closed successfully.");
      await onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to close invoice.");
    } finally {
      setSaving(false);
    }
  }

  const completed = billing.appointment?.status === "COMPLETED";
  const closed = billing.totals.billingStatus === "CLOSED";
  const insuranceFinalized =
    billing.insurance.plan === "NONE" ||
    billing.insurance.verificationStatus === "VERIFIED";

  return (
    <section className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h4 className="font-bold text-slate-900">Settlement</h4>
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${closed ? "bg-slate-100 text-slate-600" : "bg-blue-50 text-blue-700"}`}>
          {billing.totals.billingStatus}
        </span>
      </div>
      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between"><dt className="text-slate-500">Remaining to collect</dt><dd className="font-semibold">{money(billing.totals.balanceDue)}</dd></div>
        <div className="flex justify-between"><dt className="text-slate-500">Refund required</dt><dd className="font-semibold">{money(billing.totals.refundDue)}</dd></div>
      </dl>
      {!completed && !closed && <p className="mt-4 text-sm text-amber-700">The visit must be completed before reconciliation can be finalized.</p>}
      {completed && billing.totals.balanceDue > 0 && !closed && <p className="mt-4 text-sm text-amber-700">Collect the remaining balance before closing this invoice.</p>}
      {completed && !insuranceFinalized && !closed && <p className="mt-4 text-sm text-amber-700">Verify the insurance decision before closing this invoice.</p>}
      {completed && billing.totals.refundDue > 0 && !closed && (
        <form onSubmit={refund} className="mt-4 space-y-3 border-t border-slate-100 pt-4">
          <p className="text-sm font-semibold text-slate-800">Process refund</p>
          <input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="numeric" aria-label="Refund amount" className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" />
          <select value={method} onChange={(event) => setMethod(event.target.value as Method)} aria-label="Refund method" className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm">
            <option value="CASH">Cash</option>
            <option value="BANK_TRANSFER">Bank transfer</option>
            <option value="CREDIT_CARD">Credit card</option>
          </select>
          <textarea required value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Refund reason" maxLength={500} className="min-h-20 w-full rounded-xl border border-slate-200 p-3 text-sm" />
          <button disabled={saving} className="w-full rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">Process refund</button>
        </form>
      )}
      {completed && insuranceFinalized && billing.totals.balanceDue === 0 && billing.totals.refundDue === 0 && !closed && (
        <button type="button" disabled={saving} onClick={() => void closeInvoice()} className="mt-4 w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">Close invoice</button>
      )}
      {billing.refundTransactions.length > 0 && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <p className="text-sm font-semibold text-slate-800">Refund history</p>
          <div className="mt-2 space-y-2">
            {billing.refundTransactions.map((item) => (
              <div key={item.id} className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                <p className="font-semibold text-slate-800">{money(item.amount)} · {item.method.replaceAll("_", " ")}</p>
                <p className="mt-1">{item.reason}</p>
                <p className="mt-1">{new Date(item.processedAt).toLocaleString("vi-VN")} · {item.processedBy?.name ?? "Unknown cashier"}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      {closed && <p className="mt-4 text-xs text-slate-500">Closed {billing.totals.closedAt ? new Date(billing.totals.closedAt).toLocaleString("vi-VN") : ""} by {billing.totals.closedBy?.name ?? "Unknown cashier"}.</p>}
      {error && <p role="alert" className="mt-3 text-sm text-rose-600">{error}</p>}
      {message && <p role="status" className="mt-3 text-sm text-emerald-700">{message}</p>}
    </section>
  );
}
