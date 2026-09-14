"use client";

import { useState } from "react";
import ImagingResultEditor from "@/components/admin/ImagingResultEditor";
import LabResultEditor from "@/components/admin/LabResultEditor";
import ResultCorrectionDialog from "@/components/admin/ResultCorrectionDialog";
import ResultHistory from "@/components/admin/ResultHistory";
import ResultRevisionView from "@/components/admin/ResultRevisionView";
import { ResultStateBadge } from "@/components/admin/DiagnosticUI";
import {
  createDiagnosticResultCorrection,
  createDiagnosticResultDraft,
  DiagnosticClientError,
  fetchDiagnosticResult,
  finalizeDiagnosticResultDraft,
  saveDiagnosticResultDraft,
  type DiagnosticDraftPayload,
  type DiagnosticOrderItemView,
  type DiagnosticResultView,
  type ImagingDraftPayload,
  type ImagingResultRevisionView,
  type LabDraftPayload,
  type LabResultRevisionView,
} from "@/lib/diagnostic-client";

type LoadState = "idle" | "loading" | "missing" | "ready" | "error";

function resultState(view: DiagnosticResultView | null, loadState: LoadState) {
  if (loadState === "idle" || loadState === "loading" || loadState === "error") {
    return "NOT_LOADED" as const;
  }
  if (!view || loadState === "missing") return "NONE" as const;
  if (
    view.latestRevision.status === "DRAFT" &&
    view.result.currentFinalVersion !== null &&
    view.result.latestRevisionVersion !== view.result.currentFinalVersion
  ) {
    return "CORRECTION_DRAFT" as const;
  }
  return view.latestRevision.status;
}

function finalRequirementsMet(view: DiagnosticResultView): boolean {
  const revision = view.latestRevision;
  if ("analytes" in revision) return revision.analytes.length > 0;
  return Boolean(revision.findings.trim() && revision.impression.trim());
}

function staleMessage(error: DiagnosticClientError): string {
  return error.status === 409
    ? "Result changed since you opened it. Your local values are preserved; reload the latest version before continuing."
    : error.message;
}

export default function DiagnosticResultPanel({
  orderId,
  item,
  canMutate,
}: {
  orderId: string;
  item: DiagnosticOrderItemView;
  canMutate: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [view, setView] = useState<DiagnosticResultView | null>(null);
  const [etag, setEtag] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [isCorrectionOpen, setIsCorrectionOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [hasConflict, setHasConflict] = useState(false);
  const [historyVersion, setHistoryVersion] = useState(0);

  const state = resultState(view, loadState);
  const effectiveItemStatus = view?.item.status ?? item.status;
  const itemAllowsDraft =
    effectiveItemStatus === "IN_PROGRESS" || effectiveItemStatus === "COMPLETED";
  const canCreate = canMutate && itemAllowsDraft && loadState === "missing";
  const canEdit =
    canMutate &&
    itemAllowsDraft &&
    loadState === "ready" &&
    view?.latestRevision.status === "DRAFT";
  const canFinalize =
    canMutate &&
    effectiveItemStatus === "COMPLETED" &&
    loadState === "ready" &&
    view?.latestRevision.status === "DRAFT";
  const canCorrect =
    canMutate &&
    effectiveItemStatus === "COMPLETED" &&
    loadState === "ready" &&
    view?.latestRevision.status === "FINAL" &&
    view.result.currentFinalVersion === view.result.latestRevisionVersion;

  function acceptResult(result: { data: DiagnosticResultView; etag: string }) {
    setView(result.data);
    setEtag(result.etag);
    setLoadState("ready");
    setHasConflict(false);
    setErrorMessage("");
    setHistoryVersion((current) => current + 1);
  }

  async function loadResult(confirmDiscard = false) {
    if (
      confirmDiscard &&
      isEditing &&
      !window.confirm("Reloading will discard the unsaved values in this editor. Continue?")
    ) {
      return;
    }
    if (confirmDiscard) setIsEditing(false);
    setLoadState("loading");
    setErrorMessage("");
    setSuccessMessage("");
    setHasConflict(false);
    setEtag(null);
    try {
      acceptResult(await fetchDiagnosticResult(orderId, item.id));
    } catch (error) {
      if (
        error instanceof DiagnosticClientError &&
        error.status === 404 &&
        error.message === "Result not found"
      ) {
        setView(null);
        setLoadState("missing");
        return;
      }
      setLoadState("error");
      setErrorMessage(
        error instanceof DiagnosticClientError
          ? error.message
          : "Unable to load this Result.",
      );
    }
  }

  function togglePanel() {
    const next = !isOpen;
    setIsOpen(next);
    if (next && loadState === "idle") void loadResult();
  }

  async function saveDraft(payload: DiagnosticDraftPayload) {
    setIsMutating(true);
    setErrorMessage("");
    setSuccessMessage("");
    setHasConflict(false);
    try {
      const result =
        loadState === "missing"
          ? await createDiagnosticResultDraft(orderId, item.id, payload)
          : etag
            ? await saveDiagnosticResultDraft(orderId, item.id, payload, etag)
            : null;
      if (!result) {
        setErrorMessage("Reload this Result before saving.");
        return;
      }
      acceptResult(result);
      setIsEditing(false);
      setSuccessMessage(loadState === "missing" ? "Result draft created." : "Result draft saved.");
    } catch (error) {
      if (error instanceof DiagnosticClientError) {
        setHasConflict(error.status === 409);
        setErrorMessage(staleMessage(error));
      } else {
        setErrorMessage("Unable to save the Result draft.");
      }
    } finally {
      setIsMutating(false);
    }
  }

  async function finalizeResult() {
    if (!view || !etag || !canFinalize) return;
    if (!finalRequirementsMet(view)) {
      setErrorMessage(
        item.type === "LAB"
          ? "Add at least one analyte before finalization."
          : "Findings and impression are required before finalization.",
      );
      return;
    }
    if (
      !window.confirm(
        "Finalize this clinical Result? This revision will become read-only clinical history. Future changes require a correction.",
      )
    ) {
      return;
    }
    setIsMutating(true);
    setErrorMessage("");
    setSuccessMessage("");
    setHasConflict(false);
    try {
      acceptResult(await finalizeDiagnosticResultDraft(orderId, item.id, etag));
      setSuccessMessage("Result finalized. This revision is now read-only.");
    } catch (error) {
      if (error instanceof DiagnosticClientError) {
        setHasConflict(error.status === 409);
        setErrorMessage(staleMessage(error));
      } else {
        setErrorMessage("Unable to finalize the Result.");
      }
    } finally {
      setIsMutating(false);
    }
  }

  async function startCorrection(correctionReason: string) {
    setIsMutating(true);
    setErrorMessage("");
    setSuccessMessage("");
    setHasConflict(false);
    try {
      acceptResult(
        await createDiagnosticResultCorrection(
          orderId,
          item.id,
          correctionReason,
        ),
      );
      setIsCorrectionOpen(false);
      setSuccessMessage(
        "Correction draft created. The previous Final remains clinically effective until this draft is finalized.",
      );
    } catch (error) {
      if (error instanceof DiagnosticClientError) {
        setHasConflict(error.status === 409);
        setErrorMessage(staleMessage(error));
      } else {
        setErrorMessage("Unable to start the correction.");
      }
    } finally {
      setIsMutating(false);
    }
  }

  const editorRevision = view?.latestRevision.status === "DRAFT"
    ? view.latestRevision
    : undefined;

  return (
    <section className="mt-4 rounded-xl border border-slate-200 bg-slate-50/60">
      <button
        type="button"
        onClick={togglePanel}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        aria-expanded={isOpen}
      >
        <span>
          <span className="block text-sm font-semibold text-slate-800">Clinical Result</span>
          <span className="mt-0.5 block text-xs text-slate-500">
            Loaded only when this panel is opened.
          </span>
        </span>
        <span className="flex items-center gap-3">
          <ResultStateBadge state={state} />
          <span className="text-xs font-semibold text-blue-600">{isOpen ? "Close" : "Open"}</span>
        </span>
      </button>

      {isOpen && (
        <div className="border-t border-slate-200 bg-white p-4">
          {loadState === "loading" && (
            <p role="status" className="py-8 text-center text-sm text-slate-500">
              Loading Result…
            </p>
          )}

          {errorMessage && !isEditing && (
            <div className="mb-4 rounded-xl bg-rose-50 px-3 py-3 text-sm text-rose-700">
              <p role="alert">{errorMessage}</p>
              {(hasConflict || loadState === "error") && (
                <button
                  type="button"
                  onClick={() => void loadResult()}
                  className="mt-2 font-semibold underline"
                >
                  Reload latest Result
                </button>
              )}
            </div>
          )}
          {successMessage && (
            <p role="status" className="mb-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {successMessage}
            </p>
          )}

          {loadState === "missing" && (
            <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center">
              <p className="font-semibold text-slate-800">No Result</p>
              <p className="mt-1 text-sm text-slate-500">
                No clinical Result draft has been entered for this item.
              </p>
              {canCreate && (
                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage("");
                    setIsEditing(true);
                  }}
                  className="mt-4 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  Create {item.type === "LAB" ? "Lab" : "Imaging"} draft
                </button>
              )}
              {!canCreate && (
                <p className="mt-3 text-xs font-medium text-slate-500">
                  {canMutate
                    ? "Result creation is unavailable in this item state."
                    : "Read-only access. Clinical mutations are limited to the assigned Doctor."}
                </p>
              )}
            </div>
          )}

          {loadState === "ready" && view && (
            <>
              {state === "CORRECTION_DRAFT" && view.currentFinalRevision ? (
                <div className="space-y-4">
                  <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                    The Current Final below remains clinically effective. The latest revision is an unfinalized correction draft.
                  </div>
                  <ResultRevisionView
                    revision={view.currentFinalRevision}
                    heading={`Current Final · Revision ${view.currentFinalRevision.version}`}
                    emphasis
                  />
                  <ResultRevisionView
                    revision={view.latestRevision}
                    heading={`Correction Draft · Revision ${view.latestRevision.version}`}
                  />
                </div>
              ) : (
                <ResultRevisionView revision={view.latestRevision} />
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMessage("");
                      setHasConflict(false);
                      setIsEditing(true);
                    }}
                    disabled={isMutating}
                    className="rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-50 disabled:opacity-50"
                  >
                    {state === "CORRECTION_DRAFT" ? "Edit correction" : "Edit draft"}
                  </button>
                )}
                {canFinalize && (
                  <button
                    type="button"
                    onClick={() => void finalizeResult()}
                    disabled={isMutating || !finalRequirementsMet(view)}
                    className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                    title={!finalRequirementsMet(view) ? "Complete the required clinical content first" : undefined}
                  >
                    {isMutating
                      ? "Finalizing…"
                      : state === "CORRECTION_DRAFT"
                        ? "Finalize correction"
                        : "Finalize Result"}
                  </button>
                )}
                {canCorrect && (
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMessage("");
                      setIsCorrectionOpen(true);
                    }}
                    disabled={isMutating}
                    className="rounded-lg border border-amber-200 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                  >
                    Start correction
                  </button>
                )}
                {effectiveItemStatus === "CANCELLED" && (
                  <span className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                    Cancelled item · Result is read-only
                  </span>
                )}
              </div>

              {canFinalize && !finalRequirementsMet(view) && (
                <p className="mt-3 text-xs font-medium text-amber-700">
                  {item.type === "LAB"
                    ? "Add at least one analyte before this draft can be finalized."
                    : "Enter both findings and impression before this draft can be finalized."}
                </p>
              )}

              <ResultHistory
                orderId={orderId}
                itemId={item.id}
                refreshVersion={historyVersion}
              />
            </>
          )}
        </div>
      )}

      {isEditing && item.type === "LAB" && (
        <LabResultEditor
          revision={
            editorRevision && "analytes" in editorRevision
              ? (editorRevision as LabResultRevisionView)
              : undefined
          }
          isSaving={isMutating}
          errorMessage={errorMessage}
          onSave={(payload: LabDraftPayload) => saveDraft(payload)}
          onCancel={() => setIsEditing(false)}
        />
      )}
      {isEditing && item.type === "IMAGING" && (
        <ImagingResultEditor
          revision={
            editorRevision && "findings" in editorRevision
              ? (editorRevision as ImagingResultRevisionView)
              : undefined
          }
          isSaving={isMutating}
          errorMessage={errorMessage}
          onSave={(payload: ImagingDraftPayload) => saveDraft(payload)}
          onCancel={() => setIsEditing(false)}
        />
      )}

      {isCorrectionOpen && (
        <ResultCorrectionDialog
          itemId={item.id}
          isSaving={isMutating}
          errorMessage={errorMessage}
          onSubmit={startCorrection}
          onClose={() => setIsCorrectionOpen(false)}
        />
      )}

      {isEditing && hasConflict && (
        <button
          type="button"
          onClick={() => void loadResult(true)}
          className="fixed bottom-5 right-5 z-[80] rounded-xl bg-rose-700 px-4 py-3 text-sm font-semibold text-white shadow-xl"
        >
          Reload latest (discard local changes)
        </button>
      )}
    </section>
  );
}
