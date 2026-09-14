"use client";

import { useState } from "react";
import { DIAGNOSTIC_CANCELLATION_REASON_MAX_LENGTH } from "@/lib/diagnostic";

export default function DiagnosticCancellationDialog({
  serviceName,
  isSaving,
  errorMessage,
  onSubmit,
  onClose,
}: {
  serviceName: string;
  isSaving: boolean;
  errorMessage: string;
  onSubmit: (cancellationReason: string) => Promise<void>;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cancellationReason = reason.trim();
    if (!cancellationReason) return;
    await onSubmit(cancellationReason);
  }

  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-slate-950/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-diagnostic-item-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSaving) onClose();
      }}
    >
      <form
        onSubmit={submit}
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3
              id="cancel-diagnostic-item-title"
              className="text-lg font-bold text-slate-900"
            >
              Cancel diagnostic item
            </h3>
            <p className="mt-1 text-sm text-slate-500">{serviceName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            aria-label="Close cancellation dialog"
            className="rounded-lg px-2 py-1 text-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
          >
            ×
          </button>
        </div>

        <p className="mt-4 rounded-xl bg-rose-50 px-3 py-3 text-sm text-rose-700">
          Cancellation is terminal. Existing clinical Result history will remain available and will not be deleted.
        </p>

        <label className="mt-5 flex flex-col gap-2 text-sm font-medium text-slate-700">
          Cancellation reason
          <textarea
            required
            rows={4}
            value={reason}
            maxLength={DIAGNOSTIC_CANCELLATION_REASON_MAX_LENGTH}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Explain why this diagnostic item is being cancelled"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10"
          />
        </label>
        <p className="mt-1 text-right text-xs text-slate-400">
          {reason.length}/{DIAGNOSTIC_CANCELLATION_REASON_MAX_LENGTH}
        </p>

        {errorMessage && (
          <p
            role="alert"
            className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700"
          >
            {errorMessage}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Keep item
          </button>
          <button
            type="submit"
            disabled={isSaving || !reason.trim()}
            className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Cancelling…" : "Confirm cancellation"}
          </button>
        </div>
      </form>
    </div>
  );
}
