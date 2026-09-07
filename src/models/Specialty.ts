import { Schema, Document, models, model } from 'mongoose';

export interface ISpecialty extends Document {
  name: string;
  description?: string;
}

const SpecialtySchema = new Schema<ISpecialty>({
  name: { type: String, required: true, unique: true },
  description: { type: String }
}, { timestamps: true });

export default models.Specialty || model<ISpecialty>('Specialty', SpecialtySchema);