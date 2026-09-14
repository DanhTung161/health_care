import {
  formatDiagnosticDate,
  shortIdentifier,
} from "@/components/admin/DiagnosticUI";
import type {
  DiagnosticResultRevisionView,
  LabResultRevisionView,
} from "@/lib/diagnostic-client";

const interpretationTone = {
  NORMAL: "bg-emerald-50 text-emerald-700",
  HIGH: "bg-amber-50 text-amber-700",
  LOW: "bg-blue-50 text-blue-700",
  ABNORMAL: "bg-orange-50 text-orange-700",
  CRITICAL: "bg-rose-100 text-rose-800",
  UNKNOWN: "bg-slate-100 text-slate-600",
} as const;

function isLabRevision(
  revision: DiagnosticResultRevisionView,
): revision is LabResultRevisionView {
  return "analytes" in revision;
}

export default function ResultRevisionView({
  revision,
  heading,
  emphasis = false,
}: {
  revision: DiagnosticResultRevisionView;
  heading?: string;
  emphasis?: boolean;
}) {
  return (
    <section
      className={`rounded-xl border p-4 ${
        emphasis
          ? "border-blue-200 bg-blue-50/40"
          : "border-slate-100 bg-white"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h5 className="font-semibold text-slate-900">
            {heading ?? `Revision ${revision.version}`}
          </h5>
          <p className="mt-1 text-xs text-slate-500">
            Revision {revision.version} · Created {formatDiagnosticDate(revision.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {revision.isLatest && (
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
              Latest
            </span>
          )}
          {revision.isCurrentFinal && (
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
              Current Final
            </span>
          )}
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              revision.status === "FINAL"
                ? "bg-emerald-50 text-emerald-700"
                : "bg-amber-50 text-amber-700"
            }`}
          >
            {revision.status}
          </span>
        </div>
      </div>

      {revision.correctionReason && (
        <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-800">
          <span className="font-semibold">Correction reason:</span>{" "}
          {revision.correctionReason}
        </div>
      )}

      {isLabRevision(revision) ? (
        revision.analytes.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-slate-100 text-xs text-slate-400">
                <tr>
                  <th className="pb-2 font-medium">Code</th>
                  <th className="pb-2 font-medium">Analyte</th>
                  <th className="pb-2 font-medium">Value</th>
                  <th className="pb-2 font-medium">Unit</th>
                  <th className="pb-2 font-medium">Reference range</th>
                  <th className="pb-2 font-medium">Interpretation</th>
                </tr>
              </thead>
              <tbody>
                {revision.analytes.map((analyte, index) => (
                  <tr key={`${analyte.code ?? analyte.name}-${index}`} className="border-b border-slate-50 last:border-0">
                    <td className="py-3 text-slate-500">{analyte.code ?? "—"}</td>
                    <td className="py-3 font-medium text-slate-800">{analyte.name}</td>
                    <td className="py-3 font-semibold text-slate-900">{analyte.value}</td>
                    <td className="py-3 text-slate-500">{analyte.unit ?? "—"}</td>
                    <td className="py-3 text-slate-500">{analyte.referenceRange ?? "—"}</td>
                    <td className="py-3">
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${interpretationTone[analyte.interpretation]}`}>
                        {analyte.interpretation}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-4 rounded-lg bg-slate-50 px-3 py-4 text-sm text-slate-500">
            This draft has no analytes.
          </p>
        )
      ) : (
        <dl className="mt-4 space-y-4 text-sm">
          <div>
            <dt className="font-semibold text-slate-700">Findings</dt>
            <dd className="mt-1 whitespace-pre-wrap text-slate-600">{revision.findings || "—"}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-700">Impression</dt>
            <dd className="mt-1 whitespace-pre-wrap text-slate-600">{revision.impression || "—"}</dd>
          </div>
          {revision.technique && <div><dt className="font-semibold text-slate-700">Technique</dt><dd className="mt-1 whitespace-pre-wrap text-slate-600">{revision.technique}</dd></div>}
          {revision.comparison && <div><dt className="font-semibold text-slate-700">Comparison</dt><dd className="mt-1 whitespace-pre-wrap text-slate-600">{revision.comparison}</dd></div>}
          {revision.recommendation && <div><dt className="font-semibold text-slate-700">Recommendation</dt><dd className="mt-1 whitespace-pre-wrap text-slate-600">{revision.recommendation}</dd></div>}
        </dl>
      )}

      {isLabRevision(revision) && revision.clinicalComment && (
        <p className="mt-4 whitespace-pre-wrap text-sm text-slate-600">
          <span className="font-semibold text-slate-700">Clinical comment:</span>{" "}
          {revision.clinicalComment}
        </p>
      )}

      <dl className="mt-4 grid gap-3 border-t border-slate-100 pt-3 text-xs text-slate-500 sm:grid-cols-2 lg:grid-cols-4">
        <div><dt>Created by</dt><dd className="mt-1 font-mono" title={revision.createdBy}>{shortIdentifier(revision.createdBy)}</dd></div>
        <div><dt>Updated by</dt><dd className="mt-1 font-mono" title={revision.updatedBy}>{shortIdentifier(revision.updatedBy)}</dd></div>
        <div><dt>Finalized</dt><dd className="mt-1">{formatDiagnosticDate(revision.finalizedAt)}</dd></div>
        <div><dt>Finalized by</dt><dd className="mt-1 font-mono" title={revision.finalizedBy ?? undefined}>{revision.finalizedBy ? shortIdentifier(revision.finalizedBy) : "—"}</dd></div>
      </dl>
    </section>
  );
}
