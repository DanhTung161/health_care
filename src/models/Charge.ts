import mongoose, { Document, model, models, Schema } from "mongoose";
import {
  BILLING_LINE_ITEM_CATEGORIES,
  type BillingLineItemCategory,
} from "@/models/Billing";
import "@/models/DiagnosticOrderItem";
import "@/models/User";

export const CHARGE_SOURCE_TYPES = ["DIAGNOSTIC_ORDER_ITEM"] as const;
export type ChargeSourceType = (typeof CHARGE_SOURCE_TYPES)[number];

export const CHARGE_STATUSES = [
  "ACTIVE",
  "VOID",
  "RECONCILIATION_REQUIRED",
] as const;
export type ChargeStatus = (typeof CHARGE_STATUSES)[number];

export interface ICharge extends Document {
  billingId: mongoose.Types.ObjectId;
  billingLineItemId: mongoose.Types.ObjectId;
  sourceType: ChargeSourceType;
  sourceId: mongoose.Types.ObjectId;
  category: BillingLineItemCategory;
  serviceCode: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  isCoveredByInsurance: boolean;
  status: ChargeStatus;
  createdBy: mongoose.Types.ObjectId;
  updatedBy: mongoose.Types.ObjectId;
  voidedBy?: mongoose.Types.ObjectId;
  voidedAt?: Date;
  voidReason?: string;
  reconciliationRequiredBy?: mongoose.Types.ObjectId;
  reconciliationRequiredAt?: Date;
  reconciliationReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const integerVnd = {
  type: Number,
  required: true,
  min: 0,
  validate: {
    validator: Number.isSafeInteger,
    message: "Charge amounts must be safe integer VND values",
  },
} as const;

const ChargeSchema = new Schema<ICharge>(
  {
    billingId: {
      type: Schema.Types.ObjectId,
      ref: "Billing",
      required: true,
      immutable: true,
    },
    billingLineItemId: {
      type: Schema.Types.ObjectId,
      required: true,
      immutable: true,
    },
    sourceType: {
      type: String,
      enum: CHARGE_SOURCE_TYPES,
      required: true,
      immutable: true,
    },
    sourceId: {
      type: Schema.Types.ObjectId,
      ref: "DiagnosticOrderItem",
      required: true,
      immutable: true,
    },
    category: {
      type: String,
      enum: BILLING_LINE_ITEM_CATEGORIES,
      required: true,
      immutable: true,
    },
    serviceCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 64,
      immutable: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
      immutable: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      immutable: true,
      validate: {
        validator: Number.isSafeInteger,
        message: "Charge quantity must be a safe integer",
      },
    },
    unitPrice: { ...integerVnd, immutable: true },
    amount: { ...integerVnd, immutable: true },
    isCoveredByInsurance: {
      type: Boolean,
      required: true,
      immutable: true,
    },
    status: {
      type: String,
      enum: CHARGE_STATUSES,
      required: true,
      default: "ACTIVE",
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
    voidedBy: { type: Schema.Types.ObjectId, ref: "User" },
    voidedAt: { type: Date },
    voidReason: { type: String, trim: true, maxlength: 1_000 },
    reconciliationRequiredBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    reconciliationRequiredAt: { type: Date },
    reconciliationReason: {
      type: String,
      trim: true,
      maxlength: 1_000,
    },
  },
  { timestamps: true },
);

ChargeSchema.pre("validate", function validateChargeState() {
  const amount = this.quantity * this.unitPrice;
  if (!Number.isSafeInteger(amount) || amount < 0 || amount !== this.amount) {
    this.invalidate(
      "amount",
      "Charge amount must equal quantity multiplied by unit price",
    );
  }

  if (
    this.status === "VOID" &&
    (!this.voidedBy || !this.voidedAt || !this.voidReason?.trim())
  ) {
    this.invalidate(
      "status",
      "Void charges require actor, timestamp, and reason audit fields",
    );
  }

  if (
    this.status === "RECONCILIATION_REQUIRED" &&
    (!this.reconciliationRequiredBy ||
      !this.reconciliationRequiredAt ||
      !this.reconciliationReason?.trim())
  ) {
    this.invalidate(
      "status",
      "Reconciliation-required charges require actor, timestamp, and reason audit fields",
    );
  }
});

ChargeSchema.index(
  { sourceType: 1, sourceId: 1 },
  { unique: true, name: "unique_charge_source" },
);
ChargeSchema.index(
  { billingId: 1, billingLineItemId: 1 },
  { unique: true, name: "unique_charge_billing_line" },
);
ChargeSchema.index({ status: 1, createdAt: -1 });

export default models.Charge || model<ICharge>("Charge", ChargeSchema);
