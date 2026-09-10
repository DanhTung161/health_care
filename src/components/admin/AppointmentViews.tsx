"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight, List } from "lucide-react";
import { Badge, Card } from "@/components/admin/AdminUI";
import type { AppointmentDoctorOption } from "@/components/admin/CreateAppointmentForm";

type AppointmentStatus =
  | "PENDING"
  | "CONFIRMED"
  | "ACCEPTED"
  | "COMPLETED"
  | "CANCELLED";
type CalendarRange = "month" | "week" | "day";
type DisplayMode = "list" | "calendar";

export interface AppointmentViewItem {
  _id: string;
  appointmentDate: string;
  timeSlot: string;
  status: AppointmentStatus;
  reason?: string;
  cancellationReason?: string;
  cancelledAt?: string;
  patientId: { _id: string; fullName: string; phone: string } | null;
  doctorId: { _id: string; name: string } | null;
}

interface ApiResponse {
  success: boolean;
  error?: string;
  data?: {
    _id: string;
    status: AppointmentStatus;
    cancellationReason?: string;
    cancelledAt?: string;
  };
}

const inputClassName =
  "h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10";
const weekdayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function startOfUtcWeek(date: Date): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() - ((result.getUTCDay() + 6) % 7));
  result.setUTCHours(0, 0, 0, 0);
  return result;
}

function addUtcDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function dateKey(date: Date | string): string {
  const parsed = typeof date === "string" ? new Date(date) : date;
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
}

function isReschedulable(status: AppointmentStatus): boolean {
  return status === "PENDING" || status === "CONFIRMED";
}

function isCancellable(status: AppointmentStatus): boolean {
  return status === "PENDING" || status === "CONFIRMED" || status === "ACCEPTED";
}

function getVisibleDays(anchor: Date, range: CalendarRange): Date[] {
  if (range === "day") return [new Date(anchor)];
  const start =
    range === "week"
      ? startOfUtcWeek(anchor)
      : startOfUtcWeek(
          new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1)),
        );
  return Array.from({ length: range === "week" ? 7 : 42 }, (_, index) =>
    addUtcDays(start, index),
  );
}

function moveAnchor(anchor: Date, range: CalendarRange, direction: -1 | 1): Date {
  if (range === "month") {
    return new Date(
      Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + direction, 1),
    );
  }
  return addUtcDays(anchor, direction * (range === "week" ? 7 : 1));
}

function rangeLabel(anchor: Date, range: CalendarRange): string {
  if (range === "month") {
    return anchor.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  }
  if (range === "day") {
    return anchor.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  }
  const start = startOfUtcWeek(anchor);
  const end = addUtcDays(start, 6);
  return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })} - ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}`;
}

function statusTone(status: AppointmentStatus): "green" | "blue" | "amber" | "red" {
  if (status === "CONFIRMED") return "green";
  if (status === "ACCEPTED") return "blue";
  if (status === "COMPLETED") return "blue";
  if (status === "CANCELLED") return "red";
  return "amber";
}

export default function AppointmentViews({
  appointments,
  doctors,
  canReschedule,
  currentRole,
  currentUserId,
}: {
  appointments: AppointmentViewItem[];
  doctors: AppointmentDoctorOption[];
  canReschedule: boolean;
  currentRole?: "ADMIN" | "DOCTOR" | "STAFF";
  currentUserId?: string;
}) {
  const router = useRouter();
  const [displayMode, setDisplayMode] = useState<DisplayMode>("list");
  const [calendarRange, setCalendarRange] = useState<CalendarRange>("month");
  const [anchorDate, setAnchorDate] = useState(
    () => new Date(`${dateKey(new Date())}T00:00:00.000Z`),
  );
  const [selected, setSelected] = useState<AppointmentViewItem | null>(null);
  const [cancelTarget, setCancelTarget] = useState<AppointmentViewItem | null>(null);
  const [doctorId, setDoctorId] = useState("");
  const [appointmentDate, setAppointmentDate] = useState("");
  const [timeSlot, setTimeSlot] = useState("");
  const [cancellationReason, setCancellationReason] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [appointmentUpdates, setAppointmentUpdates] = useState<
    Record<string, Partial<AppointmentViewItem>>
  >({});
  const appointmentItems = useMemo(
    () =>
      appointments.map((appointment) => ({
        ...appointment,
        ...appointmentUpdates[appointment._id],
      })),
    [appointmentUpdates, appointments],
  );

  const visibleDays = useMemo(
    () => getVisibleDays(anchorDate, calendarRange),
    [anchorDate, calendarRange],
  );
  const appointmentsByDay = useMemo(() => {
    const grouped = new Map<string, AppointmentViewItem[]>();
    for (const appointment of appointmentItems) {
      const key = dateKey(appointment.appointmentDate);
      const items = grouped.get(key) ?? [];
      items.push(appointment);
      grouped.set(key, items);
    }
    for (const items of grouped.values()) {
      items.sort((left, right) => left.timeSlot.localeCompare(right.timeSlot));
    }
    return grouped;
  }, [appointmentItems]);

  function openReschedule(appointment: AppointmentViewItem) {
    if (!canReschedule || !isReschedulable(appointment.status)) return;
    setSelected(appointment);
    setDoctorId(appointment.doctorId?._id ?? "");
    setAppointmentDate(dateKey(appointment.appointmentDate));
    setTimeSlot(appointment.timeSlot);
    setErrorMessage("");
  }

  async function updateAppointment(
    appointmentId: string,
    payload: Record<string, string>,
    success: string,
  ): Promise<boolean> {
    setIsSaving(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const response = await fetch(`/api/appointments/${appointmentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as ApiResponse;
      if (!response.ok || !result.success) {
        setErrorMessage(result.error ?? "Unable to update appointment.");
        return false;
      }
      if (result.data) {
        const updatedAppointment = result.data;
        setAppointmentUpdates((current) => ({
          ...current,
          [updatedAppointment._id]: {
            status: updatedAppointment.status,
            cancellationReason: updatedAppointment.cancellationReason,
            cancelledAt: updatedAppointment.cancelledAt,
          },
        }));
      }
      setSuccessMessage(success);
      router.refresh();
      return true;
    } catch {
      setErrorMessage("Unable to connect to the server.");
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  async function saveReschedule(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    if (
      await updateAppointment(
        selected._id,
        { doctorId, appointmentDate, timeSlot },
        "Appointment rescheduled successfully.",
      )
    ) {
      setSelected(null);
    }
  }

  async function changeStatus(appointment: AppointmentViewItem, status: AppointmentStatus) {
    await updateAppointment(appointment._id, { status }, "Appointment status updated.");
  }

  function canDoctorAccept(appointment: AppointmentViewItem): boolean {
    return (
      currentRole === "DOCTOR" &&
      appointment.status === "CONFIRMED" &&
      appointment.doctorId?._id === currentUserId
    );
  }

  function openCancellation(appointment: AppointmentViewItem) {
    if (!canReschedule || !isCancellable(appointment.status)) return;
    setCancelTarget(appointment);
    setCancellationReason("");
    setErrorMessage("");
  }

  async function saveCancellation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!cancelTarget) return;
    if (
      await updateAppointment(
        cancelTarget._id,
        { status: "CANCELLED", cancellationReason },
        "Appointment cancelled successfully.",
      )
    ) {
      setCancelTarget(null);
    }
  }

  function appointmentButton(appointment: AppointmentViewItem, compact = false) {
    const canOpen = canReschedule && isReschedulable(appointment.status);
    return (
      <button
        key={appointment._id}
        type="button"
        onClick={() => openReschedule(appointment)}
        disabled={!canOpen}
        className={`w-full rounded-lg border text-left transition disabled:cursor-default ${appointment.status === "CANCELLED" ? "border-rose-100 bg-rose-50 text-rose-800" : "border-blue-100 bg-blue-50 text-blue-800 hover:border-blue-200 hover:bg-blue-100"} ${compact ? "p-1.5 text-[11px]" : "p-3 text-sm"}`}
        title={canOpen ? "Open quick reschedule" : "Appointment is read-only"}
      >
        <span className="block font-bold">
          {appointment.timeSlot} - {appointment.patientId?.fullName ?? "Unknown patient"}
        </span>
        <span className="mt-0.5 block truncate opacity-80">
          {appointment.doctorId?.name ?? "Unknown doctor"} - {appointment.status}
        </span>
        {appointment.status === "CANCELLED" && appointment.cancellationReason && (
          <span className="mt-0.5 block truncate text-[10px]">
            Reason: {appointment.cancellationReason}
          </span>
        )}
      </button>
    );
  }

  return (
    <>
      <Card>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-900">Appointment schedule</h3>
            {successMessage && (
              <p role="status" className="mt-1 text-sm font-medium text-emerald-600">
                {successMessage}
              </p>
            )}
            {errorMessage && !selected && !cancelTarget && (
              <p role="alert" className="mt-1 text-sm font-medium text-rose-600">
                {errorMessage}
              </p>
            )}
          </div>
          <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1">
            <button type="button" onClick={() => setDisplayMode("list")} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${displayMode === "list" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"}`}><List size={15} />List</button>
            <button type="button" onClick={() => setDisplayMode("calendar")} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${displayMode === "calendar" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"}`}><CalendarDays size={15} />Calendar</button>
          </div>
        </div>

        {displayMode === "list" ? (
          <div className="space-y-2">
            {appointmentItems.length ? appointmentItems.map((appointment) => (
              <div key={appointment._id} className="grid items-center gap-4 rounded-xl border border-slate-100 p-4 md:grid-cols-[130px_1.1fr_1.1fr_1.5fr_100px_auto]">
                <span className="text-sm font-semibold text-blue-600">{new Date(appointment.appointmentDate).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric", timeZone: "UTC" })} - {appointment.timeSlot}</span>
                <span className="font-semibold text-slate-800">{appointment.patientId?.fullName ?? "Unknown patient"}</span>
                <span className="text-sm text-slate-500">{appointment.doctorId?.name ?? "Unknown doctor"}</span>
                <span className="text-sm text-slate-500">{appointment.status === "CANCELLED" ? `Cancellation: ${appointment.cancellationReason ?? "No reason recorded"}` : appointment.reason ?? "-"}</span>
                <Badge tone={statusTone(appointment.status)}>{appointment.status}</Badge>
                {canReschedule && <div className="flex flex-wrap justify-end gap-2">
                  {appointment.status === "PENDING" && <button type="button" disabled={isSaving} onClick={() => changeStatus(appointment, "CONFIRMED")} className="rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-60">Confirm</button>}
                  {appointment.status === "ACCEPTED" && <button type="button" disabled={isSaving} onClick={() => changeStatus(appointment, "COMPLETED")} className="rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-60">Complete</button>}
                  {isReschedulable(appointment.status) && <button type="button" disabled={isSaving} onClick={() => openReschedule(appointment)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:border-blue-200 hover:text-blue-600 disabled:opacity-60">Reschedule</button>}
                  {isCancellable(appointment.status) && <button type="button" disabled={isSaving} onClick={() => openCancellation(appointment)} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-60">Cancel</button>}
                </div>}
                {canDoctorAccept(appointment) && <div className="flex justify-end"><button type="button" disabled={isSaving} onClick={() => changeStatus(appointment, "ACCEPTED")} className="rounded-lg border border-violet-200 px-3 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-50 disabled:opacity-60">Accept</button></div>}
              </div>
            )) : <p className="py-8 text-center text-sm text-slate-500">No appointments found.</p>}
          </div>
        ) : (
          <div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setAnchorDate(moveAnchor(anchorDate, calendarRange, -1))} aria-label="Previous date range" className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"><ChevronLeft size={17} /></button>
                <button type="button" onClick={() => setAnchorDate(new Date(`${dateKey(new Date())}T00:00:00.000Z`))} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">Today</button>
                <button type="button" onClick={() => setAnchorDate(moveAnchor(anchorDate, calendarRange, 1))} aria-label="Next date range" className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"><ChevronRight size={17} /></button>
              </div>
              <p className="text-sm font-bold text-slate-800">{rangeLabel(anchorDate, calendarRange)}</p>
              <div className="flex rounded-lg bg-slate-100 p-1">{(["month", "week", "day"] as const).map((range) => <button key={range} type="button" onClick={() => setCalendarRange(range)} className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize ${calendarRange === range ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"}`}>{range}</button>)}</div>
            </div>
            {calendarRange !== "day" && <div className="grid grid-cols-7 border-x border-t border-slate-200 bg-slate-50">{weekdayNames.map((day) => <div key={day} className="border-r border-slate-200 px-2 py-2 text-center text-xs font-semibold text-slate-500 last:border-r-0">{day}</div>)}</div>}
            <div className={calendarRange === "day" ? "space-y-2 rounded-xl border border-slate-200 p-4" : "grid grid-cols-7 border-l border-t border-slate-200"}>{visibleDays.map((day) => {
              const key = dateKey(day);
              const dayAppointments = appointmentsByDay.get(key) ?? [];
              const outsideMonth = calendarRange === "month" && day.getUTCMonth() !== anchorDate.getUTCMonth();
              return <div key={key} className={calendarRange === "day" ? "min-h-72" : `min-h-28 border-b border-r border-slate-200 p-1.5 ${outsideMonth ? "bg-slate-50/80" : "bg-white"}`}><div className={`mb-2 text-xs font-semibold ${key === dateKey(new Date()) ? "inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white" : outsideMonth ? "text-slate-300" : "text-slate-600"}`}>{calendarRange === "day" ? day.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" }) : day.getUTCDate()}</div><div className="space-y-1.5">{dayAppointments.length ? dayAppointments.map((appointment) => appointmentButton(appointment, calendarRange === "month")) : calendarRange === "day" && <p className="py-16 text-center text-sm text-slate-400">No appointments on this day.</p>}</div></div>;
            })}</div>
          </div>
        )}
      </Card>

      {selected && <div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-slate-950/45 p-4" role="dialog" aria-modal="true" aria-labelledby="reschedule-title" onMouseDown={(event) => { if (event.target === event.currentTarget && !isSaving) setSelected(null); }}><form onSubmit={saveReschedule} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"><div className="mb-5 flex items-start justify-between gap-4"><div><h3 id="reschedule-title" className="text-lg font-bold text-slate-900">Reschedule appointment</h3><p className="mt-1 text-sm text-slate-500">{selected.patientId?.fullName ?? "Unknown patient"}</p></div><button type="button" onClick={() => setSelected(null)} disabled={isSaving} aria-label="Close reschedule form" className="rounded-lg px-2 py-1 text-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700">x</button></div><div className="space-y-4"><label className="flex flex-col gap-2 text-sm font-medium text-slate-700">Doctor<select required value={doctorId} onChange={(event) => setDoctorId(event.target.value)} className={inputClassName}><option value="">Select a doctor</option>{doctors.map((doctor) => <option key={doctor._id} value={doctor._id}>{doctor.name}{doctor.specialtyId?.name ? ` - ${doctor.specialtyId.name}` : ""}</option>)}</select></label><div className="grid gap-4 sm:grid-cols-2"><label className="flex flex-col gap-2 text-sm font-medium text-slate-700">Date<input required type="date" value={appointmentDate} onChange={(event) => setAppointmentDate(event.target.value)} className={inputClassName} /></label><label className="flex flex-col gap-2 text-sm font-medium text-slate-700">Time<input required type="time" value={timeSlot} onChange={(event) => setTimeSlot(event.target.value)} className={inputClassName} /></label></div><div className="rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-600"><span className="font-semibold text-slate-800">Confirm:</span> {appointmentDate || "Choose a date"} at {timeSlot || "choose a time"} with {doctors.find((doctor) => doctor._id === doctorId)?.name ?? "a doctor"}.</div></div>{errorMessage && <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-600">{errorMessage}</p>}<div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setSelected(null)} disabled={isSaving} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60">Close</button><button type="submit" disabled={isSaving || !doctorId || !appointmentDate || !timeSlot} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{isSaving ? "Saving..." : "Save new schedule"}</button></div></form></div>}

      {cancelTarget && <div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-slate-950/45 p-4" role="dialog" aria-modal="true" aria-labelledby="cancel-appointment-title" onMouseDown={(event) => { if (event.target === event.currentTarget && !isSaving) setCancelTarget(null); }}><form onSubmit={saveCancellation} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"><div className="mb-5 flex items-start justify-between gap-4"><div><h3 id="cancel-appointment-title" className="text-lg font-bold text-slate-900">Cancel appointment</h3><p className="mt-1 text-sm text-slate-500">This keeps the appointment in the history.</p></div><button type="button" onClick={() => setCancelTarget(null)} disabled={isSaving} aria-label="Close cancellation form" className="rounded-lg px-2 py-1 text-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700">x</button></div><label className="flex flex-col gap-2 text-sm font-medium text-slate-700">Cancellation reason<textarea required rows={4} value={cancellationReason} onChange={(event) => setCancellationReason(event.target.value)} placeholder="Explain why this appointment is being cancelled" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10" /></label>{errorMessage && <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-600">{errorMessage}</p>}<div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setCancelTarget(null)} disabled={isSaving} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60">Keep appointment</button><button type="submit" disabled={isSaving || !cancellationReason.trim()} className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60">{isSaving ? "Cancelling..." : "Confirm cancellation"}</button></div></form></div>}
    </>
  );
}
