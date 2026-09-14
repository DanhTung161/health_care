"use client";

import { useState } from "react";
import { DIAGNOSTIC_RESULT_LIMITS } from "@/lib/diagnostic-results";
import type {
  ImagingDraftPayload,
  ImagingResultRevisionView,
} from "@/lib/diagnostic-client";

const textareaClassName =
  "rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10";

export default function ImagingResultEditor({
  revision,
  isSaving,
  errorMessage,
  onSave,
  onCancel,
}: {
  revision?: ImagingResultRevisionView;
  isSaving: boolean;
  errorMessage: string;
  onSave: (payload: ImagingDraftPayload) => Promise<void>;
  onCancel: () => void;
}) {
  const [findings, setFindings] = useState(revision?.findings ?? "");
  const [impression, setImpression] = useState(revision?.impression ?? "");
  const [technique, setTechnique] = useState(revision?.technique ?? "");
  const [comparison, setComparison] = useState(revision?.comparison ?? "");
  const [recommendation, setRecommendation] = useState(
    revision?.recommendation ?? "",
  );

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSave({
      findings: findings.trim(),
      impression: impression.trim(),
      ...(technique.trim() ? { technique: technique.trim() } : {}),
      ...(comparison.trim() ? { comparison: comparison.trim() } : {}),
      ...(recommendation.trim()
        ? { recommendation: recommendation.trim() }
        : {}),
    });
  }

  return (
    <div
      className="fixed inset-0 z-[70] overflow-y-auto bg-slate-950/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="imaging-result-editor-title"
    >
      <form
        onSubmit={submit}
        className="mx-auto my-4 w-full max-w-3xl rounded-2xl bg-white p-5 shadow-2xl md:p-6"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h3 id="imaging-result-editor-title" className="text-lg font-bold text-slate-900">
              {revision ? `Edit Imaging Result · Revision ${revision.version}` : "Create Imaging Result draft"}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              A draft may be incomplete. Findings and impression are required only before finalization.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            aria-label="Close Imaging Result editor"
            className="rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-500 hover:bg-slate-100 disabled:opacity-50"
          >
            Close
          </button>
        </div>

        <div className="grid gap-4">
          <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
            Findings
            <textarea
              rows={7}
              value={findings}
              maxLength={DIAGNOSTIC_RESULT_LIMITS.imagingFindings}
              onChange={(event) => setFindings(event.target.value)}
              className={textareaClassName}
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
            Impression
            <textarea
              rows={5}
              value={impression}
              maxLength={DIAGNOSTIC_RESULT_LIMITS.imagingImpression}
              onChange={(event) => setImpression(event.target.value)}
              className={textareaClassName}
            />
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
              Technique
              <textarea
                rows={3}
                value={technique}
                maxLength={DIAGNOSTIC_RESULT_LIMITS.imagingOptionalSection}
                onChange={(event) => setTechnique(event.target.value)}
                className={textareaClassName}
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
              Comparison
              <textarea
                rows={3}
                value={comparison}
                maxLength={DIAGNOSTIC_RESULT_LIMITS.imagingOptionalSection}
                onChange={(event) => setComparison(event.target.value)}
                className={textareaClassName}
              />
            </label>
          </div>
          <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
            Recommendation
            <textarea
              rows={3}
              value={recommendation}
              maxLength={DIAGNOSTIC_RESULT_LIMITS.imagingOptionalSection}
              onChange={(event) => setRecommendation(event.target.value)}
              className={textareaClassName}
            />
          </label>
        </div>

        {errorMessage && (
          <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {errorMessage}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Saving draft…" : "Save complete draft"}
          </button>
        </div>
      </form>
    </div>
  );
}
