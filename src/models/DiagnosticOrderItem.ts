import mongoose, { Document, model, models, Schema } from "mongoose";
import {
  DIAGNOSTIC_STATUSES,
  DIAGNOSTIC_TYPES,
  type DiagnosticStatus,
  type DiagnosticType,
} from "@/lib/diagnostic";
import "@/models/DiagnosticOrder";
import "@/models/User";

export interface IDiagnosticOrderItem extends Document {
  diagnosticOrderId: mongoose.Types.ObjectId;
  type: DiagnosticType;
  serviceCode: string;
  serviceName: string;
  status: DiagnosticStatus;
  notes?: string;
  scheduledAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  performedBy?: mongoose.Types.ObjectId;
  cancellationReason?: string;
  cancelledAt?: Date;
  cancelledBy?: mongoose.Types.ObjectId;
  updatedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const DiagnosticOrderItemSchema = new Schema<IDiagnosticOrderItem>(
  {
    diagnosticOrderId: {
      type: Schema.Types.ObjectId,
      ref: "DiagnosticOrder",
      required: true,
      immutable: true,
    },
    type: {
      type: String,
      enum: DIAGNOSTIC_TYPES,
      required: true,
      immutable: true,
    },
    // These immutable values are historical snapshots. A future service-catalog
    // reference may be added without making old orders depend on mutable names.
    serviceCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 64,
      match: /^[A-Z0-9]+(?:[-_.][A-Z0-9]+)*$/,
      immutable: true,
    },
    serviceName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
      immutable: true,
    },
    status: {
      type: String,
      enum: DIAGNOSTIC_STATUSES,
      required: true,
      default: "ORDERED",
    },
    notes: { type: String, trim: true, maxlength: 2_000 },
    scheduledAt: { type: Date },
    startedAt: { type: Date },
    completedAt: { type: Date },
    performedBy: { type: Schema.Types.ObjectId, ref: "User" },
    cancellationReason: { type: String, trim: true, maxlength: 1_000 },
    cancelledAt: { type: Date },
    cancelledBy: { type: Schema.Types.ObjectId, ref: "User" },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

DiagnosticOrderItemSchema.pre("validate", function validateStatusAudit() {
  if (this.status === "SCHEDULED" && !this.scheduledAt) {
    this.invalidate("scheduledAt", "Scheduled diagnostics require scheduledAt");
  }
  if (this.status === "IN_PROGRESS" && !this.startedAt) {
    this.invalidate("startedAt", "In-progress diagnostics require startedAt");
  }
  if (this.status === "COMPLETED" && !this.completedAt) {
    this.invalidate("completedAt", "Completed diagnostics require completedAt");
  }
  if (this.status === "CANCELLED") {
    if (!this.cancelledAt) {
      this.invalidate("cancelledAt", "Cancelled diagnostics require cancelledAt");
    }
    if (!this.cancelledBy) {
      this.invalidate("cancelledBy", "Cancelled diagnostics require cancelledBy");
    }
    if (!this.cancellationReason?.trim()) {
      this.invalidate(
        "cancellationReason",
        "Cancelled diagnostics require a cancellation reason",
      );
    }
  }
  if (
    this.scheduledAt &&
    this.startedAt &&
    this.startedAt.getTime() < this.scheduledAt.getTime()
  ) {
    this.invalidate("startedAt", "startedAt cannot precede scheduledAt");
  }
  if (
    this.startedAt &&
    this.completedAt &&
    this.completedAt.getTime() < this.startedAt.getTime()
  ) {
    this.invalidate("completedAt", "completedAt cannot precede startedAt");
  }
});

DiagnosticOrderItemSchema.index({ diagnosticOrderId: 1, createdAt: 1 });
DiagnosticOrderItemSchema.index({ type: 1, status: 1, createdAt: -1 });
DiagnosticOrderItemSchema.index({ serviceCode: 1, createdAt: -1 });

export default models.DiagnosticOrderItem ||
  model<IDiagnosticOrderItem>(
    "DiagnosticOrderItem",
    DiagnosticOrderItemSchema,
  );
