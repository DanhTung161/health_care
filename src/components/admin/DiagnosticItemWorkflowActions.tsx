"use client";

import { useState } from "react";
import DiagnosticCancellationDialog from "@/components/admin/DiagnosticCancellationDialog";
import DiagnosticScheduleDialog from "@/components/admin/DiagnosticScheduleDialog";
import {
  DiagnosticClientError,
  transitionDiagnosticItem,
  type DiagnosticItemTransitionPayload,
  type DiagnosticItemTransitionResult,
  type DiagnosticOrderItemView,
} from "@/lib/diagnostic-client";
import { getDiagnosticWorkflowActions } from "@/lib/diagnostic-workflow-ui";
import type { Role } from "@/lib/roles";

const STALE_TRANSITION_MESSAGE =
  "The diagnostic item changed since this page was loaded. Reload the latest state before continuing.";

function isStaleTransition(error: DiagnosticClientError): boolean {
  return (
    error.status === 409 &&
    (error.message.startsWith("Cannot transition diagnostic item from") ||
      error.message.includes("changed before"))
  );
}

export default function DiagnosticItemWorkflowActions({
  orderId,
  item,
  currentRole,
  isAssignedDoctor,
  onTransitionApplied,
  onReload,
}: {
  orderId: string;
  item: DiagnosticOrderItemView;
  currentRole: Role;
  isAssignedDoctor: boolean;
  onTransitionApplied: (result: DiagnosticItemTransitionResult) => void;
  onReload: () => Promise<void>;
}) {
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [hasStaleConflict, setHasStaleConflict] = useState(false);

  const actions = getDiagnosticWorkflowActions(
    currentRole,
    isAssignedDoctor,
    item.status,
  );

  async function performTransition(
    payload: DiagnosticItemTransitionPayload,
    success: string,
  ) {
    setIsMutating(true);
    setErrorMessage("");
    setSuccessMessage("");
    setHasStaleConflict(false);
    try {
      const result = await transitionDiagnosticItem(orderId, item.id, payload);
      onTransitionApplied(result);
      setIsScheduleOpen(false);
      setIsCancelOpen(false);
      setSuccessMessage(success);
    } catch (error) {
      if (error instanceof DiagnosticClientError) {
        const stale = isStaleTransition(error);
        setHasStaleConflict(stale);
        setErrorMessage(stale ? STALE_TRANSITION_MESSAGE : error.message);
        if (stale) {
          setIsScheduleOpen(false);
          setIsCancelOpen(false);
        }
      } else {
        setErrorMessage("Unable to update the diagnostic item workflow.");
      }
    } finally {
      setIsMutating(false);
    }
  }

  async function reloadLatest() {
    setIsMutating(true);
    setErrorMessage("");
    try {
      await onReload();
      setHasStaleConflict(false);
      setSuccessMessage("Latest diagnostic order state loaded.");
    } catch (error) {
      setErrorMessage(
        error instanceof DiagnosticClientError
          ? error.message
          : "Unable to reload the diagnostic order.",
      );
    } finally {
      setIsMutating(false);
    }
  }

  async function completeItem() {
    if (
      !window.confirm(
        "Complete this diagnostic item? This records service workflow completion but does not finalize the clinical Result.",
      )
    ) {
      return;
    }
    await performTransition(
      { status: "COMPLETED" },
      "Diagnostic item workflow completed. The clinical Result was not finalized automatically.",
    );
  }

  return (
    <section className="mt-4 border-t border-slate-100 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h5 className="text-sm font-semibold text-slate-800">Workflow actions</h5>
          <p className="mt-0.5 text-xs text-slate-500">
            Item workflow is independent from the clinical Result lifecycle.
          </p>
        </div>

        {actions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {actions.includes("SCHEDULE") && (
              <button
                type="button"
                onClick={() => {
                  setErrorMessage("");
                  setSuccessMessage("");
                  setIsScheduleOpen(true);
                }}
                disabled={isMutating}
                className="rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50"
              >
                Schedule
              </button>
            )}
            {actions.includes("START") && (
              <button
                type="button"
                onClick={() =>
                  void performTransition(
                    { status: "IN_PROGRESS" },
                    "Diagnostic item started.",
                  )
                }
                disabled={isMutating}
                className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isMutating
                  ? "Updating…"
                  : item.status === "ORDERED"
                    ? "Start now"
                    : "Start"}
              </button>
            )}
            {actions.includes("COMPLETE") && (
              <button
                type="button"
                onClick={() => void completeItem()}
                disabled={isMutating}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {isMutating ? "Updating…" : "Complete"}
              </button>
            )}
            {actions.includes("CANCEL") && (
              <button
                type="button"
                onClick={() => {
                  setErrorMessage("");
                  setSuccessMessage("");
                  setIsCancelOpen(true);
                }}
                disabled={isMutating}
                className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
              >
                Cancel item
              </button>
            )}
          </div>
        )}
      </div>

      {!actions.length && (
        <p className="mt-3 text-xs font-medium text-slate-500">
          {item.status === "COMPLETED"
            ? "Service workflow completed. Result finalization remains a separate action."
            : item.status === "CANCELLED"
              ? "Cancelled items are terminal and read-only."
              : "No workflow actions are available for this account."}
        </p>
      )}

      {errorMessage && !isScheduleOpen && !isCancelOpen && (
        <div className="mt-3 rounded-xl bg-rose-50 px-3 py-3 text-sm text-rose-700">
          <p role="alert">{errorMessage}</p>
          {hasStaleConflict && (
            <button
              type="button"
              onClick={() => void reloadLatest()}
              disabled={isMutating}
              className="mt-2 font-semibold underline disabled:opacity-50"
            >
              {isMutating ? "Reloading…" : "Reload latest state"}
            </button>
          )}
        </div>
      )}
      {successMessage && (
        <p
          role="status"
          className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
        >
          {successMessage}
        </p>
      )}

      {isScheduleOpen && (
        <DiagnosticScheduleDialog
          serviceName={item.serviceName}
          currentStatus={item.status}
          isSaving={isMutating}
          errorMessage={errorMessage}
          onSubmit={(scheduledAt) =>
            performTransition(
              { status: "SCHEDULED", scheduledAt },
              "Diagnostic item scheduled.",
            )
          }
          onClose={() => setIsScheduleOpen(false)}
        />
      )}

      {isCancelOpen && (
        <DiagnosticCancellationDialog
          serviceName={item.serviceName}
          isSaving={isMutating}
          errorMessage={errorMessage}
          onSubmit={(cancellationReason) =>
            performTransition(
              { status: "CANCELLED", cancellationReason },
              "Diagnostic item cancelled.",
            )
          }
          onClose={() => setIsCancelOpen(false)}
        />
      )}
    </section>
  );
}
