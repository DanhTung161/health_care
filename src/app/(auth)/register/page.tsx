"use client";

import { useState } from "react";
import Link from "next/link";
import FormField from "@/components/auth/FormField";

export default function Page() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    window.setTimeout(() => setIsSubmitting(false), 1200);
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
              Tạo tài khoản
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Bắt đầu hành trình chăm sóc sức khoẻ chủ động.
            </p>
          </div>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <FormField
              id="fullname"
              label="Họ và tên"
              type="text"
              placeholder="Nguyễn Văn A"
              required
            />
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
              placeholder="Tối thiểu 8 ký tự"
              required
            />
            <FormField
              id="confirm-password"
              label="Xác nhận mật khẩu"
              type="password"
              placeholder="••••••••"
              required
            />
            <label className="flex items-start gap-2 text-sm leading-5 text-slate-500">
              <input
                type="checkbox"
                required
                className="mt-1 h-4 w-4 rounded border-slate-300 accent-blue-600"
              />
              Tôi đồng ý với Điều khoản dịch vụ và Chính sách bảo mật.
            </label>
            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-2 h-11 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 disabled:opacity-70"
            >
              {isSubmitting ? "Đang tạo tài khoản..." : "Tạo tài khoản"}
            </button>
          </form>
          <p className="mt-7 text-center text-sm text-slate-500">
            Đã có tài khoản?{" "}
            <Link
              href="/login"
              className="font-semibold text-blue-600 hover:text-blue-700"
            >
              Đăng nhập
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
