"use client";

import { useState } from "react";
import Link from "next/link";
import FormField from "@/components/auth/FormField";

export default function Page() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").toLowerCase();
    const role = email.includes("sarah") ? "Admin" : email.includes("emily") || email.includes("michael") ? "Doctor" : "Staff";
    document.cookie = `healthnexus.session=demo-session; path=/; max-age=86400; samesite=lax`;
    document.cookie = `healthnexus.role=${role}; path=/; max-age=86400; samesite=lax`;
    setIsSubmitting(true);
    window.setTimeout(() => { window.location.assign("/dashboard"); }, 500);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-slate-50 to-white px-4 py-10">
      <div className="w-full max-w-[440px]">
        <Link
          href="/"
          className="mb-7 flex items-center justify-center gap-2 text-lg font-bold text-slate-900"
        >
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-600 text-white">
            ✚
          </span>
          HealthNexus
        </Link>
        <div className="rounded-3xl border border-slate-100 bg-white p-7 shadow-[0_18px_50px_rgba(30,64,175,0.1)] sm:p-9">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Chào mừng trở lại
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Đăng nhập để tiếp tục theo dõi sức khoẻ của bạn.
            </p>
          </div>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <FormField
              id="email"
              label="Email"
              type="email"
              placeholder="ban@vidu.com"
              required
            />
            <FormField
              id="password"
              label="Mật khẩu"
              type="password"
              placeholder="••••••••"
              required
            />
            <div className="flex justify-end">
              <Link
                href="#"
                className="text-sm font-semibold text-blue-600 hover:text-blue-700"
              >
                Quên mật khẩu?
              </Link>
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-2 h-11 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 disabled:opacity-70"
            >
              {isSubmitting ? "Đang đăng nhập..." : "Đăng nhập"}
            </button>
          </form>
          <p className="mt-7 text-center text-sm text-slate-500">
            Chưa có tài khoản?{" "}
            <Link
              href="/register"
              className="font-semibold text-blue-600 hover:text-blue-700"
            >
              Đăng ký ngay
            </Link>
          </p>
        </div>
        <p className="mt-6 text-center text-xs text-slate-400">
          © 2026 HealthNexus. Chăm sóc sức khoẻ dễ dàng hơn.
        </p>
      </div>
    </main>
  );
}
