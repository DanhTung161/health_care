import Link from "next/link";
import { Badge, Card, PageIntro } from "@/components/admin/AdminUI";
import {
  COMPLETED_APPOINTMENT_STATUS,
  PENDING_APPOINTMENT_STATUS,
} from "@/lib/appointment-status";
import connectDB from "@/lib/db";
import Appointment from "@/models/Appointment";
import Patient from "@/models/Patient";

interface TodayAppointment {
  _id: string;
  patientId?: { fullName?: string } | null;
  doctorId?: { name?: string } | null;
  timeSlot: string;
}

interface RecentPatient {
  _id: string;
  fullName: string;
  identityCard?: string;
  dateOfBirth?: string;
  deletedAt?: string | null;
}

interface LastVisitResult {
  _id: { toString(): string };
  lastVisit: Date;
}

type StatTone = "blue" | "green" | "amber" | "red";

interface DashboardStat {
  label: string;
  value: string;
  context: string;
  tone: StatTone;
}

function formatCount(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatDate(value?: Date | string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function getAge(value?: string) {
  if (!value) return "—";
  const birthDate = new Date(value);
  if (Number.isNaN(birthDate.getTime())) return "—";

  const today = new Date();
  let age = today.getUTCFullYear() - birthDate.getUTCFullYear();
  const hasNotHadBirthday =
    today.getUTCMonth() < birthDate.getUTCMonth() ||
    (today.getUTCMonth() === birthDate.getUTCMonth() &&
      today.getUTCDate() < birthDate.getUTCDate());
  if (hasNotHadBirthday) age -= 1;
  return age >= 0 ? String(age) : "—";
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export default async function Dashboard() {
  await connectDB();

  const todayKey = new Date().toISOString().slice(0, 10);
  const todayStart = new Date(`${todayKey}T00:00:00.000Z`);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setUTCDate(tomorrowStart.getUTCDate() + 1);

  const [
    totalPatients,
    totalAppointments,
    pendingAppointments,
    todayDocuments,
    recentPatientDocuments,
  ] = await Promise.all([
    Patient.countDocuments({ deletedAt: null }),
    Appointment.countDocuments({}),
    Appointment.countDocuments({ status: PENDING_APPOINTMENT_STATUS }),
    Appointment.find({
      appointmentDate: { $gte: todayStart, $lt: tomorrowStart },
    })
      .select("patientId doctorId timeSlot")
      .populate("patientId", "fullName")
      .populate("doctorId", "name")
      .sort({ timeSlot: 1 })
      .lean(),
    Patient.find({ deletedAt: null })
      .select("fullName identityCard dateOfBirth deletedAt createdAt")
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
  ]);

  const lastVisitResults = recentPatientDocuments.length
    ? await Appointment.aggregate<LastVisitResult>([
        {
          $match: {
            patientId: {
              $in: recentPatientDocuments.map((patient) => patient._id),
            },
            status: COMPLETED_APPOINTMENT_STATUS,
          },
        },
        {
          $group: {
            _id: "$patientId",
            lastVisit: { $max: "$appointmentDate" },
          },
        },
      ])
    : [];

  const lastVisitByPatient = new Map(
    lastVisitResults.map((result) => [result._id.toString(), result.lastVisit]),
  );
  const todayAppointments = JSON.parse(
    JSON.stringify(todayDocuments),
  ) as TodayAppointment[];
  const recentPatients = JSON.parse(
    JSON.stringify(recentPatientDocuments),
  ) as RecentPatient[];

  const stats: DashboardStat[] = [
    {
      label: "Total patients",
      value: formatCount(totalPatients),
      context: "Active",
      tone: "blue",
    },
    {
      label: "Appointments",
      value: formatCount(totalAppointments),
      context: "All records",
      tone: "green",
    },
    {
      label: "Revenue this month",
      value: "—",
      context: "Unavailable",
      tone: "amber",
    },
    {
      label: "Pending appointments",
      value: formatCount(pendingAppointments),
      context: "Current",
      tone: "red",
    },
  ];

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageIntro
        title="Overview"
        actionSlot={
          <Link
            href="/appointments"
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-200 hover:bg-blue-700"
          >
            + New appointment
          </Link>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ label, value, context, tone }) => (
          <Card key={label}>
            <div className="flex items-start justify-between">
              <span
                className={`grid h-10 w-10 place-items-center rounded-xl text-lg ${tone === "blue" ? "bg-blue-50 text-blue-600" : tone === "green" ? "bg-emerald-50 text-emerald-600" : tone === "amber" ? "bg-amber-50 text-amber-600" : "bg-rose-50 text-rose-600"}`}
              >
                ◈
              </span>
              <Badge tone={tone}>{context}</Badge>
            </div>
            <p className="mt-5 text-sm text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
          </Card>
        ))}
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <Card>
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900">
                Patient inflow trends
              </h3>
              <p className="mt-1 text-xs text-slate-400">
                Weekly comparison of new vs returning patients
              </p>
            </div>
            <span className="text-xs font-medium text-slate-400">
              Data unavailable
            </span>
          </div>
          <div className="grid h-56 place-items-center border-b border-l border-slate-100 px-4 pb-0 pt-4">
            <p className="text-sm text-slate-400">
              Patient inflow data is not yet defined.
            </p>
          </div>
          <div className="mt-3 flex justify-between px-1 text-[11px] text-slate-400">
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
            <span>Sun</span>
          </div>
        </Card>
        <Card>
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900">Today’s appointments</h3>
              <p className="mt-1 text-xs text-slate-400">
                {new Intl.DateTimeFormat("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                  timeZone: "UTC",
                }).format(todayStart)}
              </p>
            </div>
            <Link
              href="/appointments"
              className="text-xs font-semibold text-blue-600"
            >
              View all
            </Link>
          </div>
          <div className="space-y-4">
            {todayAppointments.length ? (
              todayAppointments.map((appointment) => {
                const patientName =
                  appointment.patientId?.fullName ?? "Unknown patient";
                const doctorName =
                  appointment.doctorId?.name ?? "Unknown doctor";
                return (
                  <div key={appointment._id} className="flex items-center gap-3">
                    <span className="w-11 text-xs font-semibold text-slate-400">
                      {appointment.timeSlot}
                    </span>
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                      {initials(patientName) || "—"}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">
                        {patientName}
                      </p>
                      <p className="truncate text-xs text-slate-400">
                        {doctorName}
                      </p>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="py-8 text-center text-sm text-slate-500">
                No appointments scheduled for today.
              </p>
            )}
          </div>
        </Card>
      </div>
      <Card className="mt-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-bold text-slate-900">Recent patients</h3>
          <Link href="/patients" className="text-xs font-semibold text-blue-600">
            View all patients →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="border-b border-slate-100 text-xs text-slate-400">
              <tr>
                <th className="pb-3 font-medium">Patient</th>
                <th className="pb-3 font-medium">Patient ID</th>
                <th className="pb-3 font-medium">Age</th>
                <th className="pb-3 font-medium">Last visit</th>
                <th className="pb-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentPatients.length ? (
                recentPatients.map((patient) => (
                  <tr
                    key={patient._id}
                    className="border-b border-slate-50 last:border-0"
                  >
                    <td className="py-4 font-semibold text-slate-800">
                      {patient.fullName}
                    </td>
                    <td className="py-4 text-slate-500">
                      {patient.identityCard || patient._id}
                    </td>
                    <td className="py-4 text-slate-500">
                      {getAge(patient.dateOfBirth)}
                    </td>
                    <td className="py-4 text-slate-500">
                      {formatDate(lastVisitByPatient.get(patient._id))}
                    </td>
                    <td className="py-4">
                      <Badge tone={patient.deletedAt ? "amber" : "green"}>
                        {patient.deletedAt ? "Archived" : "Active"}
                      </Badge>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={5}
                    className="py-8 text-center text-sm text-slate-500"
                  >
                    No recent patients found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
