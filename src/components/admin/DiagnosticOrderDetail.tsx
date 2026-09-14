"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import DiagnosticResultPanel from "@/components/admin/DiagnosticResultPanel";
import {
  DiagnosticStatusBadge,
  DiagnosticTypeBadge,
  formatDiagnosticDate,
  shortIdentifier,
} from "@/components/admin/DiagnosticUI";
import {
  DiagnosticClientError,
  fetchDiagnosticOrder,
  type DiagnosticOrderDetail,
} from "@/lib/diagnostic-client";
import type { Role } from "@/lib/roles";

function ItemFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-400">{label}</dt>
      <dd className="mt-1 text-sm text-slate-700">{value}</dd>
    </div>
  );
}

export default function DiagnosticOrderDetailView({
  orderId,
  currentUser,
}: {
  orderId: string;
  currentUser: { id: string; role: Role };
}) {
  const [order, setOrder] = useState<DiagnosticOrderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadVersion, setReloadVersion] = useState(0);

  useEffect(() => {
    let ignore = false;
    void fetchDiagnosticOrder(orderId)
      .then((data) => {
        if (!ignore) setOrder(data);
      })
      .catch((error: unknown) => {
        if (ignore) return;
        setErrorMessage(
          error instanceof DiagnosticClientError
            ? error.message
            : "Unable to load this diagnostic order.",
        );
      })
      .finally(() => {
        if (!ignore) setIsLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [orderId, reloadVersion]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1300px] rounded-2xl border border-slate-100 bg-white px-5 py-16 text-center text-sm text-slate-500">
        Loading diagnostic order…
      </div>
    );
  }

  if (errorMessage || !order) {
    return (
      <div className="mx-auto max-w-[900px] rounded-2xl border border-rose-100 bg-white p-6 text-center">
        <p role="alert" className="text-sm text-rose-700">
          {errorMessage || "Diagnostic order not found."}
        </p>
        <div className="mt-4 flex justify-center gap-3">
          <Link href="/diagnostics" className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">
            Back to orders
          </Link>
          <button
            type="button"
            onClick={() => {
              setIsLoading(true);
              setErrorMessage("");
              setReloadVersion((current) => current + 1);
            }}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const canMutateResults =
    currentUser.role === "DOCTOR" &&
    order.orderedByDoctor.id === currentUser.id;

  return (
    <div className="mx-auto max-w-[1300px]">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/diagnostics" className="text-sm font-semibold text-blue-600 hover:underline">
            ← Diagnostic orders
          </Link>
          <h2 className="mt-2 text-xl font-bold text-slate-900">Diagnostic order detail</h2>
          <p className="mt-1 font-mono text-xs text-slate-500">{order.id}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <DiagnosticTypeBadge type={order.type} />
          <DiagnosticStatusBadge status={order.status} />
        </div>
      </div>

      <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_5px_20px_rgba(15,23,42,0.03)]">
        <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-xs font-medium text-slate-400">Patient</dt>
            <dd className="mt-1">
              <Link href={`/patients/${order.patientId}`} title={order.patientId} className="text-sm font-semibold text-blue-600 hover:underline">
                {shortIdentifier(order.patientId)}
              </Link>
            </dd>
          </div>
          <ItemFact label="Medical visit" value={order.medicalVisitId} />
          <ItemFact label="Ordering doctor" value={order.orderedByDoctor.name} />
          <ItemFact label="Ordered" value={formatDiagnosticDate(order.orderedAt)} />
          <ItemFact label="Priority" value={order.priority} />
          <ItemFact label="Created" value={formatDiagnosticDate(order.createdAt)} />
          <ItemFact label="Updated" value={formatDiagnosticDate(order.updatedAt)} />
          <ItemFact label="Updated by" value={order.updatedBy} />
        </dl>
        <div className="mt-5 grid gap-4 border-t border-slate-100 pt-5 md:grid-cols-2">
          <div>
            <p className="text-xs font-medium text-slate-400">Clinical indication</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{order.clinicalIndication}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400">Order notes</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{order.notes || "—"}</p>
          </div>
        </div>
      </section>

      <div className="mt-6">
        <div className="mb-4">
          <h3 className="text-lg font-bold text-slate-900">Diagnostic items</h3>
          <p className="mt-1 text-sm text-slate-500">
            Workflow status and Result lifecycle are shown separately.
          </p>
        </div>
        <div className="space-y-4">
          {order.items.map((item) => (
            <article
              key={item.id}
              className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_5px_20px_rgba(15,23,42,0.03)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-bold text-slate-900">{item.serviceName}</h4>
                    <DiagnosticTypeBadge type={item.type} />
                  </div>
                  <p className="mt-1 font-mono text-xs text-slate-500">
                    {item.serviceCode} · {item.id}
                  </p>
                </div>
                <div className="text-right">
                  <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                    Item workflow
                  </p>
                  <DiagnosticStatusBadge status={item.status} />
                </div>
              </div>

              {item.status === "CANCELLED" && (
                <div className="mt-4 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                  <p className="font-semibold">Item cancelled</p>
                  <p className="mt-1">{item.cancellationReason || "No cancellation reason recorded."}</p>
                  <p className="mt-1 text-xs">Cancelled {formatDiagnosticDate(item.cancelledAt)}</p>
                </div>
              )}

              <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <ItemFact label="Scheduled" value={formatDiagnosticDate(item.scheduledAt)} />
                <ItemFact label="Started" value={formatDiagnosticDate(item.startedAt)} />
                <ItemFact label="Completed" value={formatDiagnosticDate(item.completedAt)} />
                <ItemFact
                  label="Performer"
                  value={item.performedBy ? shortIdentifier(item.performedBy) : "Not recorded"}
                />
                <ItemFact label="Item notes" value={item.notes || "—"} />
                <ItemFact label="Updated" value={formatDiagnosticDate(item.updatedAt)} />
              </dl>

              <DiagnosticResultPanel
                key={item.id}
                orderId={order.id}
                item={item}
                canMutate={canMutateResults}
              />
            </article>
          ))}
          {!order.items.length && (
            <p className="rounded-2xl border border-slate-100 bg-white py-10 text-center text-sm text-slate-500">
              No diagnostic items found for this order.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
