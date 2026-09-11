"use client";

import { useState } from "react";
import { Card } from "@/components/admin/AdminUI";

type Method = "CASH" | "BANK_TRANSFER" | "CREDIT_CARD";
type Summary = {
  grossCollected: number;
  refunds: number;
  netCollected: number;
  byMethod: Record<Method, { grossCollected: number; refunds: number; netCollected: number }>;
};

const methods: Method[] = ["CASH", "BANK_TRANSFER", "CREDIT_CARD"];
const money = (value: number) => `${new Intl.NumberFormat("vi-VN").format(value)} VND`;

export default function CashierReconciliation() {
  const [date, setDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  });
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const from = new Date(`${date}T00:00:00`);
    const to = new Date(from);
    to.setDate(to.getDate() + 1);
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
      const response = await fetch(`/api/billing/reconciliation?${params}`, { credentials: "same-origin" });
      const result = (await response.json()) as { success: boolean; error?: string; data?: Summary };
      if (!response.ok || !result.success || !result.data) throw new Error(result.error ?? "Unable to load reconciliation.");
      setSummary(result.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load reconciliation.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="mt-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h3 className="font-bold text-slate-900">Cashier reconciliation</h3><p className="mt-1 text-xs text-slate-400">Actual collections and refunds for the selected local day</p></div>
        <div className="flex gap-2"><input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="h-10 rounded-xl border border-slate-200 px-3 text-sm" /><button type="button" onClick={() => void load()} disabled={loading || !date} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{loading ? "Loading…" : "Reconcile"}</button></div>
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-rose-600">{error}</p>}
      {summary && <><div className="mt-5 grid gap-3 sm:grid-cols-3"><Metric label="Gross collected" value={summary.grossCollected} /><Metric label="Refunds" value={summary.refunds} /><Metric label="Net collected" value={summary.netCollected} /></div><div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs text-slate-400"><tr><th className="pb-2">Method</th><th className="pb-2">Gross</th><th className="pb-2">Refunds</th><th className="pb-2">Net</th></tr></thead><tbody>{methods.map((method) => <tr key={method} className="border-t border-slate-100"><td className="py-3 font-medium">{method.replaceAll("_", " ")}</td><td>{money(summary.byMethod[method].grossCollected)}</td><td>{money(summary.byMethod[method].refunds)}</td><td className="font-semibold">{money(summary.byMethod[method].netCollected)}</td></tr>)}</tbody></table></div></>}
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 font-bold text-slate-900">{money(value)}</p></div>;
}
