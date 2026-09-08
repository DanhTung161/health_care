"use client";

import { Bell, Menu, Moon, Search } from "lucide-react";
import { usePathname } from "next/navigation";
import { useAdminSidebar } from "@/context/AdminSidebarContext";

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
  const { openMobile } = useAdminSidebar();

  return <header className="flex min-h-[78px] shrink-0 items-center justify-between gap-4 border-b border-slate-200/80 bg-white px-4 md:h-[86px] md:px-8">
    <div className="flex min-w-0 items-center gap-3">
      <button type="button" onClick={() => { console.log("Menu button clicked"); openMobile(); }} aria-label="Open sidebar" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-slate-600 transition hover:bg-slate-100 md:hidden"><Menu className="h-5 w-5" /></button>
      <div className="min-w-0"><h1 className="truncate text-xl font-bold tracking-tight text-slate-900 md:text-[24px]">{title}</h1><p className="mt-1 truncate text-[12px] text-slate-500 md:text-[13px]">{subtitle}</p></div>
    </div>
    <div className="flex shrink-0 items-center gap-3 md:gap-5">
      <div className="hidden h-10 w-64 items-center gap-2 rounded-xl bg-slate-50 px-3 text-[12px] text-slate-400 lg:flex"><Search className="h-4 w-4" />Search patients, doctors...</div>
      <button type="button" className="hidden text-slate-500 transition hover:text-slate-900 sm:block" aria-label="Toggle theme"><Moon className="h-5 w-5" /></button>
      <button type="button" className="relative text-slate-500 transition hover:text-slate-900" aria-label="Notifications"><Bell className="h-5 w-5" /><i className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-rose-500" /></button>
      <div className="flex items-center gap-3 border-l border-slate-100 pl-3 md:pl-4"><div className="grid h-9 w-9 place-items-center rounded-xl bg-blue-100 text-xs font-bold text-blue-700 md:h-10 md:w-10 md:text-sm">SJ</div><div className="hidden sm:block"><p className="text-[13px] font-semibold text-slate-800">Sarah Johnson</p><p className="text-[11px] text-slate-400">Administrator</p></div></div>
    </div>
  </header>;
}

