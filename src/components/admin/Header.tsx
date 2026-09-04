"use client";
import { usePathname } from "next/navigation";
const titles: Record<string, [string, string]> = {
  dashboard: ["Dashboard", "Welcome back, Dr. Sarah Johnson"],
  patients: ["Patients", "Manage patient records and medical history"],
  appointments: ["Appointments", "Stay on top of today’s schedule"],
  doctors: ["Doctors", "Your clinical team and availability"],
  billing: ["Billing", "Track invoices, payments and revenue"],
  analytics: ["Analytics", "Insights to help your clinic perform better"],
  users: ["Users", "Manage accounts and access permissions"],
  settings: ["Settings", "Manage your account and workspace preferences"],
};
export default function AdminHeader() {
  const key = usePathname().split("/")[1] || "dashboard";
  const [title, subtitle] = titles[key] || titles.dashboard;
  return (
    <header className="flex h-[86px] shrink-0 items-center justify-between border-b border-slate-200/80 bg-white px-8">
      <div>
        <h1 className="text-[24px] font-bold tracking-tight text-slate-900">
          {title}
        </h1>
        <p className="mt-1 text-[13px] text-slate-500">{subtitle}</p>
      </div>
      <div className="flex items-center gap-5">
        <div className="hidden h-10 w-64 items-center gap-2 rounded-xl bg-slate-50 px-3 text-[12px] text-slate-400 md:flex">
          <span className="text-lg">⌕</span>Search patients, doctors...
        </div>
        <button className="text-xl text-slate-500" aria-label="Toggle theme">
          ☾
        </button>
        <button
          className="relative text-xl text-slate-500"
          aria-label="Notifications"
        >
          ♧
          <i className="absolute right-0 top-0 h-2 w-2 rounded-full bg-rose-500" />
        </button>
        <div className="flex items-center gap-3 border-l border-slate-100 pl-4">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-100 text-sm font-bold text-blue-700">
            SJ
          </div>
          <div className="hidden sm:block">
            <p className="text-[13px] font-semibold text-slate-800">
              Sarah Johnson
            </p>
            <p className="text-[11px] text-slate-400">Administrator</p>
          </div>
        </div>
      </div>
    </header>
  );
}
