"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  DIAGNOSTIC_STATUSES,
  DIAGNOSTIC_TYPES,
  type DiagnosticStatus,
  type DiagnosticType,
} from "@/lib/diagnostic";
import {
  DiagnosticClientError,
  fetchDiagnosticOrders,
  type DiagnosticOrderListResponse,
} from "@/lib/diagnostic-client";
import {
  DiagnosticStatusBadge,
  DiagnosticTypeBadge,
  formatDiagnosticDate,
  shortIdentifier,
} from "@/components/admin/DiagnosticUI";

export interface DiagnosticOrderFilters {
  patientId: string;
  type: DiagnosticType | "";
  status: DiagnosticStatus | "";
  from: string;
  to: string;
}

const inputClassName =
  "h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10";

function filterSearchParams(
  filters: DiagnosticOrderFilters,
  page: number,
): URLSearchParams {
  const params = new URLSearchParams({ page: String(page), limit: "10" });
  if (filters.patientId) params.set("patientId", filters.patientId);
  if (filters.type) params.set("type", filters.type);
  if (filters.status) params.set("status", filters.status);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  return params;
}

export default function DiagnosticOrdersList({
  initialFilters,
  initialPage,
}: {
  initialFilters: DiagnosticOrderFilters;
  initialPage: number;
}) {
  const router = useRouter();
  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState(initialPage);
  const [result, setResult] = useState<DiagnosticOrderListResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadVersion, setReloadVersion] = useState(0);

  useEffect(() => {
    let ignore = false;
    const params = filterSearchParams(filters, page);
    void fetchDiagnosticOrders(params)
      .then((data) => {
        if (!ignore) setResult(data);
      })
      .catch((error: unknown) => {
        if (ignore) return;
        setErrorMessage(
          error instanceof DiagnosticClientError
            ? error.message
            : "Unable to load diagnostic orders.",
        );
      })
      .finally(() => {
        if (!ignore) setIsLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [filters, page, reloadVersion]);

  function applyFilters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const next: DiagnosticOrderFilters = {
      patientId: String(formData.get("patientId") ?? "").trim(),
      type: String(formData.get("type") ?? "") as DiagnosticType | "",
      status: String(formData.get("status") ?? "") as DiagnosticStatus | "",
      from: String(formData.get("from") ?? ""),
      to: String(formData.get("to") ?? ""),
    };
    setIsLoading(true);
    setErrorMessage("");
    setPage(1);
    setFilters(next);
    router.replace(`/diagnostics?${filterSearchParams(next, 1).toString()}`, {
      scroll: false,
    });
  }

  function changePage(nextPage: number) {
    setIsLoading(true);
    setErrorMessage("");
    setPage(nextPage);
    router.replace(
      `/diagnostics?${filterSearchParams(filters, nextPage).toString()}`,
      { scroll: false },
    );
  }

  return (
    <div className="mx-auto max-w-[1400px]">
      <div className="mb-6">
        <h2 className="text-lg font-bold text-slate-900">Diagnostic orders</h2>
        <p className="mt-1 text-sm text-slate-500">
          Review Lab and Imaging requests, item progress, and clinical Results.
        </p>
      </div>

      <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_5px_20px_rgba(15,23,42,0.03)]">
        <form onSubmit={applyFilters} className="mb-5 flex flex-wrap gap-3">
          <label className="flex min-w-64 flex-1 flex-col gap-1.5 text-xs font-medium text-slate-500">
            Patient ID
            <input
              name="patientId"
              defaultValue={initialFilters.patientId}
              placeholder="MongoDB patient ID"
              className={inputClassName}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-medium text-slate-500">
            Type
            <select name="type" defaultValue={initialFilters.type} className={inputClassName}>
              <option value="">All types</option>
              {DIAGNOSTIC_TYPES.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-medium text-slate-500">
            Status
            <select name="status" defaultValue={initialFilters.status} className={inputClassName}>
              <option value="">All statuses</option>
              {DIAGNOSTIC_STATUSES.map((status) => (
                <option key={status} value={status}>{status.replace("_", " ")}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-medium text-slate-500">
            From (UTC date)
            <input name="from" type="date" defaultValue={initialFilters.from} className={inputClassName} />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-medium text-slate-500">
            To (UTC date)
            <input name="to" type="date" defaultValue={initialFilters.to} className={inputClassName} />
          </label>
          <button
            type="submit"
            className="self-end rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            Apply filters
          </button>
        </form>

        {errorMessage && (
          <div className="mb-4 rounded-xl bg-rose-50 px-3 py-3 text-sm text-rose-700">
            <p role="alert">{errorMessage}</p>
            <button
              type="button"
              onClick={() => {
                setIsLoading(true);
                setErrorMessage("");
                setReloadVersion((current) => current + 1);
              }}
              className="mt-2 font-semibold underline"
            >
              Try again
            </button>
          </div>
        )}

        {isLoading ? (
          <p role="status" className="py-12 text-center text-sm text-slate-500">
            Loading diagnostic orders…
          </p>
        ) : result?.items.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left text-sm">
              <thead className="border-b border-slate-100 text-xs text-slate-400">
                <tr>
                  <th className="pb-3 font-medium">Patient</th>
                  <th className="pb-3 font-medium">Medical visit</th>
                  <th className="pb-3 font-medium">Ordering doctor</th>
                  <th className="pb-3 font-medium">Type</th>
                  <th className="pb-3 font-medium">Priority</th>
                  <th className="pb-3 font-medium">Order status</th>
                  <th className="pb-3 font-medium">Ordered</th>
                  <th className="pb-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((order) => (
                  <tr key={order.id} className="border-b border-slate-50 last:border-0">
                    <td className="py-4">
                      <Link
                        href={`/patients/${order.patientId}`}
                        title={order.patientId}
                        className="font-semibold text-blue-600 hover:underline"
                      >
                        {shortIdentifier(order.patientId)}
                      </Link>
                    </td>
                    <td className="py-4 font-mono text-xs text-slate-500" title={order.medicalVisitId}>
                      {shortIdentifier(order.medicalVisitId)}
                    </td>
                    <td className="py-4 text-slate-700">{order.orderedByDoctor.name}</td>
                    <td className="py-4"><DiagnosticTypeBadge type={order.type} /></td>
                    <td className={`py-4 font-semibold ${order.priority === "URGENT" ? "text-rose-600" : "text-slate-600"}`}>
                      {order.priority}
                    </td>
                    <td className="py-4"><DiagnosticStatusBadge status={order.status} /></td>
                    <td className="py-4 text-slate-500">{formatDiagnosticDate(order.orderedAt)}</td>
                    <td className="py-4">
                      <Link
                        href={`/diagnostics/${order.id}`}
                        className="rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50"
                      >
                        Open order
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="py-12 text-center text-sm text-slate-500">
            No diagnostic orders match these filters.
          </p>
        )}

        {result && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
            <span>{result.pagination.total} order{result.pagination.total === 1 ? "" : "s"}</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={isLoading || result.pagination.page <= 1}
                onClick={() => changePage(result.pagination.page - 1)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <span>Page {result.pagination.page} of {result.pagination.totalPages}</span>
              <button
                type="button"
                disabled={isLoading || result.pagination.page >= result.pagination.totalPages}
                onClick={() => changePage(result.pagination.page + 1)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
