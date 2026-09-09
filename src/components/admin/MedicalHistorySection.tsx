"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface PrescriptionItem {
  medicineName: string;
  dosage?: string;
  frequency?: string;
}

export interface MedicalVisitItem {
  _id: string;
  doctorId?: { _id: string; name: string; role?: string } | null;
  doctorName: string;
  visitDate: string;
  diagnosis: string;
  symptoms?: string;
  prescription: PrescriptionItem[];
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  isLegacy: boolean;
  canEdit: boolean;
}

interface MedicalHistorySectionProps {
  patientId: string;
  visits: MedicalVisitItem[];
  canAdd: boolean;
}

interface ApiResponse {
  success: boolean;
  error?: string;
}

const inputClassName =
  "rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10";

function formatDate(value?: string, includeTime = false) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    ...(includeTime ? { timeStyle: "short" } : {}),
  }).format(date);
}

function dateTimeInputValue(value?: string) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function prescriptionText(items: PrescriptionItem[]) {
  return items
    .map((item) =>
      [item.medicineName, item.dosage ?? "", item.frequency ?? ""].join(" | "),
    )
    .join("\n");
}

function parsePrescription(value: string): PrescriptionItem[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [medicineName = "", dosage = "", frequency = ""] = line
        .split("|")
        .map((part) => part.trim());
      return {
        medicineName,
        ...(dosage ? { dosage } : {}),
        ...(frequency ? { frequency } : {}),
      };
    });
}

export default function MedicalHistorySection({
  patientId,
  visits,
  canAdd,
}: MedicalHistorySectionProps) {
  const router = useRouter();
  const [editor, setEditor] = useState<MedicalVisitItem | "create" | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");
    const formData = new FormData(event.currentTarget);
    const visit = editor === "create" ? undefined : editor ?? undefined;
    const payload = {
      visitDate: String(formData.get("visitDate") ?? ""),
      diagnosis: String(formData.get("diagnosis") ?? "").trim(),
      symptoms: String(formData.get("symptoms") ?? "").trim(),
      prescription: parsePrescription(
        String(formData.get("prescription") ?? ""),
      ),
      notes: String(formData.get("notes") ?? "").trim(),
    };

    try {
      const response = await fetch(
        visit
          ? `/api/patients/${patientId}/medical-history/${visit._id}`
          : `/api/patients/${patientId}/medical-history`,
        {
          method: visit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(payload),
        },
      );
      const result = (await response.json()) as ApiResponse;
      if (!response.ok || !result.success) {
        setErrorMessage(result.error ?? "Unable to save the medical visit.");
        return;
      }

      setEditor(null);
      setSuccessMessage(visit ? "Medical visit updated." : "Medical visit added.");
      router.refresh();
    } catch {
      setErrorMessage("Unable to connect to the server.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const editingVisit = editor === "create" ? undefined : editor ?? undefined;

  return (
    <section className="mt-5 rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_5px_20px_rgba(15,23,42,0.03)]">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-slate-900">Medical history</h3>
          <p className="mt-1 text-xs text-slate-500">
            Visits become read-only 24 hours after creation.
          </p>
        </div>
        {canAdd && (
          <button
            type="button"
            onClick={() => {
              setErrorMessage("");
              setSuccessMessage("");
              setEditor("create");
            }}
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            + Add examination
          </button>
        )}
      </div>

      {(errorMessage || successMessage) && (
        <p
          role={errorMessage ? "alert" : "status"}
          className={`mb-4 rounded-xl px-3 py-2 text-sm ${
            errorMessage
              ? "bg-rose-50 text-rose-600"
              : "bg-emerald-50 text-emerald-700"
          }`}
        >
          {errorMessage || successMessage}
        </p>
      )}

      {visits.length ? (
        <div className="space-y-4">
          {visits.map((visit) => (
            <article
              key={`${visit.isLegacy ? "legacy" : "visit"}-${visit._id}`}
              className="rounded-xl border border-slate-100 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-800">
                    {visit.diagnosis}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {visit.doctorId?.name || visit.doctorName || "Unknown doctor"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500">
                    Visit: {formatDate(visit.visitDate, true)}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {visit.createdAt
                      ? `Created ${formatDate(visit.createdAt, true)}`
                      : "Legacy record"}
                  </p>
                </div>
              </div>

              {visit.symptoms && (
                <p className="mt-3 text-sm text-slate-600">
                  <span className="font-medium">Symptoms:</span> {visit.symptoms}
                </p>
              )}
              {visit.notes && (
                <p className="mt-2 text-sm text-slate-600">
                  <span className="font-medium">Notes:</span> {visit.notes}
                </p>
              )}
              {visit.prescription.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Prescription
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-slate-600">
                    {visit.prescription.map((item, index) => (
                      <li key={`${item.medicineName}-${index}`}>
                        {item.medicineName}
                        {item.dosage ? ` — ${item.dosage}` : ""}
                        {item.frequency ? `, ${item.frequency}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    visit.canEdit
                      ? "bg-blue-50 text-blue-600"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {visit.canEdit
                    ? "Editable for 24 hours"
                    : visit.isLegacy
                      ? "Legacy · Locked"
                      : "Locked · Read-only"}
                </span>
                {visit.canEdit && (
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMessage("");
                      setSuccessMessage("");
                      setEditor(visit);
                    }}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Edit
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500">No medical visits found.</p>
      )}

      {editor && (
        <div
          className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-slate-950/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="medical-visit-editor-title"
        >
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl"
          >
            <h3
              id="medical-visit-editor-title"
              className="text-lg font-bold text-slate-900"
            >
              {editor === "create" ? "Add examination" : "Edit medical visit"}
            </h3>
            <p className="mt-1 mb-5 text-sm text-slate-500">
              The patient and author are recorded by the server and cannot be changed.
            </p>
            <div className="grid gap-4">
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                Visit date
                <input
                  name="visitDate"
                  type="datetime-local"
                  required
                  defaultValue={dateTimeInputValue(editingVisit?.visitDate)}
                  className={inputClassName}
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                Diagnosis / conclusion
                <input
                  name="diagnosis"
                  required
                  defaultValue={editingVisit?.diagnosis}
                  className={inputClassName}
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                Symptoms
                <textarea
                  name="symptoms"
                  rows={2}
                  defaultValue={editingVisit?.symptoms}
                  className={inputClassName}
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                Prescription
                <textarea
                  name="prescription"
                  rows={3}
                  defaultValue={prescriptionText(
                    editingVisit?.prescription ?? [],
                  )}
                  placeholder="Medicine | dosage | frequency (one per line)"
                  className={inputClassName}
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                Clinical notes
                <textarea
                  name="notes"
                  rows={3}
                  defaultValue={editingVisit?.notes}
                  className={inputClassName}
                />
              </label>
            </div>

            {errorMessage && (
              <p
                role="alert"
                className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-600"
              >
                {errorMessage}
              </p>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditor(null)}
                disabled={isSubmitting}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {isSubmitting ? "Saving..." : "Save visit"}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
