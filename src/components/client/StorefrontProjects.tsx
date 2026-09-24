"use client";

import Image from "next/image";
import Link from "next/link";
import { A11y } from "swiper/modules";
import type { Swiper as SwiperInstance } from "swiper";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";

type StorefrontProject = {
  alt: string;
  category: string;
  href: string;
  image: string;
  title: string;
};

const projects: readonly StorefrontProject[] = [
  {
    title: "Visionary Ventures",
    category: "Treatments",
    href: "/shop",
    image: "/images/storefront/projects/female-clinician.png",
    alt: "A clinician caring for a young patient",
  },
  {
    title: "Visionary Ventures",
    category: "Treatments",
    href: "/shop",
    image: "/images/storefront/projects/senior-patient-care.png",
    alt: "A clinician with a senior patient",
  },
  {
    title: "Visionary Ventures",
    category: "Treatments",
    href: "/shop",
    image: "/images/storefront/projects/doctor-with-newborn.png",
    alt: "A doctor holding a newborn",
  },
  {
    title: "Visionary Ventures",
    category: "Treatments",
    href: "/shop",
    image: "/images/storefront/projects/hospital-clinician.png",
    alt: "A clinician in a hospital",
  },
] as const;

function getSlidesOffset(viewportWidth: number) {
  if (viewportWidth >= 1440) {
    return Math.max((viewportWidth - 1290) / 2, 24);
  }

  if (viewportWidth >= 1200) return 30;
  if (viewportWidth >= 768) return 72;
  if (viewportWidth >= 480) return 32;
  return 24;
}

function syncSlidesOffset(swiper: SwiperInstance) {
  swiper.params.slidesOffsetBefore = getSlidesOffset(window.innerWidth);
}

export default function StorefrontProjects() {
  return (
    <section className="storefront-projects" aria-labelledby="storefront-projects-title">
      <header className="storefront-projects__header">
        <div className="storefront-projects__heading">
          <div className="storefront-projects__eyebrow">
            <Image src="/icons/storefront/projects/eyebrow.svg" alt="" width={20} height={20} aria-hidden="true" />
            <span>Our Portfolio</span>
          </div>
          <h2 id="storefront-projects-title" className="storefront-heading storefront-heading-2 storefront-projects__title">
            We don&apos;t just care for your health conditions
          </h2>
        </div>

        <p className="storefront-projects__support storefront-body">
          You&apos;ll get care from board certified and fellowship trained experts who work together to create a treatment plan just for you.
        </p>
      </header>

      <Swiper
        className="storefront-projects__swiper"
        modules={[A11y]}
        slidesPerView="auto"
        spaceBetween={30}
        initialSlide={1}
        grabCursor
        onBeforeInit={syncSlidesOffset}
        onBeforeResize={syncSlidesOffset}
        a11y={{
          containerMessage: "Healthcare projects carousel",
          itemRoleDescriptionMessage: "Project slide",
          slideLabelMessage: "{{index}} of {{slidesLength}}",
        }}
        breakpoints={{
          480: { spaceBetween: 20 },
          768: { spaceBetween: 24 },
          1200: { spaceBetween: 30 },
        }}
      >
        {projects.map((project, index) => (
          <SwiperSlide key={`${project.image}-${index}`} className="storefront-projects__slide">
            <article className="storefront-projects__card">
              <Image
                className="storefront-projects__image"
                src={project.image}
                alt={project.alt}
                fill
                sizes="(min-width: 768px) 630px, calc(100vw - 64px)"
              />
              <span className="storefront-projects__overlay" aria-hidden="true" />
              <div className="storefront-projects__card-copy">
                <h3>{project.title}</h3>
                <p>{project.category}</p>
              </div>
              <Link className="storefront-projects__action" href={project.href} aria-label={`View ${project.title}`}>
                <Image src="/icons/storefront/projects/action.svg" alt="" width={48} height={48} aria-hidden="true" />
              </Link>
            </article>
          </SwiperSlide>
        ))}
      </Swiper>
    </section>
  );
}
