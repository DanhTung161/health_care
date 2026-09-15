import mongoose, { Document, model, models, Schema } from "mongoose";
import type { BillingLineItemCategory } from "@/models/Billing";
import {
  DIAGNOSTIC_TYPES,
  type DiagnosticType,
} from "@/lib/diagnostic";
import "@/models/User";

export const DIAGNOSTIC_SERVICE_CODE_PATTERN =
  /^[A-Z0-9]+(?:[-_.][A-Z0-9]+)*$/;

export const DIAGNOSTIC_BILLING_CATEGORIES = [
  "LAB",
  "XRAY",
  "ULTRASOUND",
] as const satisfies readonly BillingLineItemCategory[];

export type DiagnosticBillingCategory =
  (typeof DIAGNOSTIC_BILLING_CATEGORIES)[number];

export interface IDiagnosticService extends Document {
  serviceCode: string;
  serviceName: string;
  diagnosticType: DiagnosticType;
  billingCategory: DiagnosticBillingCategory;
  unitPrice: number;
  isCoveredByInsurance: boolean;
  isActive: boolean;
  createdBy: mongoose.Types.ObjectId;
  updatedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const DiagnosticServiceSchema = new Schema<IDiagnosticService>(
  {
    serviceCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 64,
      match: DIAGNOSTIC_SERVICE_CODE_PATTERN,
      immutable: true,
    },
    serviceName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    diagnosticType: {
      type: String,
      enum: DIAGNOSTIC_TYPES,
      required: true,
      immutable: true,
    },
    billingCategory: {
      type: String,
      enum: DIAGNOSTIC_BILLING_CATEGORIES,
      required: true,
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isSafeInteger,
        message: "Diagnostic service price must be a safe integer VND amount",
      },
    },
    isCoveredByInsurance: { type: Boolean, required: true },
    isActive: { type: Boolean, required: true, default: true, index: true },
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

DiagnosticServiceSchema.pre("validate", function validateCategoryMapping() {
  const validMapping =
    (this.diagnosticType === "LAB" && this.billingCategory === "LAB") ||
    (this.diagnosticType === "IMAGING" &&
      (this.billingCategory === "XRAY" ||
        this.billingCategory === "ULTRASOUND"));

  if (!validMapping) {
    this.invalidate(
      "billingCategory",
      "Billing category does not match the diagnostic service type",
    );
  }
});

DiagnosticServiceSchema.index(
  { serviceCode: 1 },
  { unique: true, name: "unique_diagnostic_service_code" },
);

export default models.DiagnosticService ||
  model<IDiagnosticService>("DiagnosticService", DiagnosticServiceSchema);
