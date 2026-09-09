"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export interface PatientListItem {
  _id: string;
  fullName: string;
  phone: string;
  identityCard?: string;
  gender?: "MALE" | "FEMALE" | "OTHER";
  dateOfBirth?: string;
  address?: string;
  deletedAt?: string | null;
}

interface PatientManagementProps {
  patients: PatientListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  query: {
    search: string;
    status: string;
    gender: string;
    sortBy: string;
    sortOrder: string;
  };
  canManage: boolean;
}

interface ApiResponse {
  success: boolean;
  error?: string;
}

const inputClassName =
  "h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10";

function getAge(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  if (
    today.getMonth() < date.getMonth() ||
    (today.getMonth() === date.getMonth() && today.getDate() < date.getDate())
  ) {
    age -= 1;
  }
  return String(age);
}

function getPatientPayload(form: HTMLFormElement) {
  const formData = new FormData(form);
  return {
    fullName: String(formData.get("fullName") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
    identityCard: String(formData.get("identityCard") ?? "").trim(),
    gender: String(formData.get("gender") ?? ""),
    dateOfBirth: String(formData.get("dateOfBirth") ?? ""),
    address: String(formData.get("address") ?? "").trim(),
  };
}

function PatientFields({ patient }: { patient?: PatientListItem }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 sm:col-span-2">
        Full name
        <input
          name="fullName"
          required
          defaultValue={patient?.fullName}
          className={inputClassName}
        />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
        Phone
        <input
          name="phone"
          required
          defaultValue={patient?.phone}
          className={inputClassName}
        />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
        Identity card
        <input
          name="identityCard"
          defaultValue={patient?.identityCard ?? ""}
          className={inputClassName}
        />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
        Gender
        <select
          name="gender"
          defaultValue={patient?.gender ?? ""}
          className={inputClassName}
        >
          <option value="">Not specified</option>
          <option value="MALE">Male</option>
          <option value="FEMALE">Female</option>
          <option value="OTHER">Other</option>
        </select>
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
        Date of birth
        <input
          name="dateOfBirth"
          type="date"
          defaultValue={patient?.dateOfBirth?.slice(0, 10)}
          className={inputClassName}
        />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 sm:col-span-2">
        Address
        <input
          name="address"
          defaultValue={patient?.address ?? ""}
          className={inputClassName}
        />
      </label>
    </div>
  );
}

export default function PatientManagement({
  patients,
  pagination,
  query,
  canManage,
}: PatientManagementProps) {
  const router = useRouter();
  const [editor, setEditor] = useState<PatientListItem | "create" | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  function navigate(values: Record<string, string>) {
    const params = new URLSearchParams(values);
    params.set("page", "1");
    router.push(`/patients?${params.toString()}`);
  }

  function pageUrl(page: number) {
    return `/patients?${new URLSearchParams({
      ...query,
      page: String(page),
    }).toString()}`;
  }

  async function submitPatient(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");
    const patient = editor === "create" ? undefined : editor ?? undefined;
    const data = getPatientPayload(event.currentTarget);

    try {
      const response = await fetch(
        patient ? `/api/patients/${patient._id}` : "/api/patients",
        {
          method: patient ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(data),
        },
      );
      const result = (await response.json()) as ApiResponse;
      if (!response.ok || !result.success) {
        setErrorMessage(result.error ?? "Unable to save the patient.");
        return;
      }

      setEditor(null);
      setSuccessMessage(patient ? "Patient updated." : "Patient created.");
      router.refresh();
    } catch {
      setErrorMessage("Unable to connect to the server.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function archivePatient(patient: PatientListItem) {
    if (
      !window.confirm(
        `Archive ${patient.fullName}? Their record and history will be retained.`,
      )
    ) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    try {
      const response = await fetch(`/api/patients/${patient._id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const result = (await response.json()) as ApiResponse;
      if (!response.ok || !result.success) {
        setErrorMessage(result.error ?? "Unable to archive the patient.");
        return;
      }
      setSuccessMessage(`${patient.fullName} was archived.`);
      router.refresh();
    } catch {
      setErrorMessage("Unable to connect to the server.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function restorePatient(patient: PatientListItem) {
    setIsSubmitting(true);
    setErrorMessage("");
    try {
      const response = await fetch(`/api/patients/${patient._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ action: "restore" }),
      });
      const result = (await response.json()) as ApiResponse;
      if (!response.ok || !result.success) {
        setErrorMessage(result.error ?? "Unable to restore the patient.");
        return;
      }
      setSuccessMessage(`${patient.fullName} was restored.`);
      router.refresh();
    } catch {
      setErrorMessage("Unable to connect to the server.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">All patients</h2>
          <p className="mt-1 text-sm text-slate-500">
            Manage patient records and medical history.
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => {
              setErrorMessage("");
              setEditor("create");
            }}
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-200 hover:bg-blue-700"
          >
            + Add patient
          </button>
        )}
      </div>

      <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_5px_20px_rgba(15,23,42,0.03)]">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            navigate({
              search: String(data.get("search") ?? ""),
              status: String(data.get("status") ?? "active"),
              gender: String(data.get("gender") ?? "all"),
              sortBy: String(data.get("sortBy") ?? "createdAt"),
              sortOrder: String(data.get("sortOrder") ?? "desc"),
            });
          }}
          className="mb-5 flex flex-wrap gap-3"
        >
          <input
            name="search"
            defaultValue={query.search}
            maxLength={200}
            placeholder="Search name, phone, or identity card..."
            className={`${inputClassName} min-w-64 flex-1`}
          />
          <select name="status" defaultValue={query.status} className={inputClassName}>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
            <option value="all">All records</option>
          </select>
          <select name="gender" defaultValue={query.gender} className={inputClassName}>
            <option value="all">All genders</option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
            <option value="OTHER">Other</option>
          </select>
          <select name="sortBy" defaultValue={query.sortBy} className={inputClassName}>
            <option value="createdAt">Created</option>
            <option value="fullName">Name</option>
            <option value="phone">Phone</option>
            <option value="gender">Gender</option>
            <option value="dateOfBirth">Date of birth</option>
            <option value="deletedAt">Archived date</option>
          </select>
          <select
            name="sortOrder"
            defaultValue={query.sortOrder}
            className={inputClassName}
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
          <button className="rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50">
            Apply
          </button>
        </form>

        {(errorMessage || successMessage) && (
          <p
            role={errorMessage ? "alert" : "status"}
            className={`mb-3 text-sm font-medium ${errorMessage ? "text-rose-600" : "text-emerald-600"}`}
          >
            {errorMessage || successMessage}
          </p>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="border-b border-slate-100 text-xs text-slate-400">
              <tr>
                <th className="pb-3 font-medium">Patient</th>
                <th className="pb-3 font-medium">Patient ID</th>
                <th className="pb-3 font-medium">Age</th>
                <th className="pb-3 font-medium">Gender</th>
                <th className="pb-3 font-medium">Phone</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {patients.map((patient) => {
                const isArchived = Boolean(patient.deletedAt);
                return (
                  <tr
                    key={patient._id}
                    className="border-b border-slate-50 last:border-0"
                  >
                    <td className="py-4 font-semibold text-slate-800">
                      {patient.fullName}
                    </td>
                    <td className="py-4 text-slate-500">
                      {patient.identityCard || patient._id}
                    </td>
                    <td className="py-4 text-slate-500">
                      {getAge(patient.dateOfBirth)}
                    </td>
                    <td className="py-4 text-slate-500">
                      {patient.gender ?? "—"}
                    </td>
                    <td className="py-4 text-slate-500">{patient.phone}</td>
                    <td className="py-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          isArchived
                            ? "bg-amber-50 text-amber-600"
                            : "bg-emerald-50 text-emerald-600"
                        }`}
                      >
                        {isArchived ? "Archived" : "Active"}
                      </span>
                    </td>
                    <td className="py-4">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/patients/${patient._id}`}
                          className="rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50"
                        >
                          View details
                        </Link>
                        {canManage && (
                          <button
                            type="button"
                            onClick={() => {
                              setErrorMessage("");
                              setEditor(patient);
                            }}
                            disabled={isSubmitting}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                          >
                            Edit
                          </button>
                        )}
                        {canManage && isArchived && (
                          <button
                            type="button"
                            onClick={() => restorePatient(patient)}
                            disabled={isSubmitting}
                            className="rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
                          >
                            Restore
                          </button>
                        )}
                        {canManage && !isArchived && (
                          <button
                            type="button"
                            onClick={() => archivePatient(patient)}
                            disabled={isSubmitting}
                            className="rounded-lg border border-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-60"
                          >
                            Archive
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
          <span>
            {pagination.total} patient{pagination.total === 1 ? "" : "s"}
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={pagination.page <= 1}
              onClick={() => router.push(pageUrl(pagination.page - 1))}
              className="rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-50"
            >
              Previous
            </button>
            <span>
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              type="button"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => router.push(pageUrl(pagination.page + 1))}
              className="rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </section>

      {editor && (
        <div
          className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-slate-950/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="patient-editor-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isSubmitting) {
              setEditor(null);
            }
          }}
        >
          <form
            onSubmit={submitPatient}
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="mb-5">
              <h3
                id="patient-editor-title"
                className="text-lg font-bold text-slate-900"
              >
                {editor === "create" ? "Create patient" : "Edit patient"}
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                {editor === "create"
                  ? "Add a new patient record."
                  : "Update the patient’s demographic and contact details."}
              </p>
            </div>
            <PatientFields patient={editor === "create" ? undefined : editor} />
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
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {isSubmitting ? "Saving..." : "Save patient"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
