import type { DiagnosticStatus, DiagnosticType } from "@/lib/diagnostic";

const workflowTone: Record<DiagnosticStatus, string> = {
  ORDERED: "bg-slate-100 text-slate-600",
  SCHEDULED: "bg-blue-50 text-blue-700",
  IN_PROGRESS: "bg-amber-50 text-amber-700",
  COMPLETED: "bg-emerald-50 text-emerald-700",
  CANCELLED: "bg-rose-50 text-rose-700",
};

export function DiagnosticStatusBadge({ status }: { status: DiagnosticStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${workflowTone[status]}`}
    >
      {status.replace("_", " ")}
    </span>
  );
}

export function DiagnosticTypeBadge({ type }: { type: DiagnosticType }) {
  return (
    <span className="inline-flex rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700">
      {type}
    </span>
  );
}

export function ResultStateBadge({
  state,
}: {
  state: "NOT_LOADED" | "NONE" | "DRAFT" | "FINAL" | "CORRECTION_DRAFT";
}) {
  const styles = {
    NOT_LOADED: "bg-slate-100 text-slate-500",
    NONE: "bg-slate-100 text-slate-600",
    DRAFT: "bg-amber-50 text-amber-700",
    FINAL: "bg-emerald-50 text-emerald-700",
    CORRECTION_DRAFT: "bg-blue-50 text-blue-700",
  } as const;
  const labels = {
    NOT_LOADED: "Result not loaded",
    NONE: "No Result",
    DRAFT: "Draft",
    FINAL: "Final",
    CORRECTION_DRAFT: "Correction Draft",
  } as const;
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${styles[state]}`}
    >
      {labels[state]}
    </span>
  );
}

export function formatDiagnosticDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function shortIdentifier(value: string): string {
  return value.length > 14
    ? `${value.slice(0, 6)}…${value.slice(-6)}`
    : value;
}
