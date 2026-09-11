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

export interface IBillingLineItem {
  description: string;
  amount: number;
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
    description: { type: String, required: true, trim: true },
    amount: integerVnd,
  },
  { _id: false },
);

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

export default Billing;
