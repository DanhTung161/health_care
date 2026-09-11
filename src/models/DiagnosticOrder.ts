import mongoose, { Document, model, models, Schema } from "mongoose";
import {
  DIAGNOSTIC_PRIORITIES,
  DIAGNOSTIC_STATUSES,
  DIAGNOSTIC_TYPES,
  type DiagnosticPriority,
  type DiagnosticStatus,
  type DiagnosticType,
} from "@/lib/diagnostic";
import "@/models/MedicalVisit";
import "@/models/Patient";
import "@/models/User";

export interface IDiagnosticOrder extends Document {
  medicalVisitId: mongoose.Types.ObjectId;
  patientId: mongoose.Types.ObjectId;
  orderedByDoctorId: mongoose.Types.ObjectId;
  orderedByDoctorName: string;
  type: DiagnosticType;
  clinicalIndication: string;
  priority: DiagnosticPriority;
  status: DiagnosticStatus;
  notes?: string;
  orderedAt: Date;
  updatedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const DiagnosticOrderSchema = new Schema<IDiagnosticOrder>(
  {
    medicalVisitId: {
      type: Schema.Types.ObjectId,
      ref: "MedicalVisit",
      required: true,
      immutable: true,
    },
    patientId: {
      type: Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
      immutable: true,
    },
    orderedByDoctorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },
    orderedByDoctorName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
      immutable: true,
    },
    type: {
      type: String,
      enum: DIAGNOSTIC_TYPES,
      required: true,
      immutable: true,
    },
    clinicalIndication: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2_000,
    },
    priority: {
      type: String,
      enum: DIAGNOSTIC_PRIORITIES,
      required: true,
      default: "ROUTINE",
    },
    status: {
      type: String,
      enum: DIAGNOSTIC_STATUSES,
      required: true,
      default: "ORDERED",
    },
    notes: { type: String, trim: true, maxlength: 2_000 },
    orderedAt: {
      type: Date,
      required: true,
      default: Date.now,
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

DiagnosticOrderSchema.index({ medicalVisitId: 1, orderedAt: -1 });
DiagnosticOrderSchema.index({ patientId: 1, orderedAt: -1 });
DiagnosticOrderSchema.index({ orderedByDoctorId: 1, orderedAt: -1 });
DiagnosticOrderSchema.index({ type: 1, status: 1, orderedAt: -1 });

export default models.DiagnosticOrder ||
  model<IDiagnosticOrder>("DiagnosticOrder", DiagnosticOrderSchema);
