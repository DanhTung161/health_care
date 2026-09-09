import Link from "next/link";
import mongoose from "mongoose";
import { notFound } from "next/navigation";
import { Badge, Card, PageIntro } from "@/components/admin/AdminUI";
import MedicalHistorySection, {
  type MedicalVisitItem,
} from "@/components/admin/MedicalHistorySection";
import { getCurrentUser } from "@/lib/auth";
import connectDB from "@/lib/db";
import { isMedicalVisitEditable } from "@/lib/medical-visit";
import Appointment from "@/models/Appointment";
import MedicalVisit from "@/models/MedicalVisit";
import Patient from "@/models/Patient";

interface DoctorReference {
  _id: string;
  name: string;
}

interface MedicalRecordItem {
  _id: string;
  visitDate: string;
  doctorId?: DoctorReference | null;
  doctorName?: string;
  diagnosis: string;
  symptoms?: string;
  prescription?: {
    medicineName: string;
    dosage?: string;
    frequency?: string;
  }[];
  notes?: string;
}

interface PatientDetail {
  _id: string;
  fullName: string;
  phone: string;
  identityCard?: string;
  gender?: "MALE" | "FEMALE" | "OTHER";
  dateOfBirth?: string;
  address?: string;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  medicalRecords: MedicalRecordItem[];
}

interface AppointmentItem {
  _id: string;
  doctorId?: DoctorReference | null;
  appointmentDate: string;
  timeSlot: string;
  status: "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED";
  reason?: string;
}

function formatDate(value?: string | null, includeTime = false) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    ...(includeTime ? { timeStyle: "short" } : {}),
  }).format(date);
}

export default async function PatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) notFound();

  await connectDB();
  const [
    patientDocument,
    appointmentDocuments,
    medicalVisitDocuments,
    currentUser,
  ] = await Promise.all([
    Patient.findById(id)
      .populate("medicalRecords.doctorId", "name")
      .lean(),
    Appointment.find({ patientId: id })
      .select("doctorId appointmentDate timeSlot status reason")
      .populate("doctorId", "name")
      .sort({ appointmentDate: -1 })
      .lean(),
    MedicalVisit.find({ patientId: id })
      .populate("doctorId", "name role")
      .sort({ visitDate: -1, createdAt: -1 })
      .lean(),
    getCurrentUser(),
  ]);

  if (!patientDocument) notFound();

  const patient = JSON.parse(JSON.stringify(patientDocument)) as PatientDetail;
  const legacyRecords = [...patient.medicalRecords].sort(
    (left, right) =>
      new Date(right.visitDate).getTime() - new Date(left.visitDate).getTime(),
  );
  const appointments = JSON.parse(
    JSON.stringify(appointmentDocuments),
  ) as AppointmentItem[];
  const storedVisits = JSON.parse(JSON.stringify(medicalVisitDocuments)) as Omit<
    MedicalVisitItem,
    "isLegacy" | "canEdit"
  >[];
  const visits: MedicalVisitItem[] = storedVisits
    .map((visit) => {
      const canEditRole =
        currentUser?.role === "ADMIN" ||
        (currentUser?.role === "DOCTOR" &&
          visit.doctorId?._id === currentUser.id);
      return {
        ...visit,
        doctorName: visit.doctorName || visit.doctorId?.name || "Unknown doctor",
        prescription: visit.prescription ?? [],
        isLegacy: false,
        canEdit:
          Boolean(canEditRole) &&
          Boolean(visit.createdAt) &&
          isMedicalVisitEditable(new Date(visit.createdAt as string)),
      };
    })
    .sort(
      (left, right) =>
        new Date(right.visitDate).getTime() -
        new Date(left.visitDate).getTime(),
    );
  const isArchived = Boolean(patient.deletedAt);

  return (
    <div className="mx-auto max-w-[1200px]">
      <PageIntro
        title="Patient profile"
        actionSlot={
          <Link
            href="/patients"
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            Back to patients
          </Link>
        }
      />

      {isArchived && (
        <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-medium text-amber-800">
          This patient was archived on {formatDate(patient.deletedAt, true)}.
          Historical details and linked appointments remain available.
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold text-slate-900">
                {patient.fullName}
              </h3>
              <p className="mt-1 text-sm text-slate-500">Patient ID: {patient._id}</p>
            </div>
            <Badge tone={isArchived ? "amber" : "green"}>
              {isArchived ? "Archived" : "Active"}
            </Badge>
          </div>
          <dl className="grid gap-5 sm:grid-cols-2">
            <div><dt className="text-xs font-medium text-slate-400">Phone</dt><dd className="mt-1 text-sm font-semibold text-slate-800">{patient.phone}</dd></div>
            <div><dt className="text-xs font-medium text-slate-400">Identity card</dt><dd className="mt-1 text-sm font-semibold text-slate-800">{patient.identityCard || "—"}</dd></div>
            <div><dt className="text-xs font-medium text-slate-400">Gender</dt><dd className="mt-1 text-sm font-semibold text-slate-800">{patient.gender ?? "—"}</dd></div>
            <div><dt className="text-xs font-medium text-slate-400">Date of birth</dt><dd className="mt-1 text-sm font-semibold text-slate-800">{formatDate(patient.dateOfBirth)}</dd></div>
            <div className="sm:col-span-2"><dt className="text-xs font-medium text-slate-400">Address</dt><dd className="mt-1 text-sm font-semibold text-slate-800">{patient.address || "—"}</dd></div>
          </dl>
        </Card>

        <Card>
          <h3 className="font-bold text-slate-900">Record information</h3>
          <dl className="mt-5 space-y-4">
            <div><dt className="text-xs text-slate-400">Created</dt><dd className="mt-1 text-sm text-slate-700">{formatDate(patient.createdAt, true)}</dd></div>
            <div><dt className="text-xs text-slate-400">Last updated</dt><dd className="mt-1 text-sm text-slate-700">{formatDate(patient.updatedAt, true)}</dd></div>
            <div><dt className="text-xs text-slate-400">Appointments</dt><dd className="mt-1 text-sm font-semibold text-slate-700">{appointments.length}</dd></div>
            <div><dt className="text-xs text-slate-400">Medical records</dt><dd className="mt-1 text-sm font-semibold text-slate-700">{visits.length + legacyRecords.length}</dd></div>
          </dl>
        </Card>
      </div>

      <Card className="mt-5">
        <h3 className="mb-4 font-bold text-slate-900">Appointments</h3>
        {appointments.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] text-left text-sm">
              <thead className="border-b border-slate-100 text-xs text-slate-400"><tr><th className="pb-3 font-medium">Date</th><th className="pb-3 font-medium">Time</th><th className="pb-3 font-medium">Doctor</th><th className="pb-3 font-medium">Reason</th><th className="pb-3 font-medium">Status</th></tr></thead>
              <tbody>{appointments.map((appointment) => <tr key={appointment._id} className="border-b border-slate-50 last:border-0"><td className="py-4 text-slate-600">{formatDate(appointment.appointmentDate)}</td><td className="py-4 text-slate-600">{appointment.timeSlot}</td><td className="py-4 text-slate-600">{appointment.doctorId?.name ?? "Unknown doctor"}</td><td className="py-4 text-slate-600">{appointment.reason || "—"}</td><td className="py-4 font-medium text-slate-700">{appointment.status}</td></tr>)}</tbody>
            </table>
          </div>
        ) : <p className="text-sm text-slate-500">No appointments found.</p>}
      </Card>

      <MedicalHistorySection
        patientId={patient._id}
        visits={visits}
        canAdd={
          currentUser?.role === "ADMIN" || currentUser?.role === "DOCTOR"
        }
      />

      <Card className="mt-5">
        <h3 className="mb-4 font-bold text-slate-900">
          Legacy medical history
        </h3>
        {legacyRecords.length ? (
          <div className="space-y-4">
            {legacyRecords.map((record) => (
              <article key={record._id} className="rounded-xl border border-slate-100 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold text-slate-800">{record.diagnosis}</p><p className="mt-1 text-xs text-slate-400">{record.doctorId?.name ?? record.doctorName ?? "Unknown doctor"}</p></div><span className="text-xs text-slate-500">{formatDate(record.visitDate)}</span></div>
                <p className="mt-3 text-xs font-semibold text-slate-500">
                  Legacy · Locked · Read-only
                </p>
                {record.symptoms && <p className="mt-3 text-sm text-slate-600"><span className="font-medium">Symptoms:</span> {record.symptoms}</p>}
                {record.notes && <p className="mt-2 text-sm text-slate-600"><span className="font-medium">Notes:</span> {record.notes}</p>}
                {record.prescription?.length ? <div className="mt-3"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Prescription</p><ul className="mt-2 space-y-1 text-sm text-slate-600">{record.prescription.map((item, index) => <li key={`${item.medicineName}-${index}`}>{item.medicineName}{item.dosage ? ` — ${item.dosage}` : ""}{item.frequency ? `, ${item.frequency}` : ""}</li>)}</ul></div> : null}
              </article>
            ))}
          </div>
        ) : <p className="text-sm text-slate-500">No medical records found.</p>}
      </Card>
    </div>
  );
}
