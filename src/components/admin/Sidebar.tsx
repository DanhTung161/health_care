"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  ["Dashboard", "/dashboard", "grid"],
  ["Patients", "/patients", "users"],
  ["Appointments", "/appointments", "calendar"],
  ["Doctors", "/doctors", "doctor"],
  ["Billing", "/billing", "card"],
  ["Analytics", "/analytics", "chart"],
  ["Users", "/users", "user"],
] as const;
function Icon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    grid: "M4 4h5v5H4zM15 4h5v5h-5zM4 15h5v5H4zM15 15h5v5h-5z",
    users:
      "M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20m6-9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm5-5a3 3 0 0 1 0 6m3 8v-1.5a4 4 0 0 0-3-3.87",
    calendar: "M5 4v3m14-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13H4V6a1 1 0 0 1 1-1Z",
    doctor:
      "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0m-7-8v4l2 2",
    card: "M3 7h18v10H3zM3 11h18",
    chart: "M4 19V5m0 14h17M8 16l3-4 3 2 5-7",
    user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0",
    settings:
      "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm7-3.5 2-1.2-2-3.5-2.2.9a7.7 7.7 0 0 0-1.8-1L14.7 5h-5l-.3 2.2a7.7 7.7 0 0 0-1.8 1L5.4 7.3l-2 3.5 2 1.2v2.1l-2 1.2 2 3.5 2.2-.9c.5.4 1.1.7 1.8 1l.3 2.2h5l.3-2.2a7.7 7.7 0 0 0 1.8-1l2.2.9 2-3.5-2-1.2v-2.1Z",
  };
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[19px] w-[19px]"
    >
      <path d={paths[name]} />
    </svg>
  );
}
export default function AdminSidebar() {
  const pathname = usePathname();
  function handleLogout() {
    document.cookie = "healthnexus.session=; path=/; max-age=0";
    document.cookie = "healthnexus.role=; path=/; max-age=0";
    document.cookie = "better-auth.session_token=; path=/; max-age=0";
    window.location.assign("/login");
  }
  return (
    <aside className="flex w-[238px] shrink-0 flex-col border-r border-slate-200/80 bg-white px-4 py-6">
      <Link
        href="/dashboard"
        className="mb-10 flex items-center gap-3 px-2 text-[17px] font-bold text-slate-900"
      >
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-200">
          <span className="text-xl">✚</span>
        </span>
        HealthNexus
      </Link>
      <nav className="space-y-1">
        {items.map(([label, href, icon]) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-xl px-3 py-3 text-[14px] font-medium transition ${active ? "bg-blue-600 text-white shadow-md shadow-blue-200" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"}`}
            >
              <Icon name={icon} />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto space-y-1 border-t border-slate-100 pt-5">
        <Link
          href="/settings"
          className="flex items-center gap-3 rounded-xl px-3 py-3 text-[14px] font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-900"
        >
          <Icon name="settings" />
          Settings
        </Link>
        <Link
          href="/"
          onClick={handleLogout}
          className="flex items-center gap-3 rounded-xl px-3 py-3 text-[14px] font-medium text-rose-500 hover:bg-rose-50"
        >
          <span className="text-lg">↪</span>Logout
        </Link>
      </div>
    </aside>
  );
}
