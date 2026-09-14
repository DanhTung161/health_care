import mongoose, { Document, model, models, Schema } from "mongoose";
import "@/models/DiagnosticOrderItem";
import "@/models/User";

export interface IImagingResult extends Document {
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

const ImagingResultSchema = new Schema<IImagingResult>(
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

ImagingResultSchema.pre("validate", function validateVersionPointers() {
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

ImagingResultSchema.index(
  { diagnosticOrderItemId: 1 },
  { unique: true, name: "one_imaging_result_per_diagnostic_order_item" },
);

export default models.ImagingResult ||
  model<IImagingResult>("ImagingResult", ImagingResultSchema);
