"use client";

import Image from "next/image";
import type { FormEvent } from "react";

import { StorefrontButton } from "@/components/client/StorefrontButton";

const openingHours = [
  ["Monday - Friday", "9AM - 10PM"],
  ["Saturday", "9AM - 10PM"],
  ["Sunday", "10AM - 5PM"],
] as const;

export default function StorefrontAppointment() {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

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

        <form className="storefront-appointment__form" onSubmit={handleSubmit}>
          <div className="storefront-appointment__fields">
            <div className="storefront-appointment__field">
              <label className="storefront-appointment__sr-only" htmlFor="appointment-name">Your name</label>
              <input id="appointment-name" name="name" type="text" autoComplete="name" placeholder=" " required />
              <span className="storefront-appointment__placeholder" aria-hidden="true">Your name<span>*</span></span>
            </div>
            <div className="storefront-appointment__field">
              <label className="storefront-appointment__sr-only" htmlFor="appointment-email">Your email</label>
              <input id="appointment-email" name="email" type="email" autoComplete="email" placeholder=" " required />
              <span className="storefront-appointment__placeholder" aria-hidden="true">Your email<span>*</span></span>
            </div>
            <div className="storefront-appointment__field">
              <label className="storefront-appointment__sr-only" htmlFor="appointment-phone">Your phone</label>
              <input id="appointment-phone" name="phone" type="tel" autoComplete="tel" placeholder=" " required />
              <span className="storefront-appointment__placeholder" aria-hidden="true">Your phone<span>*</span></span>
            </div>
            <div className="storefront-appointment__field storefront-appointment__field--icon">
              <label className="storefront-appointment__sr-only" htmlFor="appointment-date">Appointment date</label>
              <input id="appointment-date" name="date" type="date" defaultValue="2025-02-10" />
              <Image src="/icons/storefront/appointment/calendar.svg" alt="" width={24} height={24} aria-hidden="true" />
            </div>
            <div className="storefront-appointment__field storefront-appointment__field--icon">
              <label className="storefront-appointment__sr-only" htmlFor="appointment-service">Choose service</label>
              <select id="appointment-service" name="service" defaultValue="">
                <option value="" disabled>Choose service</option>
              </select>
              <Image src="/icons/storefront/appointment/chevron-down.svg" alt="" width={24} height={24} aria-hidden="true" />
            </div>
            <div className="storefront-appointment__field storefront-appointment__field--icon">
              <label className="storefront-appointment__sr-only" htmlFor="appointment-doctor">Choose doctor</label>
              <select id="appointment-doctor" name="doctor" defaultValue="">
                <option value="" disabled>Choose doctor</option>
              </select>
              <Image src="/icons/storefront/appointment/chevron-down.svg" alt="" width={24} height={24} aria-hidden="true" />
            </div>
            <div className="storefront-appointment__field storefront-appointment__field--note">
              <label className="storefront-appointment__sr-only" htmlFor="appointment-note">Appointment note</label>
              <textarea id="appointment-note" name="note" placeholder="Type appointment note" />
            </div>
          </div>

          <p className="storefront-appointment__support">Our clinic is equipped with modern facilities and advanced medical technology to ensure accurate diagnoses and effective treatments.</p>

          <StorefrontButton type="submit" size="compact" iconPosition="leading" icon={<Image src="/icons/storefront/appointment/cta.svg" alt="" width={34} height={34} />}>
            Make an appointment
          </StorefrontButton>
        </form>
      </div>
    </section>
  );
}