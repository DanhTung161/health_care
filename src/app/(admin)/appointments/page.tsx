import { Card, PageIntro } from "@/components/admin/AdminUI";
import AppointmentViews, {
  type AppointmentViewItem,
} from "@/components/admin/AppointmentViews";
import CreateAppointmentForm, {
  type AppointmentDoctorOption,
  type AppointmentPatientOption,
} from "@/components/admin/CreateAppointmentForm";
import { getCurrentUser } from "@/lib/auth";
import connectDB from "@/lib/db";
import Appointment from "@/models/Appointment";
import Patient from "@/models/Patient";
import User from "@/models/User";

async function getAppointments(): Promise<AppointmentViewItem[]> {
  await connectDB();
  const appointments = await Appointment.find({})
    .populate("patientId", "fullName phone")
    .populate("doctorId", "name")
    .sort({ appointmentDate: -1 })
    .lean();

  return JSON.parse(JSON.stringify(appointments)) as AppointmentViewItem[];
}

async function getAppointmentPatients(): Promise<AppointmentPatientOption[]> {
  await connectDB();
  const patients = await Patient.find({ deletedAt: null })
    .select("fullName phone")
    .sort({ fullName: 1 })
    .lean();

  return JSON.parse(JSON.stringify(patients)) as AppointmentPatientOption[];
}

async function getAppointmentDoctors(): Promise<AppointmentDoctorOption[]> {
  await connectDB();
  const doctors = await User.find({ role: "DOCTOR", isActive: true })
    .select("name specialtyId")
    .populate("specialtyId", "name")
    .sort({ name: 1 })
    .lean();

  return JSON.parse(JSON.stringify(doctors)) as AppointmentDoctorOption[];
}

export default async function Appointments() {
  const currentUser = await getCurrentUser();
  const canBook = currentUser?.role === "ADMIN" || currentUser?.role === "STAFF";
  const [appointments, patients, doctors] = await Promise.all([
    getAppointments(),
    canBook ? getAppointmentPatients() : Promise.resolve([]),
    canBook ? getAppointmentDoctors() : Promise.resolve([]),
  ]);

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageIntro
        title="Appointments"
        actionSlot={
          canBook ? (
            <CreateAppointmentForm patients={patients} doctors={doctors} />
          ) : undefined
        }
      />
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-slate-500">Total appointments</p>
          <p className="mt-2 text-2xl font-bold">{appointments.length}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Confirmed</p>
          <p className="mt-2 text-2xl font-bold text-emerald-600">
            {appointments.filter((item) => item.status === "CONFIRMED").length}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Scheduled</p>
          <p className="mt-2 text-2xl font-bold text-amber-500">
            {appointments.filter((item) => item.status === "PENDING").length}
          </p>
        </Card>
      </div>
      <AppointmentViews
        appointments={appointments}
        doctors={doctors}
        canReschedule={canBook}
        currentRole={currentUser?.role}
        currentUserId={currentUser?.id}
      />
    </div>
  );
}
