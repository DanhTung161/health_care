"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { USER_ROLES } from "@/lib/roles";

interface CreateUserResponse {
  success: boolean;
  error?: string;
}

const inputClassName =
  "h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10";

export default function CreateUserForm() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  function openForm() {
    setErrorMessage("");
    setSuccessMessage("");
    setIsOpen(true);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");

    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = {
      name: String(formData.get("name") ?? "").trim(),
      email: String(formData.get("email") ?? "").trim().toLowerCase(),
      password: String(formData.get("password") ?? ""),
      role: String(formData.get("role") ?? ""),
      phone: String(formData.get("phone") ?? "").trim(),
    };

    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as CreateUserResponse;

      if (!response.ok || !result.success) {
        setErrorMessage(result.error ?? "Unable to create the account.");
        return;
      }

      form.reset();
      setIsOpen(false);
      setSuccessMessage(`Account created for ${payload.email}.`);
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
          onClick={openForm}
          className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-200 hover:bg-blue-700"
        >
          + Add user
        </button>
      </div>

      {isOpen && (
        <div
          className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-slate-950/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-user-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isSubmitting) {
              setIsOpen(false);
            }
          }}
        >
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h3 id="create-user-title" className="text-lg font-bold text-slate-900">
                  Create user account
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  The user can sign in with the email and password below.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                disabled={isSubmitting}
                aria-label="Close create user form"
                className="rounded-lg px-2 py-1 text-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                ×
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 sm:col-span-2">
                Full name
                <input name="name" required maxLength={100} className={inputClassName} />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 sm:col-span-2">
                Email
                <input name="email" type="email" required maxLength={254} className={inputClassName} />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                Password
                <input
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  maxLength={128}
                  autoComplete="new-password"
                  className={inputClassName}
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                Role
                <select name="role" required defaultValue="STAFF" className={inputClassName}>
                  {USER_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 sm:col-span-2">
                Phone (optional)
                <input name="phone" type="tel" maxLength={30} className={inputClassName} />
              </label>
            </div>

            {errorMessage && (
              <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-600">
                {errorMessage}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
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
                {isSubmitting ? "Creating..." : "Create account"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
