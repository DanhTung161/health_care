import mongoose, { Schema, Document, models, model } from 'mongoose';
import { USER_ROLES, type Role } from '@/lib/roles';

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: Role;
  phone?: string;
  specialtyId?: mongoose.Types.ObjectId;
  biography?: string;
  workingSchedule?: {
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    maxPatientsPerSlot: number;
  }[];
  isActive: boolean;
}

const UserSchema = new Schema<IUser>({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: USER_ROLES, default: 'STAFF' },
  phone: { type: String },
  specialtyId: { type: Schema.Types.ObjectId, ref: 'Specialty' },
  biography: { type: String },
  workingSchedule: [{
    dayOfWeek: { type: Number, min: 0, max: 6 },
    startTime: { type: String },
    endTime: { type: String },
    maxPatientsPerSlot: { type: Number, default: 4 }
  }],
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

export default models.User || model<IUser>('User', UserSchema);
