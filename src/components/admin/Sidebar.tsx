"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, CalendarDays, ChevronLeft, ChevronRight, CreditCard, Grid2X2, LogOut, Stethoscope, Tags, UserRound, Users, X } from "lucide-react";
import { useAdminSidebar } from "@/context/AdminSidebarContext";
import { allowedRoutePrefixes, roleLandingPage, type Role } from "@/lib/roles";

const items = [
  { label: "Dashboard", href: "/dashboard", icon: Grid2X2 },
  { label: "Patients", href: "/patients", icon: Users },
  { label: "Appointments", href: "/appointments", icon: CalendarDays },
  { label: "Doctors", href: "/doctors", icon: Stethoscope },
  { label: "Billing", href: "/billing", icon: CreditCard },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Users", href: "/users", icon: UserRound },
  { label: "Specialties", href: "/specialties", icon: Tags },
];

function canSeeNavigationItem(role: Role, href: string): boolean {
  if (role === "ADMIN") {
    return true;
  }

  return allowedRoutePrefixes[role].some(
    (routePrefix) => href === routePrefix || href.startsWith(`${routePrefix}/`),
  );
}

export default function AdminSidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const { isCollapsed, isMobileOpen, toggleCollapsed, closeMobile } = useAdminSidebar();
  const router = useRouter();

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  const visibleItems = items.filter(({ href }) =>
    canSeeNavigationItem(role, href),
  );

  return <>
    {isMobileOpen && <button type="button" aria-label="Close sidebar" onClick={(e) => {
      e.stopPropagation();
      closeMobile();
    }} className="fixed inset-0 z-40 bg-black/50 md:hidden" />}
    <aside
  onClick={isCollapsed ? toggleCollapsed : undefined}
  className={`fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col border-r border-slate-200/80 bg-white px-4 py-6 shadow-xl transition-all duration-300 md:relative md:z-auto md:shadow-none ${isMobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"} ${isCollapsed ? "md:w-[76px]" : "md:w-[238px]"} ${isCollapsed ? "cursor-pointer" : ""}`}
>
      <div className="mb-10 flex items-center justify-between w-full">
        <div className="flex items-center">
          <Link href={roleLandingPage[role]} onClick={(e) => {
            e.stopPropagation();
            closeMobile();
          }} aria-label="BigMedix dashboard" className="flex items-center px-2">
            {isCollapsed ? (
              <Image
                src="/brand/bigmedix-icon.svg"
                alt="BigMedix"
                width={36}
                height={36}
                unoptimized
                className="h-9 w-9 shrink-0"
              />
            ) : (
              <Image
                src="/brand/bigmedix-logo.svg"
                alt="BigMedix"
                width={199}
                height={42}
                unoptimized
                className="h-auto w-[148px]"
              />
            )}
          </Link>
          {/* Desktop toggle button */}
          <button type="button" onClick={(e) => {
            e.stopPropagation();
            toggleCollapsed();
          }} aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"} className={isCollapsed ? "hidden" : "md:flex items-center justify-center rounded border border-slate-200 text-slate-500 transition hover:bg-slate-50 ml-3"}>
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
        <button type="button" onClick={(e) => {
          e.stopPropagation();
          closeMobile();
        }} aria-label="Close sidebar" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 md:hidden"><X className="h-5 w-5" /></button>
      </div>
      <nav className="space-y-1">
        {visibleItems.map(({ label, href, icon: Icon }) => { const active = pathname === href || pathname.startsWith(`${href}/`); return <Link key={href} href={href} onClick={(e) => {
      e.stopPropagation();
      closeMobile();
    }} title={isCollapsed ? label : undefined} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-[14px] font-medium transition-all duration-300 ${isCollapsed ? "md:justify-center" : ""} ${active ? "bg-blue-600 text-white shadow-md shadow-blue-200" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"}`}><Icon className="h-[19px] w-[19px] shrink-0" /> <span className={isCollapsed ? "md:hidden" : ""}>{label}</span></Link>; })}
      </nav>
      <div className="mt-auto space-y-1 border-t border-slate-100 pt-5">
        <button type="button" onClick={(e) => {
      e.stopPropagation();
      handleLogout();
    }} title={isCollapsed ? "Logout" : undefined} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-[14px] font-medium text-rose-500 transition-all duration-300 hover:bg-rose-50 ${isCollapsed ? "md:justify-center" : ""}`}><LogOut className="h-[19px] w-[19px] shrink-0" /><span className={isCollapsed ? "md:hidden" : ""}>Logout</span></button>
        <button type="button" onClick={toggleCollapsed} aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"} className="mt-3 hidden">{isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}</button>
      </div>
    </aside>
  </>;
}
