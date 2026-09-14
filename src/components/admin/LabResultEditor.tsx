"use client";

import { useState } from "react";
import {
  DIAGNOSTIC_RESULT_LIMITS,
  LAB_RESULT_INTERPRETATIONS,
  type LabResultInterpretation,
} from "@/lib/diagnostic-results";
import type {
  LabDraftPayload,
  LabResultRevisionView,
} from "@/lib/diagnostic-client";

interface LabAnalyteEditorRow {
  key: number;
  code: string;
  name: string;
  value: string;
  unit: string;
  referenceRange: string;
  interpretation: LabResultInterpretation;
}

const inputClassName =
  "h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10";

function initialRows(revision?: LabResultRevisionView): LabAnalyteEditorRow[] {
  return (revision?.analytes ?? []).map((analyte, index) => ({
    key: index + 1,
    code: analyte.code ?? "",
    name: analyte.name,
    value: analyte.value,
    unit: analyte.unit ?? "",
    referenceRange: analyte.referenceRange ?? "",
    interpretation: analyte.interpretation,
  }));
}

export default function LabResultEditor({
  revision,
  isSaving,
  errorMessage,
  onSave,
  onCancel,
}: {
  revision?: LabResultRevisionView;
  isSaving: boolean;
  errorMessage: string;
  onSave: (payload: LabDraftPayload) => Promise<void>;
  onCancel: () => void;
}) {
  const [rows, setRows] = useState(() => initialRows(revision));
  const [nextKey, setNextKey] = useState(() => rows.length + 1);
  const [clinicalComment, setClinicalComment] = useState(
    revision?.clinicalComment ?? "",
  );

  function addRow() {
    if (rows.length >= DIAGNOSTIC_RESULT_LIMITS.maxLabAnalytes) return;
    setRows((current) => [
      ...current,
      {
        key: nextKey,
        code: "",
        name: "",
        value: "",
        unit: "",
        referenceRange: "",
        interpretation: "UNKNOWN",
      },
    ]);
    setNextKey((current) => current + 1);
  }

  function updateRow<Field extends Exclude<keyof LabAnalyteEditorRow, "key">>(
    key: number,
    field: Field,
    value: LabAnalyteEditorRow[Field],
  ) {
    setRows((current) =>
      current.map((row) =>
        row.key === key ? { ...row, [field]: value } : row,
      ),
    );
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSave({
      analytes: rows.map((row) => ({
        ...(row.code.trim() ? { code: row.code.trim() } : {}),
        name: row.name.trim(),
        value: row.value.trim(),
        ...(row.unit.trim() ? { unit: row.unit.trim() } : {}),
        ...(row.referenceRange.trim()
          ? { referenceRange: row.referenceRange.trim() }
          : {}),
        interpretation: row.interpretation,
      })),
      ...(clinicalComment.trim()
        ? { clinicalComment: clinicalComment.trim() }
        : {}),
    });
  }

  return (
    <div
      className="fixed inset-0 z-[70] overflow-y-auto bg-slate-950/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lab-result-editor-title"
    >
      <form
        onSubmit={submit}
        className="mx-auto my-4 w-full max-w-6xl rounded-2xl bg-white p-5 shadow-2xl md:p-6"
      >
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 id="lab-result-editor-title" className="text-lg font-bold text-slate-900">
              {revision ? `Edit Lab Result · Revision ${revision.version}` : "Create Lab Result draft"}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Values remain text. Interpretation is recorded explicitly and is not calculated.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            aria-label="Close Lab Result editor"
            className="rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-500 hover:bg-slate-100 disabled:opacity-50"
          >
            Close
          </button>
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-800">Analytes</p>
            <p className="mt-1 text-xs text-slate-500">
              A draft may be empty; finalization requires at least one analyte.
            </p>
          </div>
          <button
            type="button"
            onClick={addRow}
            disabled={isSaving || rows.length >= DIAGNOSTIC_RESULT_LIMITS.maxLabAnalytes}
            className="rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-50 disabled:opacity-50"
          >
            + Add analyte
          </button>
        </div>

        {rows.length ? (
          <div className="space-y-3">
            {rows.map((row, index) => (
              <fieldset
                key={row.key}
                className="rounded-xl border border-slate-200 p-3"
              >
                <legend className="px-1 text-xs font-semibold text-slate-500">
                  Analyte {index + 1}
                </legend>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
                  <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                    Code
                    <input
                      value={row.code}
                      maxLength={DIAGNOSTIC_RESULT_LIMITS.analyteCode}
                      onChange={(event) => updateRow(row.key, "code", event.target.value)}
                      className={inputClassName}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 lg:col-span-2">
                    Name
                    <input
                      required
                      value={row.name}
                      maxLength={DIAGNOSTIC_RESULT_LIMITS.analyteName}
                      onChange={(event) => updateRow(row.key, "name", event.target.value)}
                      className={inputClassName}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                    Value
                    <input
                      required
                      value={row.value}
                      maxLength={DIAGNOSTIC_RESULT_LIMITS.analyteValue}
                      onChange={(event) => updateRow(row.key, "value", event.target.value)}
                      className={inputClassName}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                    Unit
                    <input
                      value={row.unit}
                      maxLength={DIAGNOSTIC_RESULT_LIMITS.analyteUnit}
                      onChange={(event) => updateRow(row.key, "unit", event.target.value)}
                      className={inputClassName}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                    Reference range
                    <input
                      value={row.referenceRange}
                      maxLength={DIAGNOSTIC_RESULT_LIMITS.referenceRange}
                      onChange={(event) => updateRow(row.key, "referenceRange", event.target.value)}
                      className={inputClassName}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                    Interpretation
                    <select
                      value={row.interpretation}
                      onChange={(event) =>
                        updateRow(
                          row.key,
                          "interpretation",
                          event.target.value as LabResultInterpretation,
                        )
                      }
                      className={inputClassName}
                    >
                      {LAB_RESULT_INTERPRETATIONS.map((interpretation) => (
                        <option key={interpretation} value={interpretation}>{interpretation}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}
                  disabled={isSaving}
                  className="mt-3 text-xs font-semibold text-rose-600 hover:underline disabled:opacity-50"
                >
                  Remove analyte
                </button>
              </fieldset>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
            This draft has no analytes. Add one now or save the empty draft for later.
          </div>
        )}

        <label className="mt-4 flex flex-col gap-2 text-sm font-medium text-slate-700">
          Clinical comment
          <textarea
            rows={4}
            value={clinicalComment}
            maxLength={DIAGNOSTIC_RESULT_LIMITS.clinicalComment}
            onChange={(event) => setClinicalComment(event.target.value)}
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
