import mongoose, { Document, model, models, Schema } from "mongoose";
import {
  DIAGNOSTIC_RESULT_REVISION_STATUSES,
  LAB_RESULT_INTERPRETATIONS,
  type DiagnosticResultRevisionStatus,
  type LabResultInterpretation,
} from "@/lib/diagnostic-results";
import "@/models/LabResult";
import "@/models/User";

export interface ILabAnalyteResult {
  code?: string;
  name: string;
  value: string;
  unit?: string;
  referenceRange?: string;
  interpretation: LabResultInterpretation;
}

export interface ILabResultRevision extends Document {
  labResultId: mongoose.Types.ObjectId;
  version: number;
  status: DiagnosticResultRevisionStatus;
  analytes: ILabAnalyteResult[];
  clinicalComment?: string;
  correctsRevisionId?: mongoose.Types.ObjectId;
  correctionReason?: string;
  createdBy: mongoose.Types.ObjectId;
  updatedBy: mongoose.Types.ObjectId;
  finalizedBy?: mongoose.Types.ObjectId;
  finalizedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const LabAnalyteResultSchema = new Schema<ILabAnalyteResult>(
  {
    code: { type: String, trim: true, maxlength: 64 },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    value: { type: String, required: true, trim: true, maxlength: 500 },
    unit: { type: String, trim: true, maxlength: 100 },
    referenceRange: { type: String, trim: true, maxlength: 500 },
    interpretation: {
      type: String,
      enum: LAB_RESULT_INTERPRETATIONS,
      required: true,
      default: "UNKNOWN",
    },
  },
  { _id: false },
);

const LabResultRevisionSchema = new Schema<ILabResultRevision>(
  {
    labResultId: {
      type: Schema.Types.ObjectId,
      ref: "LabResult",
      required: true,
      immutable: true,
    },
    version: {
      type: Number,
      required: true,
      min: 1,
      immutable: true,
      validate: {
        validator: Number.isSafeInteger,
        message: "Result revision versions must be safe integers",
      },
    },
    status: {
      type: String,
      enum: DIAGNOSTIC_RESULT_REVISION_STATUSES,
      required: true,
      default: "DRAFT",
    },
    analytes: { type: [LabAnalyteResultSchema], required: true, default: [] },
    clinicalComment: { type: String, trim: true, maxlength: 5_000 },
    correctsRevisionId: {
      type: Schema.Types.ObjectId,
      ref: "LabResultRevision",
      immutable: true,
    },
    correctionReason: {
      type: String,
      trim: true,
      maxlength: 2_000,
      immutable: true,
    },
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
    finalizedBy: { type: Schema.Types.ObjectId, ref: "User" },
    finalizedAt: { type: Date },
  },
  { timestamps: true },
);

LabResultRevisionSchema.pre("validate", function validateRevisionAudit() {
  if (this.status === "FINAL") {
    if (!this.finalizedBy) {
      this.invalidate("finalizedBy", "Final results require finalizedBy");
    }
    if (!this.finalizedAt) {
      this.invalidate("finalizedAt", "Final results require finalizedAt");
    }
    if (!this.analytes.length) {
      this.invalidate("analytes", "Final Lab results require an analyte");
    }
  } else if (this.finalizedBy || this.finalizedAt) {
    this.invalidate(
      "status",
      "Draft results cannot contain finalization audit fields",
    );
  }

  if (this.version === 1) {
    if (this.correctsRevisionId || this.correctionReason) {
      this.invalidate(
        "version",
        "The initial result revision cannot contain correction metadata",
      );
    }
  } else {
    if (!this.correctsRevisionId) {
      this.invalidate(
        "correctsRevisionId",
        "Corrected result revisions require the prior revision reference",
      );
    }
    if (!this.correctionReason?.trim()) {
      this.invalidate(
        "correctionReason",
        "Corrected result revisions require a correction reason",
      );
    }
  }
});

LabResultRevisionSchema.index(
  { labResultId: 1, version: 1 },
  { unique: true, name: "unique_lab_result_revision_version" },
);
LabResultRevisionSchema.index({ status: 1, finalizedAt: -1 });

export default models.LabResultRevision ||
  model<ILabResultRevision>("LabResultRevision", LabResultRevisionSchema);
