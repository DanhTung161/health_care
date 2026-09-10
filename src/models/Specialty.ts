import mongoose, { Schema, Document, models, model } from 'mongoose';

export interface ISpecialty extends Document {
  name: string;
  description?: string;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const SpecialtySchema = new Schema<ISpecialty>({
  name: { type: String, required: true, unique: true },
  description: { type: String },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

export default models.Specialty || model<ISpecialty>('Specialty', SpecialtySchema);
