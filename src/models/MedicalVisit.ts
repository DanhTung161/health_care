import mongoose, { Document, model, models, Schema } from "mongoose";

export interface IMedicalVisit extends Document {
  patientId: mongoose.Types.ObjectId;
  doctorId: mongoose.Types.ObjectId;
  doctorName: string;
  visitDate: Date;
  diagnosis: string;
  symptoms?: string;
  prescription: {
    medicineName: string;
    dosage?: string;
    frequency?: string;
  }[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PrescriptionItemSchema = new Schema(
  {
    medicineName: { type: String, required: true },
    dosage: { type: String },
    frequency: { type: String },
  },
  { _id: false },
);

const MedicalVisitSchema = new Schema<IMedicalVisit>(
  {
    patientId: {
      type: Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
      immutable: true,
      index: true,
    },
    doctorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
      index: true,
    },
    doctorName: { type: String, required: true, immutable: true },
    visitDate: { type: Date, required: true, default: Date.now },
    diagnosis: { type: String, required: true },
    symptoms: { type: String },
    prescription: { type: [PrescriptionItemSchema], default: [] },
    notes: { type: String },
  },
  { timestamps: true },
);

MedicalVisitSchema.index({ patientId: 1, visitDate: -1, createdAt: -1 });

export default models.MedicalVisit ||
  model<IMedicalVisit>("MedicalVisit", MedicalVisitSchema);
