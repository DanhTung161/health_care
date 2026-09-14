import mongoose, { Document, model, models, Schema } from "mongoose";
import {
  DIAGNOSTIC_RESULT_LIMITS,
  DIAGNOSTIC_RESULT_REVISION_STATUSES,
  type DiagnosticResultRevisionStatus,
} from "@/lib/diagnostic-results";
import "@/models/ImagingResult";
import "@/models/User";

export interface IImagingResultRevision extends Document {
  imagingResultId: mongoose.Types.ObjectId;
  version: number;
  status: DiagnosticResultRevisionStatus;
  findings: string;
  impression: string;
  technique?: string;
  comparison?: string;
  recommendation?: string;
  correctsRevisionId?: mongoose.Types.ObjectId;
  correctionReason?: string;
  createdBy: mongoose.Types.ObjectId;
  updatedBy: mongoose.Types.ObjectId;
  finalizedBy?: mongoose.Types.ObjectId;
  finalizedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ImagingResultRevisionSchema = new Schema<IImagingResultRevision>(
  {
    imagingResultId: {
      type: Schema.Types.ObjectId,
      ref: "ImagingResult",
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
    findings: {
      type: String,
      trim: true,
      maxlength: DIAGNOSTIC_RESULT_LIMITS.imagingFindings,
      default: "",
    },
    impression: {
      type: String,
      trim: true,
      maxlength: DIAGNOSTIC_RESULT_LIMITS.imagingImpression,
      default: "",
    },
    technique: {
      type: String,
      trim: true,
      maxlength: DIAGNOSTIC_RESULT_LIMITS.imagingOptionalSection,
    },
    comparison: {
      type: String,
      trim: true,
      maxlength: DIAGNOSTIC_RESULT_LIMITS.imagingOptionalSection,
    },
    recommendation: {
      type: String,
      trim: true,
      maxlength: DIAGNOSTIC_RESULT_LIMITS.imagingOptionalSection,
    },
    correctsRevisionId: {
      type: Schema.Types.ObjectId,
      ref: "ImagingResultRevision",
      immutable: true,
    },
    correctionReason: {
      type: String,
      trim: true,
      maxlength: DIAGNOSTIC_RESULT_LIMITS.correctionReason,
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

ImagingResultRevisionSchema.pre("validate", function validateRevisionAudit() {
  if (this.status === "FINAL") {
    if (!this.finalizedBy) {
      this.invalidate("finalizedBy", "Final results require finalizedBy");
    }
    if (!this.finalizedAt) {
      this.invalidate("finalizedAt", "Final results require finalizedAt");
    }
    if (!this.findings.trim()) {
      this.invalidate("findings", "Final Imaging results require findings");
    }
    if (!this.impression.trim()) {
      this.invalidate("impression", "Final Imaging results require impression");
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

ImagingResultRevisionSchema.index(
  { imagingResultId: 1, version: 1 },
  { unique: true, name: "unique_imaging_result_revision_version" },
);
ImagingResultRevisionSchema.index({ status: 1, finalizedAt: -1 });

export default models.ImagingResultRevision ||
  model<IImagingResultRevision>(
    "ImagingResultRevision",
    ImagingResultRevisionSchema,
  );
