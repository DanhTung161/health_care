"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export interface AppointmentPatientOption {
  _id: string;
  fullName: string;
  phone: string;
}

export interface AppointmentDoctorOption {
  _id: string;
  name: string;
  specialtyId?: { _id: string; name: string } | null;
}

interface ApiResponse {
  success: boolean;
  error?: string;
}

const inputClassName =
  "h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10";

export default function CreateAppointmentForm({
  patients,
  doctors,
}: {
  patients: AppointmentPatientOption[];
  doctors: AppointmentDoctorOption[];
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [patientSearch, setPatientSearch] = useState("");
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const filteredPatients = useMemo(() => {
    const search = patientSearch.trim().toLowerCase();
    if (!search) return patients;
    return patients.filter(
      (patient) =>
        patient.fullName.toLowerCase().includes(search) ||
        patient.phone.toLowerCase().includes(search),
    );
  }, [patientSearch, patients]);

  const selectedDoctor = doctors.find((doctor) => doctor._id === selectedDoctorId);

  function openForm() {
    setPatientSearch("");
    setSelectedDoctorId("");
    setErrorMessage("");
    setSuccessMessage("");
    setIsOpen(true);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");

    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = {
      patientId: String(formData.get("patientId") ?? ""),
      doctorId: String(formData.get("doctorId") ?? ""),
      appointmentDate: String(formData.get("appointmentDate") ?? ""),
      timeSlot: String(formData.get("timeSlot") ?? ""),
      reason: String(formData.get("reason") ?? "").trim(),
    };

    try {
      const response = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as ApiResponse;
      if (!response.ok || !result.success) {
        setErrorMessage(result.error ?? "Unable to create appointment.");
        return;
      }

      form.reset();
      setIsOpen(false);
      setSuccessMessage("Appointment created successfully.");
      router.refresh();
    } catch {
      setErrorMessage("Unable to connect to the server.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-3">
        {successMessage && <p role="status" className="text-sm font-medium text-emerald-600">{successMessage}</p>}
        <button type="button" onClick={openForm} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-200 hover:bg-blue-700">+ Book appointment</button>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-slate-950/45 p-4" role="dialog" aria-modal="true" aria-labelledby="create-appointment-title" onMouseDown={(event) => { if (event.target === event.currentTarget && !isSubmitting) setIsOpen(false); }}>
          <form onSubmit={handleSubmit} className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div><h3 id="create-appointment-title" className="text-lg font-bold text-slate-900">Book appointment</h3><p className="mt-1 text-sm text-slate-500">Choose an existing patient, doctor, date, and time.</p></div>
              <button type="button" onClick={() => setIsOpen(false)} disabled={isSubmitting} aria-label="Close appointment form" className="rounded-lg px-2 py-1 text-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700">×</button>
            </div>

            <div className="space-y-4">
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                Search patients
                <input value={patientSearch} onChange={(event) => setPatientSearch(event.target.value)} placeholder="Name or phone number" className={inputClassName} />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                Patient
                <select name="patientId" required className={inputClassName}>
                  <option value="">Select a patient</option>
                  {filteredPatients.map((patient) => <option key={patient._id} value={patient._id}>{patient.fullName} · {patient.phone}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                Doctor
                <select name="doctorId" required value={selectedDoctorId} onChange={(event) => setSelectedDoctorId(event.target.value)} className={inputClassName}>
                  <option value="">Select a doctor</option>
                  {doctors.map((doctor) => <option key={doctor._id} value={doctor._id}>{doctor.name}{doctor.specialtyId?.name ? ` · ${doctor.specialtyId.name}` : ""}</option>)}
                </select>
              </label>
              {selectedDoctor && <p className="rounded-xl bg-blue-50 px-3 py-2 text-sm text-blue-700">Specialty: {selectedDoctor.specialtyId?.name ?? "Unassigned"}</p>}
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">Date<input name="appointmentDate" type="date" required className={inputClassName} /></label>
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">Time<input name="timeSlot" type="time" required className={inputClassName} /></label>
              </div>
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">Reason (optional)<textarea name="reason" rows={3} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10" /></label>
            </div>

            {errorMessage && <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-600">{errorMessage}</p>}
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setIsOpen(false)} disabled={isSubmitting} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60">Cancel</button>
              <button type="submit" disabled={isSubmitting || !patients.length || !doctors.length} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{isSubmitting ? "Booking..." : "Book appointment"}</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
