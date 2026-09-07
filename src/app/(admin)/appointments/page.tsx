import { Badge, Card, PageIntro } from "@/components/admin/AdminUI";
import connectDB from "@/lib/db";
import Appointment, { IAppointment } from "@/models/Appointment";
import { IPatient } from "@/models/Patient";
import { IUser } from "@/models/User";

type AppointmentListItem = Omit<
  Pick<IAppointment, "appointmentDate" | "timeSlot" | "status" | "reason">,
  "appointmentDate"
> & {
  _id: string;
  appointmentDate: string;
  patientId: Pick<IPatient, "fullName" | "phone"> | null;
  doctorId: Pick<IUser, "name"> | null;
};

async function getAppointments(): Promise<AppointmentListItem[]> {
  await connectDB();
  const appointments = await Appointment.find({})
    .populate("patientId", "fullName phone")
    .populate("doctorId", "name")
    .sort({ appointmentDate: -1 })
    .lean();

  return JSON.parse(JSON.stringify(appointments)) as AppointmentListItem[];
}

function formatAppointmentDate(appointmentDate: string): string {
  const date = new Date(appointmentDate);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

export default async function Appointments() {
  const appointments = await getAppointments();

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageIntro title="Appointments" action="Schedule appointment" />
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-slate-500">Total appointments</p>
          <p className="mt-2 text-2xl font-bold">{appointments.length}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Confirmed</p>
          <p className="mt-2 text-2xl font-bold text-emerald-600">
            {
              appointments.filter((item) => item.status === "CONFIRMED")
                .length
            }
          </p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Scheduled</p>
          <p className="mt-2 text-2xl font-bold text-amber-500">
            {appointments.filter((item) => item.status === "PENDING").length}
          </p>
        </Card>
      </div>
      <Card>
        <div className="mb-5 flex items-center justify-between">
          <h3 className="font-bold">Appointment schedule</h3>
          <button className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600">
            September 4, 2026 ▾
          </button>
        </div>
        <div className="space-y-2">
          {appointments?.map((appointment) => (
            <div
              key={appointment._id}
              className="grid items-center gap-4 rounded-xl border border-slate-100 p-4 md:grid-cols-[100px_1.2fr_1.2fr_1.5fr_100px]"
            >
              <span className="text-sm font-semibold text-blue-600">
                {formatAppointmentDate(appointment.appointmentDate)} · {appointment.timeSlot}
              </span>
              <span className="font-semibold text-slate-800">
                {appointment.patientId?.fullName ?? "Unknown patient"}
              </span>
              <span className="text-sm text-slate-500">
                {appointment.doctorId?.name ?? "Unknown doctor"}
              </span>
              <span className="text-sm text-slate-500">
                {appointment.reason ?? "—"}
              </span>
              <Badge
                tone={appointment.status === "CONFIRMED" ? "green" : "amber"}
              >
                {appointment.status}
              </Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
