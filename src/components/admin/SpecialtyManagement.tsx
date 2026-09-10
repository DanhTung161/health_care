"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface SpecialtyItem {
  _id: string;
  name: string;
  description?: string;
}

interface ApiResponse {
  success: boolean;
  error?: string;
}

const inputClassName =
  "h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10";

function SpecialtyFields({ specialty }: { specialty?: SpecialtyItem }) {
  return (
    <div className="space-y-4">
      <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
        Specialty name
        <input
          name="name"
          required
          defaultValue={specialty?.name}
          className={inputClassName}
        />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
        Description (optional)
        <textarea
          name="description"
          defaultValue={specialty?.description ?? ""}
          rows={3}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
        />
      </label>
    </div>
  );
}

function specialtyPayload(form: HTMLFormElement) {
  const formData = new FormData(form);
  return {
    name: String(formData.get("name") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
  };
}

export function CreateSpecialtyForm() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");
    const form = event.currentTarget;

    try {
      const response = await fetch("/api/specialties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(specialtyPayload(form)),
      });
      const result = (await response.json()) as ApiResponse;
      if (!response.ok || !result.success) {
        setErrorMessage(result.error ?? "Unable to create specialty.");
        return;
      }

      form.reset();
      setIsOpen(false);
      setSuccessMessage("Specialty created successfully.");
      router.refresh();
    } catch {
      setErrorMessage("Unable to connect to the server.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-3">
        {successMessage && (
          <p role="status" className="text-sm font-medium text-emerald-600">
            {successMessage}
          </p>
        )}
        <button
          type="button"
          onClick={() => {
            setErrorMessage("");
            setSuccessMessage("");
            setIsOpen(true);
          }}
          className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-200 hover:bg-blue-700"
        >
          + Add specialty
        </button>
      </div>

      {isOpen && (
        <div
          className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-slate-950/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-specialty-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isSubmitting) {
              setIsOpen(false);
            }
          }}
        >
          <form onSubmit={handleSubmit} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h3 id="create-specialty-title" className="text-lg font-bold text-slate-900">
                  Create specialty
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Add a specialty for assigning to doctors.
                </p>
              </div>
              <button type="button" onClick={() => setIsOpen(false)} disabled={isSubmitting} aria-label="Close create specialty form" className="rounded-lg px-2 py-1 text-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700">×</button>
            </div>
            <SpecialtyFields />
            {errorMessage && <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-600">{errorMessage}</p>}
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setIsOpen(false)} disabled={isSubmitting} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60">Cancel</button>
              <button type="submit" disabled={isSubmitting} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{isSubmitting ? "Creating..." : "Create specialty"}</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

export function SpecialtyActions({ specialty }: { specialty: SpecialtyItem }) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);

  async function handleEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/specialties/${specialty._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(specialtyPayload(event.currentTarget)),
      });
      const result = (await response.json()) as ApiResponse;
      if (!response.ok || !result.success) {
        setMessage({ text: result.error ?? "Unable to update specialty.", isError: true });
        return;
      }

      setIsEditing(false);
      setMessage({ text: "Specialty updated successfully.", isError: false });
      router.refresh();
    } catch {
      setMessage({ text: "Unable to connect to the server.", isError: true });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete the specialty "${specialty.name}"? This cannot be undone.`)) {
      return;
    }

    setIsSubmitting(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/specialties/${specialty._id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const result = (await response.json()) as ApiResponse;
      if (!response.ok || !result.success) {
        setMessage({ text: result.error ?? "Unable to delete specialty.", isError: true });
        return;
      }

      router.refresh();
    } catch {
      setMessage({ text: "Unable to connect to the server.", isError: true });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => { setMessage(null); setIsEditing(true); }} disabled={isSubmitting} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60">Edit</button>
        <button type="button" onClick={handleDelete} disabled={isSubmitting} className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-60">Delete</button>
      </div>
      {message && <p role={message.isError ? "alert" : "status"} className={`mt-2 text-xs font-medium ${message.isError ? "text-rose-600" : "text-emerald-600"}`}>{message.text}</p>}
      {isEditing && (
        <div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-slate-950/45 p-4" role="dialog" aria-modal="true" aria-labelledby={`edit-specialty-title-${specialty._id}`} onMouseDown={(event) => { if (event.target === event.currentTarget && !isSubmitting) setIsEditing(false); }}>
          <form onSubmit={handleEdit} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div><h3 id={`edit-specialty-title-${specialty._id}`} className="text-lg font-bold text-slate-900">Edit specialty</h3><p className="mt-1 text-sm text-slate-500">Renaming keeps existing doctor assignments intact.</p></div>
              <button type="button" onClick={() => setIsEditing(false)} disabled={isSubmitting} aria-label="Close edit specialty form" className="rounded-lg px-2 py-1 text-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700">×</button>
            </div>
            <SpecialtyFields specialty={specialty} />
            {message?.isError && <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-600">{message.text}</p>}
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setIsEditing(false)} disabled={isSubmitting} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60">Cancel</button>
              <button type="submit" disabled={isSubmitting} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{isSubmitting ? "Saving..." : "Save changes"}</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
