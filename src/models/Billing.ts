import mongoose, { Document, model, models, Schema } from "mongoose";
import "@/models/Appointment";
import "@/models/Patient";
import "@/models/User";

export const PAYMENT_STATUSES = [
  "UNPAID",
  "PARTIALLY_PAID",
  "PAID",
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const BILLING_LINE_ITEM_CATEGORIES = [
  "CONSULTATION",
  "LAB",
  "XRAY",
  "ULTRASOUND",
  "MEDICATION",
  "OTHER",
] as const;

export type BillingLineItemCategory =
  (typeof BILLING_LINE_ITEM_CATEGORIES)[number];

export const BILLING_LINE_ITEM_PAYMENT_STATUSES = [
  "PENDING_PAYMENT",
  "PAID",
] as const;

export type BillingLineItemPaymentStatus =
  (typeof BILLING_LINE_ITEM_PAYMENT_STATUSES)[number];

export interface IBillingLineItem {
  _id: mongoose.Types.ObjectId;
  category: BillingLineItemCategory;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  isCoveredByInsurance: boolean;
  paymentStatus: BillingLineItemPaymentStatus;
  addedBy: mongoose.Types.ObjectId;
  createdAt: Date;
}

export interface IBilling extends Document {
  appointmentId: mongoose.Types.ObjectId;
  patientId: mongoose.Types.ObjectId;
  invoiceNo: string;
  lookupCode: string;
  lineItems: IBillingLineItem[];
  subtotal: number;
  insurancePaid: number;
  vatAmount: number;
  totalPatientPayable: number;
  amountPaid: number;
  balanceDue: number;
  paymentStatus: PaymentStatus;
  updatedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const integerVnd = {
  type: Number,
  required: true,
  min: 0,
  validate: {
    validator: Number.isSafeInteger,
    message: "VND amounts must be safe integers",
  },
} as const;

const BillingLineItemSchema = new Schema<IBillingLineItem>(
  {
    _id: { type: Schema.Types.ObjectId, auto: true },
    category: {
      type: String,
      enum: BILLING_LINE_ITEM_CATEGORIES,
      required: true,
    },
    description: { type: String, required: true, trim: true },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isSafeInteger,
        message: "Quantity must be a safe integer",
      },
    },
    unitPrice: integerVnd,
    amount: integerVnd,
    isCoveredByInsurance: { type: Boolean, required: true },
    paymentStatus: {
      type: String,
      enum: BILLING_LINE_ITEM_PAYMENT_STATUSES,
      required: true,
      default: "PENDING_PAYMENT",
    },
    addedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },
    createdAt: { type: Date, required: true, default: Date.now, immutable: true },
  },
);

BillingLineItemSchema.pre("validate", function calculateLineItemAmount() {
  const amount = this.quantity * this.unitPrice;
  if (Number.isSafeInteger(amount) && amount >= 0) {
    this.amount = amount;
    return;
  }
  this.invalidate(
    "amount",
    "Quantity and unit price must produce a safe integer VND amount",
  );
});

const BillingSchema = new Schema<IBilling>(
  {
    appointmentId: {
      type: Schema.Types.ObjectId,
      ref: "Appointment",
      required: true,
      unique: true,
    },
    patientId: {
      type: Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
      index: true,
    },
    invoiceNo: { type: String, required: true, unique: true, trim: true },
    lookupCode: { type: String, required: true, unique: true, trim: true },
    lineItems: {
      type: [BillingLineItemSchema],
      required: true,
      validate: {
        validator: (items: IBillingLineItem[]) => items.length > 0,
        message: "A billing record must contain at least one line item",
      },
    },
    subtotal: integerVnd,
    insurancePaid: integerVnd,
    vatAmount: integerVnd,
    totalPatientPayable: integerVnd,
    amountPaid: integerVnd,
    balanceDue: integerVnd,
    paymentStatus: {
      type: String,
      enum: PAYMENT_STATUSES,
      required: true,
      default: "UNPAID",
    },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

const Billing = models.Billing || model<IBilling>("Billing", BillingSchema);

// Next.js development reloads can reuse a model compiled before these embedded
// service-order fields existed. Register missing paths on that cached schema so
// strict mode does not discard them until the dev server is restarted.
const cachedLineItemsPath = Billing.schema.path("lineItems");
if (cachedLineItemsPath && "schema" in cachedLineItemsPath) {
  const cachedLineItemSchema = (
    cachedLineItemsPath as typeof cachedLineItemsPath & { schema: Schema }
  ).schema;
  if (!cachedLineItemSchema.path("_id")) {
    cachedLineItemSchema.add({
      _id: { type: Schema.Types.ObjectId, auto: true },
    });
  }
  if (!cachedLineItemSchema.path("category")) {
    cachedLineItemSchema.add({
      category: {
        type: String,
        enum: BILLING_LINE_ITEM_CATEGORIES,
        required: true,
      },
    });
  }
  if (!cachedLineItemSchema.path("quantity")) {
    cachedLineItemSchema.add({
      quantity: {
        type: Number,
        required: true,
        min: 1,
        validate: {
          validator: Number.isSafeInteger,
          message: "Quantity must be a safe integer",
        },
      },
    });
  }
  if (!cachedLineItemSchema.path("unitPrice")) {
    cachedLineItemSchema.add({ unitPrice: integerVnd });
  }
  if (!cachedLineItemSchema.path("isCoveredByInsurance")) {
    cachedLineItemSchema.add({
      isCoveredByInsurance: { type: Boolean, required: true },
    });
  }
  if (!cachedLineItemSchema.path("paymentStatus")) {
    cachedLineItemSchema.add({
      paymentStatus: {
        type: String,
        enum: BILLING_LINE_ITEM_PAYMENT_STATUSES,
        required: true,
      },
    });
  }
  if (!cachedLineItemSchema.path("paymentStatus")) {
    cachedLineItemSchema.add({
      paymentStatus: {
        type: String,
        enum: BILLING_LINE_ITEM_PAYMENT_STATUSES,
        required: true,
        default: "PENDING_PAYMENT",
      },
    });
  }
  if (!cachedLineItemSchema.path("addedBy")) {
    cachedLineItemSchema.add({
      addedBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
        immutable: true,
      },
    });
  }
  if (!cachedLineItemSchema.path("createdAt")) {
    cachedLineItemSchema.add({
      createdAt: {
        type: Date,
        required: true,
        default: Date.now,
        immutable: true,
      },
    });
  }
}

export default Billing;
