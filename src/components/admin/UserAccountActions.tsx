"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { USER_ROLES, type Role } from "@/lib/roles";

interface UserAccount {
  _id: string;
  name: string;
  email: string;
  role: Role;
  phone?: string;
  isActive: boolean;
}

interface UserAccountActionsProps {
  user: UserAccount;
  isCurrentUser: boolean;
}

interface ApiResponse {
  success: boolean;
  error?: string;
}

const inputClassName =
  "h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10";

export default function UserAccountActions({
  user,
  isCurrentUser,
}: UserAccountActionsProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  function openEditor() {
    setErrorMessage("");
    setSuccessMessage("");
    setIsEditing(true);
  }

  async function handleEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");

    const formData = new FormData(event.currentTarget);
    const payload = {
      name: String(formData.get("name") ?? "").trim(),
      email: String(formData.get("email") ?? "").trim().toLowerCase(),
      password: String(formData.get("password") ?? ""),
      role: String(formData.get("role") ?? ""),
      phone: String(formData.get("phone") ?? "").trim(),
      isActive: formData.get("isActive") === "on",
    };

    try {
      const response = await fetch(`/api/users/${user._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as ApiResponse;
      if (!response.ok || !result.success) {
        setErrorMessage(result.error ?? "Unable to update the account.");
        return;
      }

      setIsEditing(false);
      setSuccessMessage(`Account updated for ${payload.email}.`);
      router.refresh();
    } catch {
      setErrorMessage("Unable to connect to the server.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (isCurrentUser || !window.confirm(`Delete the account for ${user.email}? This cannot be undone.`)) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const response = await fetch(`/api/users/${user._id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const result = (await response.json()) as ApiResponse;
      if (!response.ok || !result.success) {
        setErrorMessage(result.error ?? "Unable to delete the account.");
        return;
      }

      window.alert(`Account deleted for ${user.email}.`);
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
        <button
          type="button"
          onClick={openEditor}
          disabled={isSubmitting}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isSubmitting || isCurrentUser}
          title={isCurrentUser ? "You cannot delete your own account" : undefined}
          className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Delete
        </button>
      </div>

      {(errorMessage || successMessage) && (
        <p
          role={errorMessage ? "alert" : "status"}
          className={`mt-2 text-xs font-medium ${errorMessage ? "text-rose-600" : "text-emerald-600"}`}
        >
          {errorMessage || successMessage}
        </p>
      )}

      {isEditing && (
        <div
          className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-slate-950/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`edit-user-title-${user._id}`}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isSubmitting) setIsEditing(false);
          }}
        >
          <form onSubmit={handleEdit} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h3 id={`edit-user-title-${user._id}`} className="text-lg font-bold text-slate-900">
                  Edit user account
                </h3>
                <p className="mt-1 text-sm text-slate-500">Leave the password empty to keep it unchanged.</p>
              </div>
              <button type="button" onClick={() => setIsEditing(false)} disabled={isSubmitting} aria-label="Close edit user form" className="rounded-lg px-2 py-1 text-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                ×
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 sm:col-span-2">
                Full name
                <input name="name" required maxLength={100} defaultValue={user.name} className={inputClassName} />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 sm:col-span-2">
                Email
                <input name="email" type="email" required maxLength={254} defaultValue={user.email} className={inputClassName} />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                New password (optional)
                <input name="password" type="password" minLength={8} maxLength={128} autoComplete="new-password" className={inputClassName} />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                Role
                <select name="role" required defaultValue={user.role} className={inputClassName}>
                  {USER_ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 sm:col-span-2">
                Phone (optional)
                <input name="phone" type="tel" maxLength={30} defaultValue={user.phone ?? ""} className={inputClassName} />
              </label>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 sm:col-span-2">
                <input name="isActive" type="checkbox" defaultChecked={user.isActive} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                Account is active
              </label>
            </div>

            {errorMessage && <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-600">{errorMessage}</p>}

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setIsEditing(false)} disabled={isSubmitting} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60">Cancel</button>
              <button type="submit" disabled={isSubmitting} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
                {isSubmitting ? "Saving..." : "Save changes"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
