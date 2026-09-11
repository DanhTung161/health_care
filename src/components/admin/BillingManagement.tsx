"use client";

import { useCallback, useEffect, useState } from "react";
import { CreditCard, Search, X } from "lucide-react";
import { Badge, Card, PageIntro } from "@/components/admin/AdminUI";
import type { Role } from "@/lib/roles";

type PaymentStatus = "UNPAID" | "PARTIALLY_PAID" | "PAID";
type InsurancePlan = "NONE" | "BHYT_BASIC" | "BHYT_HIGH" | "PRIVATE_GOLD";
type VerificationStatus = "NONE" | "PENDING" | "VERIFIED" | "REJECTED";

type Invoice = {
  id: string;
  invoiceNo: string;
  grossSubtotal: number;
  effectiveInsurancePaid: number;
  totalPatientPayable: number;
  amountPaid: number;
  balanceDue: number;
  paymentStatus: PaymentStatus;
  insuranceVerificationStatus: VerificationStatus;
  patient: { fullName: string; phone: string | null } | null;
  appointment: { appointmentDate: string; timeSlot: string; doctorName: string | null } | null;
};

type Detail = {
  id: string;
  invoiceNo: string;
  patient: { fullName: string; phone: string | null } | null;
  appointment: { id: string; appointmentDate: string; timeSlot: string; status: string; doctorName: string | null; reason: string | null } | null;
  lineItems: Array<{ id: string; category: string; description: string; quantity: number; unitPrice: number; amount: number; isCoveredByInsurance: boolean; paymentStatus: "PENDING_PAYMENT" | "PAID" }>;
  paymentTransactions: Array<{ id: string; amount: number; method: string; type: string; reference: string | null; note: string | null; collectedBy: { name: string } | null; collectedAt: string }>;
  insurance: { plan: InsurancePlan; grossSubtotal: number; coveredSubtotal: number; calculatedInsurancePaid: number; overrideEnabled: boolean; overrideAmount: number; effectiveInsurancePaid: number; postInsuranceAmount: number; verificationStatus: VerificationStatus; note: string | null; verifiedBy: { name: string } | null; verifiedAt: string | null };
  totals: { vatAmount: number; totalPatientPayable: number; amountPaid: number; balanceDue: number; paymentStatus: PaymentStatus };
};

type ListResponse = { success: boolean; error?: string; data?: { items: Invoice[]; pagination: { page: number; total: number; totalPages: number } } };
type DetailResponse = { success: boolean; error?: string; data?: Detail };
type MutationResponse = { success: boolean; error?: string };

const input = "h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10";
const money = (value: number) => `${new Intl.NumberFormat("vi-VN").format(value)} VND`;
const date = (value: string) => new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
const paymentTone = (status: PaymentStatus): "green" | "amber" | "red" => status === "PAID" ? "green" : status === "PARTIALLY_PAID" ? "amber" : "red";
const insuranceTone = (status: VerificationStatus): "green" | "amber" | "blue" | "red" => status === "VERIFIED" ? "green" : status === "PENDING" ? "amber" : status === "REJECTED" ? "red" : "blue";

export default function BillingManagement({ role }: { role: Role }) {
  const [draftSearch, setDraftSearch] = useState("");
  const [draftStatus, setDraftStatus] = useState<"" | PaymentStatus>("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"" | PaymentStatus>("");
  const [page, setPage] = useState(1);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [insurance, setInsurance] = useState({ plan: "NONE" as InsurancePlan, overrideEnabled: false, overrideAmount: "0", verificationStatus: "NONE" as VerificationStatus, note: "" });
  const [payment, setPayment] = useState({ amount: "", type: "DEPOSIT", method: "CASH", reference: "", note: "" });
  const canManage = role === "ADMIN" || role === "STAFF";

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "10" });
    if (search) params.set("search", search);
    if (status) params.set("paymentStatus", status);
    try {
      const response = await fetch(`/api/billing?${params}`, { credentials: "same-origin" });
      const result = await response.json() as ListResponse;
      if (!response.ok || !result.success || !result.data) throw new Error(result.error ?? "Unable to load invoices.");
      setInvoices(result.data.items);
      setPagination(result.data.pagination);
    } catch (cause) {
      setInvoices([]);
      setError(cause instanceof Error ? cause.message : "Unable to load invoices.");
    } finally { setLoading(false); }
  }, [page, search, status]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadInvoices(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadInvoices]);

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true); setError("");
    try {
      const response = await fetch(`/api/billing/${id}`, { credentials: "same-origin" });
      const result = await response.json() as DetailResponse;
      if (!response.ok || !result.success || !result.data) throw new Error(result.error ?? "Unable to load invoice.");
      setDetail(result.data);
      setInsurance({ plan: result.data.insurance.plan, overrideEnabled: result.data.insurance.overrideEnabled, overrideAmount: String(result.data.insurance.overrideAmount), verificationStatus: result.data.insurance.verificationStatus, note: result.data.insurance.note ?? "" });
      setPayment({ amount: "", type: "DEPOSIT", method: "CASH", reference: "", note: "" });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load invoice."); }
    finally { setDetailLoading(false); }
  }, []);

  async function refresh() { if (detail) await Promise.all([loadDetail(detail.id), loadInvoices()]); }
  function filters(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); setPage(1); setSearch(draftSearch.trim()); setStatus(draftStatus); }

  async function saveInsurance(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail?.appointment || !canManage) return;
    const override = Number(insurance.overrideAmount);
    if (insurance.overrideEnabled && (!Number.isSafeInteger(override) || override < 0)) { setError("Insurance override must be a non-negative whole VND amount."); return; }
    setSaving(true); setError("");
    try {
      const response = await fetch(`/api/appointments/${detail.appointment.id}/billing/insurance`, { method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ insurancePlan: insurance.plan, insuranceOverrideEnabled: insurance.overrideEnabled, insuranceOverrideAmount: insurance.overrideEnabled ? override : 0, insuranceVerificationStatus: insurance.verificationStatus, insuranceNote: insurance.note.trim() }) });
      const result = await response.json() as MutationResponse;
      if (!response.ok || !result.success) throw new Error(result.error ?? "Unable to update insurance.");
      setSuccess("Insurance calculation updated."); await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to update insurance."); }
    finally { setSaving(false); }
  }

  async function collect(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail?.appointment || !canManage) return;
    const amount = Number(payment.amount);
    if (!Number.isSafeInteger(amount) || amount <= 0) { setError("Payment amount must be a positive whole VND amount."); return; }
    setSaving(true); setError("");
    try {
      const response = await fetch(`/api/appointments/${detail.appointment.id}/billing/payments`, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", "Idempotency-Key": `billing-ui-${crypto.randomUUID()}` }, body: JSON.stringify({ amount, type: payment.type, method: payment.method, reference: payment.reference.trim(), note: payment.note.trim() }) });
      const result = await response.json() as MutationResponse;
      if (!response.ok || !result.success) throw new Error(result.error ?? "Unable to collect payment.");
      setSuccess("Payment collected successfully."); await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to collect payment."); }
    finally { setSaving(false); }
  }

  return <div className="mx-auto max-w-[1400px]"><PageIntro title="Billing management" />
    <Card><form onSubmit={filters} className="flex flex-wrap gap-3"><label className="relative min-w-[230px] flex-1"><span className="sr-only">Search invoice or patient</span><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" /><input value={draftSearch} onChange={(event) => setDraftSearch(event.target.value)} placeholder="Invoice number, patient or phone" className={`${input} w-full pl-9`} /></label><select value={draftStatus} onChange={(event) => setDraftStatus(event.target.value as "" | PaymentStatus)} className={input}><option value="">All payment statuses</option><option value="UNPAID">Unpaid</option><option value="PARTIALLY_PAID">Partially paid</option><option value="PAID">Paid</option></select><button className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Apply</button></form></Card>
    {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">{error}</p>}{success && <p role="status" className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{success}</p>}
    <Card className="mt-5"><div className="mb-5 flex items-center justify-between"><div><h3 className="font-bold text-slate-900">Invoices</h3><p className="mt-1 text-xs text-slate-400">{pagination.total} invoice{pagination.total === 1 ? "" : "s"} found</p></div>{loading && <span className="text-sm text-slate-500">Loading…</span>}</div>{!loading && invoices.length === 0 ? <p className="rounded-xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-500">No invoices match the current filter.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[1250px] text-left text-sm"><thead className="border-b border-slate-100 text-xs text-slate-400"><tr><th className="pb-3">Invoice no.</th><th className="pb-3">Patient</th><th className="pb-3">Appointment</th><th className="pb-3">Gross</th><th className="pb-3">Insurance paid</th><th className="pb-3">Patient payable</th><th className="pb-3">Amount paid</th><th className="pb-3">Balance</th><th className="pb-3">Payment</th><th className="pb-3">Insurance</th></tr></thead><tbody>{invoices.map((invoice) => <tr key={invoice.id} onClick={() => void loadDetail(invoice.id)} className="cursor-pointer border-b border-slate-50 align-top hover:bg-slate-50"><td className="py-4 font-semibold text-blue-600">{invoice.invoiceNo}</td><td className="py-4"><p className="font-medium text-slate-800">{invoice.patient?.fullName ?? "Unknown patient"}</p><p className="mt-1 text-xs text-slate-400">{invoice.patient?.phone ?? "—"}</p></td><td className="py-4 text-slate-600">{invoice.appointment ? <><p>{date(invoice.appointment.appointmentDate)}</p><p className="mt-1 text-xs text-slate-400">{invoice.appointment.timeSlot} · {invoice.appointment.doctorName ?? "Unknown doctor"}</p></> : "Missing appointment"}</td><td className="py-4">{money(invoice.grossSubtotal)}</td><td className="py-4 text-emerald-700">{money(invoice.effectiveInsurancePaid)}</td><td className="py-4 font-medium">{money(invoice.totalPatientPayable)}</td><td className="py-4">{money(invoice.amountPaid)}</td><td className="py-4 font-semibold">{money(invoice.balanceDue)}</td><td className="py-4"><Badge tone={paymentTone(invoice.paymentStatus)}>{invoice.paymentStatus.replaceAll("_", " ")}</Badge></td><td className="py-4"><Badge tone={insuranceTone(invoice.insuranceVerificationStatus)}>{invoice.insuranceVerificationStatus}</Badge></td></tr>)}</tbody></table></div>}<div className="mt-5 flex items-center justify-end gap-3 text-sm"><button type="button" disabled={pagination.page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-lg border border-slate-200 px-3 py-2 font-semibold text-slate-600 disabled:opacity-50">Previous</button><span className="text-slate-500">Page {pagination.page} of {pagination.totalPages}</span><button type="button" disabled={pagination.page >= pagination.totalPages || loading} onClick={() => setPage((value) => Math.min(pagination.totalPages, value + 1))} className="rounded-lg border border-slate-200 px-3 py-2 font-semibold text-slate-600 disabled:opacity-50">Next</button></div></Card>
    {(detail || detailLoading) && <div className="fixed inset-0 z-[70] overflow-y-auto bg-slate-950/45 p-4" role="dialog" aria-modal="true" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setDetail(null); }}><div className="mx-auto my-4 max-w-5xl rounded-2xl bg-slate-50 p-5 shadow-2xl"><div className="mb-5 flex items-start justify-between gap-3"><div><h3 className="text-lg font-bold text-slate-900">{detail?.invoiceNo ?? "Loading invoice…"}</h3>{detail && <p className="mt-1 text-sm text-slate-500">{detail.patient?.fullName ?? "Unknown patient"} · {detail.appointment ? `${date(detail.appointment.appointmentDate)} · ${detail.appointment.timeSlot}` : "Missing appointment"}</p>}</div><button type="button" onClick={() => setDetail(null)} disabled={saving} className="rounded-lg p-2 text-slate-400 hover:bg-slate-200"><X className="h-5 w-5" /><span className="sr-only">Close</span></button></div>{detailLoading || !detail ? <p className="py-16 text-center text-sm text-slate-500">Loading invoice details…</p> : <div className="grid gap-5 lg:grid-cols-[1.3fr_0.7fr]"><div className="space-y-5"><Card><h4 className="font-bold text-slate-900">Line items</h4><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="border-b border-slate-100 text-xs text-slate-400"><tr><th className="pb-3">Service</th><th className="pb-3">Qty</th><th className="pb-3">Unit price</th><th className="pb-3">Amount</th><th className="pb-3">Coverage</th><th className="pb-3">Settlement</th></tr></thead><tbody>{detail.lineItems.map((item) => <tr key={item.id} className="border-b border-slate-50 last:border-0"><td className="py-3"><p className="font-medium text-slate-800">{item.description}</p><p className="text-xs text-slate-400">{item.category}</p></td><td className="py-3">{item.quantity}</td><td className="py-3">{money(item.unitPrice)}</td><td className="py-3 font-medium">{money(item.amount)}</td><td className="py-3">{item.isCoveredByInsurance ? "Eligible" : "Not covered"}</td><td className="py-3"><Badge tone={item.paymentStatus === "PAID" ? "green" : "amber"}>{item.paymentStatus.replaceAll("_", " ")}</Badge></td></tr>)}</tbody></table></div></Card><Card><h4 className="font-bold text-slate-900">Payment transactions</h4>{detail.paymentTransactions.length === 0 ? <p className="mt-4 text-sm text-slate-500">No payments collected.</p> : <div className="mt-4 space-y-3">{detail.paymentTransactions.map((transaction) => <div key={transaction.id} className="rounded-xl border border-slate-100 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold text-slate-800">{money(transaction.amount)}</p><Badge tone="green">{transaction.type} · {transaction.method.replaceAll("_", " ")}</Badge></div><p className="mt-1 text-xs text-slate-500">{date(transaction.collectedAt)} · {transaction.collectedBy?.name ?? "Unknown collector"}</p>{transaction.reference && <p className="mt-1 text-xs text-slate-500">Reference: {transaction.reference}</p>}{transaction.note && <p className="mt-1 text-xs text-slate-500">{transaction.note}</p>}</div>)}</div>}</Card></div><div className="space-y-5"><Card><h4 className="font-bold text-slate-900">Totals</h4><dl className="mt-4 space-y-3 text-sm">{[["Gross total", detail.insurance.grossSubtotal], ["Insurance paid", detail.insurance.effectiveInsurancePaid], ["Post-insurance", detail.insurance.postInsuranceAmount], ["VAT", detail.totals.vatAmount], ["Patient payable", detail.totals.totalPatientPayable], ["Amount paid", detail.totals.amountPaid], ["Balance", detail.totals.balanceDue]].map(([label, value]) => <div key={String(label)} className="flex justify-between gap-3"><dt className="text-slate-500">{label}</dt><dd className="font-semibold text-slate-800">{money(value as number)}</dd></div>)}</dl><div className="mt-4"><Badge tone={paymentTone(detail.totals.paymentStatus)}>{detail.totals.paymentStatus.replaceAll("_", " ")}</Badge></div></Card>{canManage && <><Card><h4 className="font-bold text-slate-900">Insurance calculation</h4><form onSubmit={saveInsurance} className="mt-4 space-y-3"><label className="block text-xs font-medium text-slate-600">Plan<select value={insurance.plan} onChange={(event) => setInsurance((value) => ({ ...value, plan: event.target.value as InsurancePlan }))} className={`${input} mt-1 w-full`}><option value="NONE">NONE</option><option value="BHYT_BASIC">BHYT BASIC</option><option value="BHYT_HIGH">BHYT HIGH</option><option value="PRIVATE_GOLD">PRIVATE GOLD</option></select></label><label className="block text-xs font-medium text-slate-600">Verification<select value={insurance.verificationStatus} onChange={(event) => setInsurance((value) => ({ ...value, verificationStatus: event.target.value as VerificationStatus }))} className={`${input} mt-1 w-full`}><option value="NONE">NONE</option><option value="PENDING">PENDING</option><option value="VERIFIED">VERIFIED</option><option value="REJECTED">REJECTED</option></select></label><label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={insurance.overrideEnabled} onChange={(event) => setInsurance((value) => ({ ...value, overrideEnabled: event.target.checked }))} /> Use approved override</label>{insurance.overrideEnabled && <label className="block text-xs font-medium text-slate-600">Approved amount (VND)<input value={insurance.overrideAmount} onChange={(event) => setInsurance((value) => ({ ...value, overrideAmount: event.target.value }))} inputMode="numeric" className={`${input} mt-1 w-full`} /></label>}<label className="block text-xs font-medium text-slate-600">Note<textarea value={insurance.note} onChange={(event) => setInsurance((value) => ({ ...value, note: event.target.value }))} maxLength={1000} className="mt-1 min-h-20 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10" /></label><button disabled={saving} className="w-full rounded-xl border border-blue-200 px-4 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-60">{saving ? "Saving…" : "Update insurance"}</button></form></Card><Card><h4 className="flex items-center gap-2 font-bold text-slate-900"><CreditCard className="h-4 w-4" /> Collect payment</h4>{detail.totals.balanceDue === 0 ? <p className="mt-3 text-sm text-emerald-700">This invoice is fully settled.</p> : <form onSubmit={collect} className="mt-4 space-y-3"><label className="block text-xs font-medium text-slate-600">Amount (VND)<input required value={payment.amount} onChange={(event) => setPayment((value) => ({ ...value, amount: event.target.value }))} inputMode="numeric" className={`${input} mt-1 w-full`} /></label><div className="grid grid-cols-2 gap-3"><label className="block text-xs font-medium text-slate-600">Type<select value={payment.type} onChange={(event) => setPayment((value) => ({ ...value, type: event.target.value }))} className={`${input} mt-1 w-full`}><option value="DEPOSIT">Deposit</option><option value="PAYMENT">Payment</option></select></label><label className="block text-xs font-medium text-slate-600">Method<select value={payment.method} onChange={(event) => setPayment((value) => ({ ...value, method: event.target.value }))} className={`${input} mt-1 w-full`}><option value="CASH">Cash</option><option value="BANK_TRANSFER">Bank transfer</option><option value="CREDIT_CARD">Credit card</option></select></label></div><label className="block text-xs font-medium text-slate-600">Reference<input value={payment.reference} onChange={(event) => setPayment((value) => ({ ...value, reference: event.target.value }))} maxLength={200} className={`${input} mt-1 w-full`} /></label><label className="block text-xs font-medium text-slate-600">Note<textarea value={payment.note} onChange={(event) => setPayment((value) => ({ ...value, note: event.target.value }))} maxLength={500} className="mt-1 min-h-16 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10" /></label><button disabled={saving} className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{saving ? "Collecting…" : "Collect payment"}</button></form>}</Card></>}</div></div>}</div></div>}</div>;
}
