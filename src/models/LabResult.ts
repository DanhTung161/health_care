import mongoose, { Document, model, models, Schema } from "mongoose";
import "@/models/DiagnosticOrderItem";
import "@/models/User";

export interface ILabResult extends Document {
  diagnosticOrderItemId: mongoose.Types.ObjectId;
  latestRevisionVersion: number;
  currentFinalVersion?: number;
  createdBy: mongoose.Types.ObjectId;
  updatedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const revisionVersion = {
  type: Number,
  required: true,
  min: 1,
  validate: {
    validator: Number.isSafeInteger,
    message: "Result revision versions must be safe integers",
  },
} as const;

const LabResultSchema = new Schema<ILabResult>(
  {
    diagnosticOrderItemId: {
      type: Schema.Types.ObjectId,
      ref: "DiagnosticOrderItem",
      required: true,
      immutable: true,
    },
    latestRevisionVersion: { ...revisionVersion, default: 1 },
    currentFinalVersion: { ...revisionVersion, required: false },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

LabResultSchema.pre("validate", function validateVersionPointers() {
  if (
    this.currentFinalVersion !== undefined &&
    this.currentFinalVersion > this.latestRevisionVersion
  ) {
    this.invalidate(
      "currentFinalVersion",
      "The current final version cannot exceed the latest revision version",
    );
  }
});

LabResultSchema.index(
  { diagnosticOrderItemId: 1 },
  { unique: true, name: "one_lab_result_per_diagnostic_order_item" },
);

export default models.LabResult ||
  model<ILabResult>("LabResult", LabResultSchema);
