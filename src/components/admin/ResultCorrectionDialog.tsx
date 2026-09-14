"use client";

import { useState } from "react";
import { DIAGNOSTIC_RESULT_LIMITS } from "@/lib/diagnostic-results";

export default function ResultCorrectionDialog({
  itemId,
  isSaving,
  errorMessage,
  onSubmit,
  onClose,
}: {
  itemId: string;
  isSaving: boolean;
  errorMessage: string;
  onSubmit: (reason: string) => Promise<void>;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reason.trim()) return;
    await onSubmit(reason.trim());
  }

  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-slate-950/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`correction-title-${itemId}`}
    >
      <form onSubmit={submit} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <h3 id={`correction-title-${itemId}`} className="text-lg font-bold text-slate-900">
          Start Result correction
        </h3>
        <p className="mt-2 text-sm text-slate-500">
          A new draft revision will be created from the Current Final. The existing Final remains effective until the correction is finalized.
        </p>
        <label className="mt-5 flex flex-col gap-2 text-sm font-medium text-slate-700">
          Correction reason
          <textarea
            required
            rows={4}
            value={reason}
            maxLength={DIAGNOSTIC_RESULT_LIMITS.correctionReason}
            onChange={(event) => setReason(event.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
          />
        </label>
        {errorMessage && (
          <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
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
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving || !reason.trim()}
            className="rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {isSaving ? "Creating…" : "Create correction draft"}
          </button>
        </div>
      </form>
    </div>
  );
}
