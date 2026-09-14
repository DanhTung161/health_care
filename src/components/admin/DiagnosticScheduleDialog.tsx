"use client";

import { useState } from "react";
import { diagnosticLocalDateTimeToIso } from "@/lib/diagnostic-workflow-ui";
import type { DiagnosticStatus } from "@/lib/diagnostic";

const inputClassName =
  "h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10";

export default function DiagnosticScheduleDialog({
  serviceName,
  currentStatus,
  isSaving,
  errorMessage,
  onSubmit,
  onClose,
}: {
  serviceName: string;
  currentStatus: DiagnosticStatus;
  isSaving: boolean;
  errorMessage: string;
  onSubmit: (scheduledAt: string) => Promise<void>;
  onClose: () => void;
}) {
  const [localDateTime, setLocalDateTime] = useState("");
  const scheduledAt = diagnosticLocalDateTimeToIso(localDateTime);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!scheduledAt) return;
    await onSubmit(scheduledAt);
  }

  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-slate-950/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="schedule-diagnostic-item-title"
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
              id="schedule-diagnostic-item-title"
              className="text-lg font-bold text-slate-900"
            >
              Schedule diagnostic item
            </h3>
            <p className="mt-1 text-sm text-slate-500">{serviceName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            aria-label="Close scheduling dialog"
            className="rounded-lg px-2 py-1 text-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
          >
            ×
          </button>
        </div>

        <div className="mt-5 rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-600">
          Current workflow status: <span className="font-semibold text-slate-800">{currentStatus}</span>
        </div>

        <label className="mt-5 flex flex-col gap-2 text-sm font-medium text-slate-700">
          Scheduled date and time
          <input
            required
            type="datetime-local"
            value={localDateTime}
            onChange={(event) => setLocalDateTime(event.target.value)}
            className={inputClassName}
          />
        </label>
        <p className="mt-2 text-xs text-slate-500">
          Entered in this device&apos;s local timezone. It will be converted to an explicit UTC timestamp for the server.
        </p>
        {scheduledAt && (
          <p className="mt-2 break-all rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
            Server timestamp: {scheduledAt}
          </p>
        )}

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
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving || !scheduledAt}
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Scheduling…" : "Schedule item"}
          </button>
        </div>
      </form>
    </div>
  );
}
