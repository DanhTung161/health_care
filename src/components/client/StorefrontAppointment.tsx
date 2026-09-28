"use client";

import Image from "next/image";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";

import { StorefrontButton } from "@/components/client/StorefrontButton";

const openingHours = [
  ["Monday - Friday", "9AM - 10PM"],
  ["Saturday", "9AM - 10PM"],
  ["Sunday", "10AM - 5PM"],
] as const;

interface AppointmentOption {
  id: string;
  name: string;
}

interface PublicAppointmentApiResponse {
  success: boolean;
  error?: string;
  appointmentId?: string;
  data?: {
    specialties?: AppointmentOption[];
    doctors?: AppointmentOption[];
  };
}

interface AppointmentFormState {
  name: string;
  email: string;
  phone: string;
  appointmentDate: string;
  timeSlot: string;
  specialtyId: string;
  doctorId: string;
  reason: string;
}

const initialFormState: AppointmentFormState = {
  name: "",
  email: "",
  phone: "",
  appointmentDate: "",
  timeSlot: "",
  specialtyId: "",
  doctorId: "",
  reason: "",
};

function getTodayInputValue() {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
}

async function readApiResponse(response: Response) {
  try {
    return (await response.json()) as PublicAppointmentApiResponse;
  } catch {
    return null;
  }
}

export default function StorefrontAppointment() {
  const [form, setForm] = useState<AppointmentFormState>(initialFormState);
  const [specialties, setSpecialties] = useState<AppointmentOption[]>([]);
  const [doctors, setDoctors] = useState<AppointmentOption[]>([]);
  const [isLoadingSpecialties, setIsLoadingSpecialties] = useState(true);
  const [isLoadingDoctors, setIsLoadingDoctors] = useState(false);
  const [specialtyError, setSpecialtyError] = useState("");
  const [doctorError, setDoctorError] = useState("");
  const [specialtyRetry, setSpecialtyRetry] = useState(0);
  const [doctorRetry, setDoctorRetry] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);
  const submissionLock = useRef(false);

  useEffect(() => {
    const controller = new AbortController();

    async function loadSpecialties() {
      setIsLoadingSpecialties(true);
      setSpecialtyError("");

      try {
        const response = await fetch("/api/public/appointments/options", {
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
        });
        const result = await readApiResponse(response);
        if (!response.ok || !result?.success) {
          setSpecialtyError(result?.error ?? "Unable to load services.");
          setSpecialties([]);
          return;
        }

        setSpecialties(result.data?.specialties ?? []);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setSpecialtyError("Unable to load services.");
        setSpecialties([]);
      } finally {
        if (!controller.signal.aborted) setIsLoadingSpecialties(false);
      }
    }

    void loadSpecialties();
    return () => controller.abort();
  }, [specialtyRetry]);

  useEffect(() => {
    if (!form.specialtyId) return;

    const controller = new AbortController();

    async function loadDoctors() {
      setIsLoadingDoctors(true);
      setDoctorError("");

      try {
        const response = await fetch(
          `/api/public/appointments/options?specialtyId=${encodeURIComponent(form.specialtyId)}`,
          {
            credentials: "same-origin",
            cache: "no-store",
            signal: controller.signal,
          },
        );
        const result = await readApiResponse(response);
        if (!response.ok || !result?.success) {
          setDoctorError(result?.error ?? "Unable to load doctors.");
          return;
        }

        setDoctors(result.data?.doctors ?? []);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setDoctorError("Unable to load doctors.");
      } finally {
        if (!controller.signal.aborted) setIsLoadingDoctors(false);
      }
    }

    void loadDoctors();
    return () => controller.abort();
  }, [doctorRetry, form.specialtyId]);

  function updateField<Key extends keyof AppointmentFormState>(
    field: Key,
    value: AppointmentFormState[Key],
  ) {
    if (field === "specialtyId") {
      setDoctors([]);
      setDoctorError("");
      setIsLoadingDoctors(Boolean(value));
    }

    setForm((current) => ({
      ...current,
      [field]: value,
      ...(field === "specialtyId" ? { doctorId: "" } : {}),
    }));
    setMessage(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submissionLock.current) return;

    submissionLock.current = true;
    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch("/api/public/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(form),
      });
      const result = await readApiResponse(response);

      if (!response.ok || !result?.success || !result.appointmentId) {
        setMessage({
          tone: "error",
          text: result?.error ?? "Unable to submit appointment request.",
        });
        return;
      }

      setForm(initialFormState);
      setDoctors([]);
      setMessage({
        tone: "success",
        text: "Appointment request submitted successfully.",
      });
    } catch {
      setMessage({
        tone: "error",
        text: "Unable to connect to the server. Please try again.",
      });
    } finally {
      submissionLock.current = false;
      setIsSubmitting(false);
    }
  }

  const doctorSelectDisabled =
    !form.specialtyId ||
    isLoadingDoctors ||
    Boolean(doctorError) ||
    doctors.length === 0;

  return (
    <section className="storefront-appointment" aria-labelledby="storefront-appointment-title">
      <div className="storefront-appointment__background" aria-hidden="true" />

      <div className="storefront-appointment__media">
        <div className="storefront-appointment__photo">
          <Image src="/images/storefront/appointment/consultation.png" alt="Doctor consulting with a patient" width={1380} height={920} />
        </div>

        <aside className="storefront-appointment__hours" aria-labelledby="storefront-appointment-hours-title">
          <h3 id="storefront-appointment-hours-title">Opening &amp; Closing Times</h3>
          <p>We are dedicated to providing flexible &amp; accessible healthcare services.</p>
          <Image className="storefront-appointment__divider" src="/icons/storefront/appointment/divider.svg" alt="" width={250} height={1} aria-hidden="true" />
          <table>
            <tbody>
              {openingHours.map(([day, hours]) => (
                <tr key={day}>
                  <th scope="row">{day}</th>
                  <td>{hours}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <a className="storefront-appointment__hotline" href="tel:+1890123456">
            <Image src="/icons/storefront/appointment/call.svg" alt="" width={34} height={34} aria-hidden="true" />
            <span>Hotline: <strong>+1890 123 456</strong></span>
          </a>
        </aside>
      </div>

      <div className="storefront-appointment__content">
        <div className="storefront-appointment__eyebrow">
          <Image src="/icons/storefront/appointment/eyebrow.svg" alt="" width={20} height={20} aria-hidden="true" />
          <span>Make an appointment</span>
        </div>
        <h2 id="storefront-appointment-title">Book your appointment for better health</h2>

        <form className="storefront-appointment__form" onSubmit={handleSubmit} aria-busy={isSubmitting}>
          <div className="storefront-appointment__fields">
            <div className="storefront-appointment__field">
              <label className="storefront-appointment__sr-only" htmlFor="appointment-name">Your name</label>
              <input id="appointment-name" name="name" type="text" autoComplete="name" placeholder=" " maxLength={100} value={form.name} onChange={(event) => updateField("name", event.target.value)} required />
              <span className="storefront-appointment__placeholder" aria-hidden="true">Your name<span>*</span></span>
            </div>
            <div className="storefront-appointment__field">
              <label className="storefront-appointment__sr-only" htmlFor="appointment-email">Your email</label>
              <input id="appointment-email" name="email" type="email" autoComplete="email" placeholder=" " maxLength={254} value={form.email} onChange={(event) => updateField("email", event.target.value)} required />
              <span className="storefront-appointment__placeholder" aria-hidden="true">Your email<span>*</span></span>
            </div>
            <div className="storefront-appointment__field">
              <label className="storefront-appointment__sr-only" htmlFor="appointment-phone">Your phone</label>
              <input id="appointment-phone" name="phone" type="tel" autoComplete="tel" placeholder=" " maxLength={30} value={form.phone} onChange={(event) => updateField("phone", event.target.value)} required />
              <span className="storefront-appointment__placeholder" aria-hidden="true">Your phone<span>*</span></span>
            </div>
            <div className="storefront-appointment__field storefront-appointment__field--icon">
              <label className="storefront-appointment__sr-only" htmlFor="appointment-date">Appointment date</label>
              <input id="appointment-date" name="appointmentDate" type="date" min={getTodayInputValue()} value={form.appointmentDate} onChange={(event) => updateField("appointmentDate", event.target.value)} required />
              <Image src="/icons/storefront/appointment/calendar.svg" alt="" width={24} height={24} aria-hidden="true" />
            </div>
            <div className="storefront-appointment__field">
              <label className="storefront-appointment__sr-only" htmlFor="appointment-time">Appointment time</label>
              <input id="appointment-time" name="timeSlot" type="time" value={form.timeSlot} onChange={(event) => updateField("timeSlot", event.target.value)} required />
            </div>
            <div className="storefront-appointment__field storefront-appointment__field--icon">
              <label className="storefront-appointment__sr-only" htmlFor="appointment-service">Choose service</label>
              <select
                id="appointment-service"
                name="specialtyId"
                value={form.specialtyId}
                onChange={(event) => updateField("specialtyId", event.target.value)}
                disabled={isLoadingSpecialties || Boolean(specialtyError) || specialties.length === 0}
                required
              >
                <option value="" disabled>
                  {isLoadingSpecialties
                    ? "Loading services..."
                    : specialtyError
                      ? "Services unavailable"
                      : specialties.length
                        ? "Choose service"
                        : "No services available"}
                </option>
                {specialties.map((specialty) => (
                  <option key={specialty.id} value={specialty.id}>{specialty.name}</option>
                ))}
              </select>
              <Image src="/icons/storefront/appointment/chevron-down.svg" alt="" width={24} height={24} aria-hidden="true" />
            </div>
            <div className="storefront-appointment__field storefront-appointment__field--icon storefront-appointment__field--doctor">
              <label className="storefront-appointment__sr-only" htmlFor="appointment-doctor">Choose doctor</label>
              <select
                id="appointment-doctor"
                name="doctorId"
                value={form.doctorId}
                onChange={(event) => updateField("doctorId", event.target.value)}
                disabled={doctorSelectDisabled}
                required
              >
                <option value="" disabled>
                  {!form.specialtyId
                    ? "Choose service first"
                    : isLoadingDoctors
                      ? "Loading doctors..."
                      : doctorError
                        ? "Doctors unavailable"
                        : doctors.length
                          ? "Choose doctor"
                          : "No doctors available"}
                </option>
                {doctors.map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>{doctor.name}</option>
                ))}
              </select>
              <Image src="/icons/storefront/appointment/chevron-down.svg" alt="" width={24} height={24} aria-hidden="true" />
            </div>
            <div className="storefront-appointment__field storefront-appointment__field--note">
              <label className="storefront-appointment__sr-only" htmlFor="appointment-note">Appointment note</label>
              <textarea id="appointment-note" name="reason" placeholder="Type appointment note" maxLength={1000} value={form.reason} onChange={(event) => updateField("reason", event.target.value)} />
            </div>
          </div>

          {specialtyError ? (
            <p className="storefront-appointment__option-error" role="alert">
              {specialtyError}
              <button type="button" onClick={() => setSpecialtyRetry((value) => value + 1)}>Retry</button>
            </p>
          ) : null}
          {doctorError ? (
            <p className="storefront-appointment__option-error" role="alert">
              {doctorError}
              <button type="button" onClick={() => setDoctorRetry((value) => value + 1)}>Retry</button>
            </p>
          ) : null}

          <p className="storefront-appointment__support">Our clinic is equipped with modern facilities and advanced medical technology to ensure accurate diagnoses and effective treatments.</p>

          {message ? (
            <p
              className={`storefront-appointment__feedback storefront-appointment__feedback--${message.tone}`}
              role={message.tone === "error" ? "alert" : "status"}
            >
              {message.text}
            </p>
          ) : null}

          <StorefrontButton type="submit" size="compact" iconPosition="leading" disabled={isSubmitting || isLoadingSpecialties || specialties.length === 0} icon={<Image src="/icons/storefront/appointment/cta.svg" alt="" width={34} height={34} />}>
            {isSubmitting ? "Submitting..." : "Make an appointment"}
          </StorefrontButton>
        </form>
      </div>
    </section>
  );
}
