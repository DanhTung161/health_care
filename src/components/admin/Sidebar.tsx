"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CalendarDays, ChevronLeft, ChevronRight, CreditCard, Grid2X2, LogOut, Settings, Stethoscope, UserRound, Users, X } from "lucide-react";
import { useAdminSidebar } from "@/context/AdminSidebarContext";

const items = [
  { label: "Dashboard", href: "/dashboard", icon: Grid2X2 },
  { label: "Patients", href: "/patients", icon: Users },
  { label: "Appointments", href: "/appointments", icon: CalendarDays },
  { label: "Doctors", href: "/doctors", icon: Stethoscope },
  { label: "Billing", href: "/billing", icon: CreditCard },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Users", href: "/users", icon: UserRound },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const { isCollapsed, isMobileOpen, toggleCollapsed, closeMobile } = useAdminSidebar();

  function handleLogout() {
    document.cookie = "healthnexus.session=; path=/; max-age=0";
    document.cookie = "healthnexus.role=; path=/; max-age=0";
    document.cookie = "better-auth.session_token=; path=/; max-age=0";
    window.location.assign("/login");
  }

  return <>
    {isMobileOpen && <button type="button" aria-label="Close sidebar" onClick={closeMobile} className="fixed inset-0 z-40 bg-black/50 md:hidden" />}
    <aside className={`fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col border-r border-slate-200/80 bg-white px-4 py-6 shadow-xl transition-all duration-300 md:relative md:z-auto md:shadow-none ${isMobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"} ${isCollapsed ? "md:w-[76px]" : "md:w-[238px]"}`}>
      <div className={`mb-10 flex items-center ${isCollapsed ? "md:justify-center" : "justify-between"}`}>
        <Link href="/dashboard" onClick={closeMobile} aria-label="HealthNexus dashboard" className="flex items-center gap-3 px-2 text-[17px] font-bold text-slate-900">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-200">✚</span>
          <span className={isCollapsed ? "md:hidden" : ""}>HealthNexus</span>
        </Link>
        <button type="button" onClick={closeMobile} aria-label="Close sidebar" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 md:hidden"><X className="h-5 w-5" /></button>
      </div>
      <nav className="space-y-1">
        {items.map(({ label, href, icon: Icon }) => { const active = pathname === href || pathname.startsWith(`${href}/`); return <Link key={href} href={href} onClick={closeMobile} title={isCollapsed ? label : undefined} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-[14px] font-medium transition-all duration-300 ${isCollapsed ? "md:justify-center" : ""} ${active ? "bg-blue-600 text-white shadow-md shadow-blue-200" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"}`}><Icon className="h-[19px] w-[19px] shrink-0" /> <span className={isCollapsed ? "md:hidden" : ""}>{label}</span></Link>; })}
      </nav>
      <div className="mt-auto space-y-1 border-t border-slate-100 pt-5">
        <Link href="/settings" onClick={closeMobile} title={isCollapsed ? "Settings" : undefined} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-[14px] font-medium text-slate-500 transition-all duration-300 hover:bg-slate-50 hover:text-slate-900 ${isCollapsed ? "md:justify-center" : ""}`}><Settings className="h-[19px] w-[19px] shrink-0" /><span className={isCollapsed ? "md:hidden" : ""}>Settings</span></Link>
        <button type="button" onClick={handleLogout} title={isCollapsed ? "Logout" : undefined} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-[14px] font-medium text-rose-500 transition-all duration-300 hover:bg-rose-50 ${isCollapsed ? "md:justify-center" : ""}`}><LogOut className="h-[19px] w-[19px] shrink-0" /><span className={isCollapsed ? "md:hidden" : ""}>Logout</span></button>
        <button type="button" onClick={toggleCollapsed} aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"} className="mt-3 hidden w-full items-center justify-center rounded-xl border border-slate-200 py-2 text-slate-500 transition hover:bg-slate-50 md:flex">{isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}</button>
      </div>
    </aside>
  </>;
}
