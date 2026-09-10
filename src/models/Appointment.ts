import mongoose, { Schema, Document, models, model } from 'mongoose';
import {
  APPOINTMENT_STATUSES,
  type AppointmentStatus,
} from '@/lib/appointment-status';

export interface IAppointment extends Document {
  patientId: mongoose.Types.ObjectId;
  doctorId: mongoose.Types.ObjectId;
  appointmentDate: Date;
  timeSlot: string;
  status: AppointmentStatus;
  reason?: string;
  cancellationReason?: string;
  cancelledAt?: Date;
  cancelledBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const AppointmentSchema = new Schema<IAppointment>({
  patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
  doctorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  appointmentDate: { type: Date, required: true },
  timeSlot: { type: String, required: true },
  status: { type: String, enum: APPOINTMENT_STATUSES, default: 'PENDING' },
  reason: { type: String },
  cancellationReason: { type: String },
  cancelledAt: { type: Date },
  cancelledBy: { type: Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

const Appointment = models.Appointment || model<IAppointment>('Appointment', AppointmentSchema);
const statusPath = Appointment.schema.path('status');

if (statusPath instanceof Schema.Types.String) {
  // Mongoose exposes enumValues at runtime, but not in its TypeScript declaration.
  const stringStatusPath = statusPath as Schema.Types.String & {
    enumValues: string[];
  };
  if (!stringStatusPath.enumValues.includes('ACCEPTED')) {
    stringStatusPath.enum('ACCEPTED');
  }
}

// During development Mongoose reuses an already-compiled model across module
// reloads. Add fields introduced after that model was first compiled so strict
// document saves do not silently discard cancellation audit data.
if (!Appointment.schema.path('cancellationReason')) {
  Appointment.schema.add({ cancellationReason: { type: String } });
}
if (!Appointment.schema.path('cancelledAt')) {
  Appointment.schema.add({ cancelledAt: { type: Date } });
}
if (!Appointment.schema.path('cancelledBy')) {
  Appointment.schema.add({
    cancelledBy: { type: Schema.Types.ObjectId, ref: 'User' },
  });
}
if (!Appointment.schema.path('updatedBy')) {
  Appointment.schema.add({
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  });
}

export default Appointment;
