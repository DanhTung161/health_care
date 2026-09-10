import type { ReactNode } from "react";
export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_5px_20px_rgba(15,23,42,0.03)] ${className}`}
    >
      {children}
    </section>
  );
}
export function PageIntro({
  title,
  action,
  actionSlot,
}: {
  title: string;
  action?: string;
  actionSlot?: ReactNode;
}) {
  return (
    <div className="mb-6 flex items-center justify-between">
      <div>
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">
          A clear overview of your clinic activity.
        </p>
      </div>
      {actionSlot ?? (action && (
        <button className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-200 hover:bg-blue-700">
          + {action}
        </button>
      ))}
    </div>
  );
}
export function Badge({
  children,
  tone = "green",
}: {
  children: ReactNode;
  tone?: "green" | "blue" | "amber" | "red";
}) {
  const colors = {
    green: "bg-emerald-50 text-emerald-600",
    blue: "bg-blue-50 text-blue-600",
    amber: "bg-amber-50 text-amber-600",
    red: "bg-rose-50 text-rose-600",
  };
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${colors[tone]}`}
    >
      {children}
    </span>
  );
}
