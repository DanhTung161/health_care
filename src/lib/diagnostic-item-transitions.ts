import "server-only";

import mongoose, { type ClientSession } from "mongoose";
import type { AuthenticatedUser } from "@/lib/auth";
import {
  applyDiagnosticCancellationFinancials,
  assertDiagnosticItemFinanciallyExecutable,
  BillingChargeError,
  prepareDiagnosticBillingPersistence,
} from "@/lib/billing-charges";
import {
  calculateDiagnosticOrderStatus,
  canTransitionDiagnosticItemStatus,
  DIAGNOSTIC_CANCELLATION_REASON_MAX_LENGTH,
  isDiagnosticStatus,
  parseDiagnosticTimestampWithTimezone,
  type DiagnosticStatus,
} from "@/lib/diagnostic";
import { DiagnosticOrderError } from "@/lib/diagnostic-orders";
import type { Role } from "@/lib/roles";
import DiagnosticOrder from "@/models/DiagnosticOrder";
import DiagnosticOrderItem from "@/models/DiagnosticOrderItem";
import User from "@/models/User";

const TRANSITION_INPUT_FIELDS = new Set([
  "status",
  "scheduledAt",
  "cancellationReason",
]);

export type DiagnosticItemTransitionInput =
  | { status: "SCHEDULED"; scheduledAt: Date }
  | { status: "CANCELLED"; cancellationReason: string }
  | { status: "ORDERED" | "IN_PROGRESS" | "COMPLETED" };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function canRoleTransitionDiagnosticItem(
  role: Role,
  targetStatus: DiagnosticStatus,
): boolean {
  if (role === "DOCTOR") return true;

  return (
    (role === "ADMIN" || role === "STAFF") &&
    (targetStatus === "SCHEDULED" || targetStatus === "CANCELLED")
  );
}

export function parseDiagnosticItemTransitionInput(
  value: unknown,
):
  | { data: DiagnosticItemTransitionInput }
  | { error: DiagnosticOrderError } {
  if (!isPlainObject(value)) {
    return { error: new DiagnosticOrderError("Invalid request body", 400) };
  }

  const unsupportedField = Object.keys(value).find(
    (field) => !TRANSITION_INPUT_FIELDS.has(field),
  );
  if (unsupportedField) {
    return {
      error: new DiagnosticOrderError(
        `Unsupported transition field: ${unsupportedField}`,
        400,
      ),
    };
  }

  if (!isDiagnosticStatus(value.status)) {
    return {
      error: new DiagnosticOrderError("Invalid diagnostic item status", 400),
    };
  }

  if (value.status === "SCHEDULED") {
    const scheduledAt = parseDiagnosticTimestampWithTimezone(
      value.scheduledAt,
    );
    if (!scheduledAt) {
      return {
        error: new DiagnosticOrderError(
          "scheduledAt must be an ISO timestamp with an explicit timezone or offset",
          400,
        ),
      };
    }
    if (value.cancellationReason !== undefined) {
      return {
        error: new DiagnosticOrderError(
          "cancellationReason is only allowed when cancelling an item",
          400,
        ),
      };
    }
    return { data: { status: value.status, scheduledAt } };
  }

  if (value.status === "CANCELLED") {
    if (typeof value.cancellationReason !== "string") {
      return {
        error: new DiagnosticOrderError(
          "A cancellation reason is required",
          400,
        ),
      };
    }
    const cancellationReason = value.cancellationReason.trim();
    if (
      !cancellationReason ||
      cancellationReason.length > DIAGNOSTIC_CANCELLATION_REASON_MAX_LENGTH
    ) {
      return {
        error: new DiagnosticOrderError(
          "Cancellation reason must be between 1 and 1000 characters",
          400,
        ),
      };
    }
    if (value.scheduledAt !== undefined) {
      return {
        error: new DiagnosticOrderError(
          "scheduledAt is only allowed when scheduling an item",
          400,
        ),
      };
    }
    return {
      data: { status: value.status, cancellationReason },
    };
  }

  if (
    value.scheduledAt !== undefined ||
    value.cancellationReason !== undefined
  ) {
    return {
      error: new DiagnosticOrderError(
        "scheduledAt and cancellationReason are not allowed for this transition",
        400,
      ),
    };
  }

  return { data: { status: value.status } };
}

async function prepareDiagnosticPersistence(): Promise<void> {
  await Promise.all([
    DiagnosticOrder.init(),
    DiagnosticOrderItem.init(),
    prepareDiagnosticBillingPersistence(),
  ]);
}

async function inDiagnosticTransaction<T>(
  work: (session: ClientSession) => Promise<T>,
): Promise<T> {
  await prepareDiagnosticPersistence();
  const session = await mongoose.startSession();
  try {
    const result = await session.withTransaction(() => work(session));
    if (result === undefined) {
      throw new Error("Diagnostic transition did not return a result");
    }
    return result;
  } catch (error) {
    if (error instanceof BillingChargeError) {
      throw new DiagnosticOrderError(error.message, error.status);
    }
    throw error;
  } finally {
    await session.endSession();
  }
}

function isoOrNull(value: Date | null | undefined): string | null {
  return value?.toISOString() ?? null;
}

export async function transitionDiagnosticOrderItem(
  orderIdValue: string,
  itemIdValue: string,
  user: AuthenticatedUser,
  input: DiagnosticItemTransitionInput,
) {
  if (!mongoose.isValidObjectId(orderIdValue)) {
    throw new DiagnosticOrderError("Invalid diagnostic order id", 400);
  }
  if (!mongoose.isValidObjectId(itemIdValue)) {
    throw new DiagnosticOrderError("Invalid diagnostic order item id", 400);
  }
  if (!mongoose.isValidObjectId(user.id)) {
    throw new DiagnosticOrderError("Invalid authenticated user id", 400);
  }

  const orderId = new mongoose.Types.ObjectId(orderIdValue);
  const itemId = new mongoose.Types.ObjectId(itemIdValue);
  const actorId = new mongoose.Types.ObjectId(user.id);

  return inDiagnosticTransaction(async (session) => {
    const actor = await User.findOne({
      _id: actorId,
      role: user.role,
      isActive: true,
    })
      .select("_id role")
      .session(session);
    if (!actor) {
      throw new DiagnosticOrderError(
        "Forbidden: active diagnostic workflow actor not found",
        403,
      );
    }

    const order = await DiagnosticOrder.findById(orderId)
      .select("_id orderedByDoctorId type status updatedBy updatedAt")
      .session(session);
    if (!order) {
      throw new DiagnosticOrderError("Diagnostic order not found", 404);
    }

    if (!canRoleTransitionDiagnosticItem(user.role, input.status)) {
      throw new DiagnosticOrderError(
        "Forbidden: diagnostic item transition is not permitted for this role",
        403,
      );
    }
    if (
      user.role === "DOCTOR" &&
      !order.orderedByDoctorId.equals(actorId)
    ) {
      throw new DiagnosticOrderError(
        "Forbidden: doctors may only transition items in their own diagnostic orders",
        403,
      );
    }

    const item = await DiagnosticOrderItem.findById(itemId)
      .select(
        "_id diagnosticOrderId type status scheduledAt startedAt completedAt performedBy cancellationReason cancelledAt cancelledBy updatedBy createdAt updatedAt",
      )
      .session(session);
    if (!item || !item.diagnosticOrderId.equals(orderId)) {
      throw new DiagnosticOrderError(
        "Diagnostic order item not found for this order",
        404,
      );
    }
    if (item.type !== order.type) {
      throw new DiagnosticOrderError(
        "Diagnostic order item type does not match its parent order",
        409,
      );
    }
    if (!isDiagnosticStatus(item.status)) {
      throw new DiagnosticOrderError(
        "Diagnostic order item has an invalid stored status",
        409,
      );
    }
    if (!canTransitionDiagnosticItemStatus(item.status, input.status)) {
      throw new DiagnosticOrderError(
        `Cannot transition diagnostic item from ${item.status} to ${input.status}`,
        409,
      );
    }

    const now = new Date();
    if (
      input.status === "IN_PROGRESS" &&
      item.scheduledAt &&
      now.getTime() < item.scheduledAt.getTime()
    ) {
      throw new DiagnosticOrderError(
        "A scheduled diagnostic item cannot start before scheduledAt",
        409,
      );
    }
    if (
      input.status === "COMPLETED" &&
      (!item.startedAt || now.getTime() < item.startedAt.getTime())
    ) {
      throw new DiagnosticOrderError(
        "A diagnostic item cannot complete before it has started",
        409,
      );
    }

    if (input.status === "IN_PROGRESS") {
      await assertDiagnosticItemFinanciallyExecutable(item._id, session);
    } else if (input.status === "CANCELLED") {
      await applyDiagnosticCancellationFinancials(
        item._id,
        item.status,
        input.cancellationReason,
        actorId,
        session,
      );
    }

    const workflowUpdate: Record<string, unknown> = {
      status: input.status,
      updatedBy: actorId,
    };
    if (input.status === "SCHEDULED") {
      workflowUpdate.scheduledAt = input.scheduledAt;
    } else if (input.status === "IN_PROGRESS") {
      workflowUpdate.startedAt = now;
    } else if (input.status === "COMPLETED") {
      workflowUpdate.completedAt = now;
    } else if (input.status === "CANCELLED") {
      workflowUpdate.cancellationReason = input.cancellationReason;
      workflowUpdate.cancelledAt = now;
      workflowUpdate.cancelledBy = actorId;
    }

    const updatedItem = await DiagnosticOrderItem.findOneAndUpdate(
      {
        _id: itemId,
        diagnosticOrderId: orderId,
        status: item.status,
      },
      { $set: workflowUpdate },
      { returnDocument: "after", runValidators: true, session },
    );
    if (!updatedItem) {
      throw new DiagnosticOrderError(
        "Diagnostic item status changed before the transition could be saved",
        409,
      );
    }
    await updatedItem.validate();

    const siblingItems = await DiagnosticOrderItem.find({
      diagnosticOrderId: orderId,
    })
      .select("status")
      .session(session);
    if (!siblingItems.length) {
      throw new DiagnosticOrderError(
        "Diagnostic order has no items to aggregate",
        409,
      );
    }

    const siblingStatuses = siblingItems.map((sibling) => sibling.status);
    if (!siblingStatuses.every(isDiagnosticStatus)) {
      throw new DiagnosticOrderError(
        "Diagnostic order contains an invalid item status",
        409,
      );
    }
    const aggregateStatus = calculateDiagnosticOrderStatus(siblingStatuses);

    const updatedOrder = await DiagnosticOrder.findOneAndUpdate(
      { _id: orderId },
      { $set: { status: aggregateStatus, updatedBy: actorId } },
      { returnDocument: "after", runValidators: true, session },
    ).select("_id status updatedBy updatedAt");
    if (!updatedOrder) {
      throw new DiagnosticOrderError(
        "Diagnostic order changed before its aggregate status could be saved",
        409,
      );
    }

    return {
      order: {
        id: updatedOrder._id.toString(),
        status: updatedOrder.status,
        updatedBy: updatedOrder.updatedBy.toString(),
        updatedAt: updatedOrder.updatedAt.toISOString(),
      },
      item: {
        id: updatedItem._id.toString(),
        diagnosticOrderId: updatedItem.diagnosticOrderId.toString(),
        type: updatedItem.type,
        status: updatedItem.status,
        scheduledAt: isoOrNull(updatedItem.scheduledAt),
        startedAt: isoOrNull(updatedItem.startedAt),
        completedAt: isoOrNull(updatedItem.completedAt),
        performedBy: updatedItem.performedBy?.toString() ?? null,
        cancellationReason: updatedItem.cancellationReason ?? null,
        cancelledAt: isoOrNull(updatedItem.cancelledAt),
        cancelledBy: updatedItem.cancelledBy?.toString() ?? null,
        updatedBy: updatedItem.updatedBy.toString(),
        createdAt: updatedItem.createdAt.toISOString(),
        updatedAt: updatedItem.updatedAt.toISOString(),
      },
    };
  });
}
