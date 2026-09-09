"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface SpecialtyOption {
  _id: string;
  name: string;
}

export interface DoctorAccount {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  specialtyId?: SpecialtyOption | null;
  isActive: boolean;
}

interface ApiResponse {
  success: boolean;
  error?: string;
}

const inputClassName =
  "h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10";

function DoctorFields({
  specialties,
  doctor,
  includePassword,
}: {
  specialties: SpecialtyOption[];
  doctor?: DoctorAccount;
  includePassword: boolean;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 sm:col-span-2">
        Full name
        <input name="name" required maxLength={100} defaultValue={doctor?.name} className={inputClassName} />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 sm:col-span-2">
        Email
        <input name="email" type="email" required maxLength={254} defaultValue={doctor?.email} className={inputClassName} />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
        {includePassword ? "Password" : "New password (optional)"}
        <input name="password" type="password" required={includePassword} minLength={8} maxLength={128} autoComplete="new-password" className={inputClassName} />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
        Specialty
        <select name="specialtyId" defaultValue={doctor?.specialtyId?._id ?? ""} className={inputClassName}>
          <option value="">Unassigned</option>
          {specialties.map((specialty) => <option key={specialty._id} value={specialty._id}>{specialty.name}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 sm:col-span-2">
        Phone (optional)
        <input name="phone" type="tel" maxLength={30} defaultValue={doctor?.phone ?? ""} className={inputClassName} />
      </label>
      <label className="flex items-center gap-2 text-sm font-medium text-slate-700 sm:col-span-2">
        <input name="isActive" type="checkbox" defaultChecked={doctor?.isActive ?? true} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
        Doctor is available
      </label>
    </div>
  );
}

function doctorPayload(form: HTMLFormElement) {
  const formData = new FormData(form);
  return {
    name: String(formData.get("name") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    password: String(formData.get("password") ?? ""),
    specialtyId: String(formData.get("specialtyId") ?? ""),
    phone: String(formData.get("phone") ?? "").trim(),
    isActive: formData.get("isActive") === "on",
  };
}

export function CreateDoctorForm({ specialties }: { specialties: SpecialtyOption[] }) {
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
    const payload = doctorPayload(form);
    try {
      const response = await fetch("/api/doctors", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify(payload) });
      const result = (await response.json()) as ApiResponse;
      if (!response.ok || !result.success) {
        setErrorMessage(result.error ?? "Unable to create the doctor account.");
        return;
      }
      form.reset();
      setIsOpen(false);
      setSuccessMessage(`Doctor account created for ${payload.email}.`);
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
        {successMessage && <p role="status" className="text-sm font-medium text-emerald-600">{successMessage}</p>}
        <button type="button" onClick={() => { setErrorMessage(""); setSuccessMessage(""); setIsOpen(true); }} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-200 hover:bg-blue-700">+ Add doctor</button>
      </div>
      {isOpen && (
        <div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-slate-950/45 p-4" role="dialog" aria-modal="true" aria-labelledby="create-doctor-title" onMouseDown={(event) => { if (event.target === event.currentTarget && !isSubmitting) setIsOpen(false); }}>
          <form onSubmit={handleSubmit} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div><h3 id="create-doctor-title" className="text-lg font-bold text-slate-900">Create doctor account</h3><p className="mt-1 text-sm text-slate-500">The doctor can sign in with the email and password below.</p></div>
              <button type="button" onClick={() => setIsOpen(false)} disabled={isSubmitting} aria-label="Close create doctor form" className="rounded-lg px-2 py-1 text-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700">×</button>
            </div>
            <DoctorFields specialties={specialties} includePassword />
            {errorMessage && <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-600">{errorMessage}</p>}
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setIsOpen(false)} disabled={isSubmitting} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60">Cancel</button>
              <button type="submit" disabled={isSubmitting} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{isSubmitting ? "Creating..." : "Create doctor"}</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

export function DoctorActions({ doctor, specialties }: { doctor: DoctorAccount; specialties: SpecialtyOption[] }) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function handleEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");
    const payload = doctorPayload(event.currentTarget);
    try {
      const response = await fetch(`/api/doctors/${doctor._id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify(payload) });
      const result = (await response.json()) as ApiResponse;
      if (!response.ok || !result.success) {
        setErrorMessage(result.error ?? "Unable to update the doctor account.");
        return;
      }
      setIsEditing(false);
      setSuccessMessage(`Doctor account updated for ${payload.email}.`);
      router.refresh();
    } catch {
      setErrorMessage("Unable to connect to the server.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete the doctor account for ${doctor.email}? This cannot be undone.`)) return;
    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const response = await fetch(`/api/doctors/${doctor._id}`, { method: "DELETE", credentials: "same-origin" });
      const result = (await response.json()) as ApiResponse;
      if (!response.ok || !result.success) {
        setErrorMessage(result.error ?? "Unable to delete the doctor account.");
        return;
      }
      window.alert(`Doctor account deleted for ${doctor.email}.`);
      router.refresh();
    } catch {
      setErrorMessage("Unable to connect to the server.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => { setErrorMessage(""); setSuccessMessage(""); setIsEditing(true); }} disabled={isSubmitting} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60">Edit</button>
        <button type="button" onClick={handleDelete} disabled={isSubmitting} className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-60">Delete</button>
      </div>
      {(errorMessage || successMessage) && <p role={errorMessage ? "alert" : "status"} className={`mt-2 text-xs font-medium ${errorMessage ? "text-rose-600" : "text-emerald-600"}`}>{errorMessage || successMessage}</p>}
      {isEditing && (
        <div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-slate-950/45 p-4" role="dialog" aria-modal="true" aria-labelledby={`edit-doctor-title-${doctor._id}`} onMouseDown={(event) => { if (event.target === event.currentTarget && !isSubmitting) setIsEditing(false); }}>
          <form onSubmit={handleEdit} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div><h3 id={`edit-doctor-title-${doctor._id}`} className="text-lg font-bold text-slate-900">Edit doctor account</h3><p className="mt-1 text-sm text-slate-500">Leave the password empty to keep it unchanged.</p></div>
              <button type="button" onClick={() => setIsEditing(false)} disabled={isSubmitting} aria-label="Close edit doctor form" className="rounded-lg px-2 py-1 text-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700">×</button>
            </div>
            <DoctorFields specialties={specialties} doctor={doctor} includePassword={false} />
            {errorMessage && <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-600">{errorMessage}</p>}
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
