"use client";

import { useEffect, useState } from "react";
import ResultRevisionView from "@/components/admin/ResultRevisionView";
import {
  DiagnosticClientError,
  fetchDiagnosticResultHistory,
  type DiagnosticResultHistoryView,
  type DiagnosticResultRevisionView,
} from "@/lib/diagnostic-client";

export default function ResultHistory({
  orderId,
  itemId,
  refreshVersion,
}: {
  orderId: string;
  itemId: string;
  refreshVersion: number;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [history, setHistory] = useState<DiagnosticResultHistoryView | null>(null);
  const [selected, setSelected] = useState<DiagnosticResultRevisionView | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadVersion, setReloadVersion] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    let ignore = false;
    void fetchDiagnosticResultHistory(orderId, itemId, page)
      .then((data) => {
        if (ignore) return;
        setHistory(data);
        setSelected((current) =>
          current && data.revisions.some((revision) => revision.id === current.id)
            ? data.revisions.find((revision) => revision.id === current.id) ?? null
            : data.revisions[0] ?? null,
        );
      })
      .catch((error: unknown) => {
        if (ignore) return;
        setErrorMessage(
          error instanceof DiagnosticClientError
            ? error.message
            : "Unable to load Result history.",
        );
      })
      .finally(() => {
        if (!ignore) setIsLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [isOpen, itemId, orderId, page, refreshVersion, reloadVersion]);

  function toggleHistory() {
    const next = !isOpen;
    if (next) {
      setIsLoading(true);
      setErrorMessage("");
    }
    setIsOpen(next);
  }

  function changePage(nextPage: number) {
    setIsLoading(true);
    setErrorMessage("");
    setPage(nextPage);
  }

  return (
    <section className="mt-4 border-t border-slate-100 pt-4">
      <button
        type="button"
        onClick={toggleHistory}
        className="text-sm font-semibold text-blue-600 hover:underline"
        aria-expanded={isOpen}
      >
        {isOpen ? "Hide revision history" : "View revision history"}
      </button>

      {isOpen && (
        <div className="mt-4">
          {isLoading && (
            <p role="status" className="py-6 text-center text-sm text-slate-500">
              Loading revision history…
            </p>
          )}
          {errorMessage && (
            <div className="rounded-xl bg-rose-50 px-3 py-3 text-sm text-rose-700">
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
          {!isLoading && !errorMessage && history && (
            <>
              <div className="flex flex-wrap gap-2" aria-label="Result revisions">
                {history.revisions.map((revision) => (
                  <button
                    key={revision.id}
                    type="button"
                    onClick={() => setSelected(revision)}
                    className={`rounded-lg border px-3 py-2 text-left text-xs font-semibold ${
                      selected?.id === revision.id
                        ? "border-blue-300 bg-blue-50 text-blue-700"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    Revision {revision.version} · {revision.status}
                    {revision.isCurrentFinal ? " · Current Final" : ""}
                  </button>
                ))}
              </div>

              {selected && (
                <div className="mt-4">
                  <ResultRevisionView revision={selected} />
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
                <span>{history.pagination.total} revision{history.pagination.total === 1 ? "" : "s"}</span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={isLoading || history.pagination.page <= 1}
                    onClick={() => changePage(history.pagination.page - 1)}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span>Page {history.pagination.page} of {Math.max(1, history.pagination.totalPages)}</span>
                  <button
                    type="button"
                    disabled={isLoading || history.pagination.page >= history.pagination.totalPages}
                    onClick={() => changePage(history.pagination.page + 1)}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
