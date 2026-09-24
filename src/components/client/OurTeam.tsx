"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { CSSProperties } from "react";
import { A11y } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";

type Doctor = {
  image: string;
  name: string;
  specialty: string;
};

const doctors: readonly Doctor[] = [
  { name: "Olivia Patel", specialty: "Surgeon", image: "/images/storefront/team/olivia-patel.png" },
  { name: "Leanne Ford", specialty: "Cardiologist", image: "/images/storefront/team/leanne-ford.png" },
  { name: "Lucas Harris", specialty: "Gynecologist", image: "/images/storefront/team/lucas-harris.png" },
  { name: "Isabella Lee", specialty: "Dermatologist", image: "/images/storefront/team/isabella-lee.png" },
  { name: "Jacob Wilson", specialty: "Pediatrician", image: "/images/storefront/team/jacob-wilson.png" },
  { name: "Olivia Martinez", specialty: "Psychiatrist", image: "/images/storefront/team/olivia-martinez.png" },
  { name: "James Carter", specialty: "Dental Assistant", image: "/images/storefront/team/james-carter.png" },
  { name: "Emily Parker", specialty: "Orthodontist", image: "/images/storefront/team/emily-parker.png" },
] as const;

const socialIcons = [
  { label: "Facebook", icon: "/icons/storefront/team/facebook.svg" },
  { label: "Twitter", icon: "/icons/storefront/team/twitter.svg" },
  { label: "Instagram", icon: "/icons/storefront/team/instagram.svg" },
  { label: "Pinterest", icon: "/icons/storefront/team/pinterest.svg" },
] as const;

export default function OurTeam() {
  return (
    <section className="storefront-team" aria-labelledby="storefront-team-title">
      <Image className="storefront-team__decor storefront-team__decor--left" src="/icons/storefront/team/background-left.svg" alt="" width={380} height={320} aria-hidden="true" />
      <Image className="storefront-team__decor storefront-team__decor--right" src="/icons/storefront/team/background-right.svg" alt="" width={380} height={320} aria-hidden="true" />

      <div className="storefront-team__container">
        <header className="storefront-team__header">
          <div className="storefront-team__heading">
            <div className="storefront-team__eyebrow">
              <Image src="/icons/storefront/team/eyebrow.svg" alt="" width={20} height={20} aria-hidden="true" />
              <span>Our Healthcare Experts</span>
            </div>
            <h2 id="storefront-team-title" className="storefront-heading storefront-heading-2 storefront-team__title">
              Meet the teem behind your smile
            </h2>
          </div>

          <p className="storefront-team__intro storefront-body">
            Your smile is in great hands! Our dedicated team of dental professionals is committed to providing exceptional care with a personal touch.
          </p>
        </header>

        <Swiper
          className="storefront-team__swiper"
          modules={[A11y]}
          slidesPerView="auto"
          spaceBetween={30}
          grabCursor
          watchOverflow
          a11y={{
            containerMessage: "Healthcare experts carousel",
            itemRoleDescriptionMessage: "Doctor slide",
            slideLabelMessage: "{{index}} of {{slidesLength}}",
          }}
          breakpoints={{
            0: { spaceBetween: 20 },
            480: { spaceBetween: 24 },
            1200: { spaceBetween: 30 },
          }}
        >
          {doctors.map((doctor) => (
            <SwiperSlide key={doctor.name} className="storefront-team__slide">
              <article className="storefront-team__card" tabIndex={0}>
                <div className="storefront-team__portrait">
                  <Image src={doctor.image} alt={`${doctor.name}, ${doctor.specialty}`} fill sizes="300px" />
                  <div className="storefront-team__socials" aria-hidden="true">
                    {socialIcons.map((social) => (
                      <span className="storefront-team__social" key={social.label} title={social.label}>
                        <span
                          className="storefront-team__social-icon"
                          style={{ "--team-social-icon": `url(${social.icon})` } as CSSProperties}
                        />
                      </span>
                    ))}
                  </div>
                </div>
                <div className="storefront-team__card-copy">
                  <h3>{doctor.name}</h3>
                  <p>{doctor.specialty}</p>
                </div>
              </article>
            </SwiperSlide>
          ))}
        </Swiper>

        <div className="storefront-team__cta-row">
          <Link className="storefront-button storefront-button--primary storefront-button--compact storefront-button--leading" href="/doctor-list">
            <span className="storefront-button__icon" aria-hidden="true">
              <ArrowRight size={16} />
            </span>
            <span>See all Doctors</span>
          </Link>
        </div>
      </div>
    </section>
  );
}