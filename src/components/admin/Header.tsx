"use client";

import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import AdminHeaderSearch from "@/components/admin/AdminHeaderSearch";
import ThemeToggle from "@/components/admin/ThemeToggle";
import { useAdminSidebar } from "@/context/AdminSidebarContext";
import type { Role } from "@/lib/roles";

const titles: Record<string, [string, string]> = {
  dashboard: ["Dashboard", "Welcome back, Dr. Sarah Johnson"],
  patients: ["Patients", "Manage patient records and medical history"],
  appointments: ["Appointments", "Stay on top of today’s schedule"],
  doctors: ["Doctors", "Your clinical team and availability"],
  billing: ["Billing", "Track invoices, payments and revenue"],
  analytics: ["Analytics", "Insights to help your clinic perform better"],
  users: ["Users", "Manage accounts and access permissions"],
  specialties: ["Specialties", "Manage clinical specialties for doctors"],
};

const roleLabels: Record<Role, string> = {
  ADMIN: "Administrator",
  DOCTOR: "Doctor",
  STAFF: "Staff",
};

interface AdminHeaderProps {
  user: {
    name: string;
    email: string;
    role: Role;
  };
}

export default function AdminHeader({ user }: AdminHeaderProps) {
  const key = usePathname().split("/")[1] || "dashboard";
  const [title, defaultSubtitle] = titles[key] || titles.dashboard;
  const subtitle =
    key === "dashboard" ? `Welcome back, ${user.name}` : defaultSubtitle;
  const { toggleMobile } = useAdminSidebar();
  const initials = user.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return <header className="flex min-h-[78px] shrink-0 items-center justify-between gap-4 border-b border-slate-200/80 bg-white px-4 md:h-[86px] md:px-8">
    <div className="flex min-w-0 items-center gap-3">
      <button type="button" onClick={toggleMobile} aria-label="Open sidebar" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-slate-600 transition hover:bg-slate-100 md:hidden"><Menu className="h-5 w-5" /></button>
      <div className="min-w-0"><h1 className="truncate text-xl font-bold tracking-tight text-slate-900 md:text-[24px]">{title}</h1><p className="mt-1 truncate text-[12px] text-slate-500 md:text-[13px]">{subtitle}</p></div>
    </div>
    <div className="flex shrink-0 items-center gap-3 md:gap-5">
      <AdminHeaderSearch role={user.role} />
      <ThemeToggle />
      <div className="flex items-center gap-3 border-l border-slate-100 pl-3 md:pl-4"><div className="grid h-9 w-9 place-items-center rounded-xl bg-blue-100 text-xs font-bold text-blue-700 md:h-10 md:w-10 md:text-sm">{initials || "U"}</div><div className="hidden sm:block"><p className="max-w-40 truncate text-[13px] font-semibold text-slate-800">{user.name}</p><p className="text-[11px] text-slate-400">{roleLabels[user.role]}</p></div></div>
    </div>
  </header>;
}
