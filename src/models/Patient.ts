import mongoose, { Schema, Document, models, model } from 'mongoose';

export interface IMedicalRecord {
  visitDate: Date;
  doctorId: mongoose.Types.ObjectId;
  doctorName?: string;
  diagnosis: string;
  symptoms?: string;
  prescription?: {
    medicineName: string;
    dosage: string;
    frequency: string;
  }[];
  notes?: string;
}

export interface IPatient extends Document {
  fullName: string;
  phone: string;
  identityCard?: string;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  dateOfBirth?: Date;
  address?: string;
  medicalRecords: IMedicalRecord[];
}

const MedicalRecordSchema = new Schema<IMedicalRecord>({
  visitDate: { type: Date, default: Date.now },
  doctorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  doctorName: { type: String },
  diagnosis: { type: String, required: true },
  symptoms: { type: String },
  prescription: [{
    medicineName: { type: String, required: true },
    dosage: { type: String },
    frequency: { type: String }
  }],
  notes: { type: String }
});

const PatientSchema = new Schema<IPatient>({
  fullName: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  identityCard: { type: String },
  gender: { type: String, enum: ['MALE', 'FEMALE', 'OTHER'] },
  dateOfBirth: { type: Date },
  address: { type: String },
  medicalRecords: [MedicalRecordSchema]
}, { timestamps: true });

export default models.Patient || model<IPatient>('Patient', PatientSchema);