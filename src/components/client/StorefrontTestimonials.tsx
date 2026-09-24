"use client";

import Image from "next/image";
import { A11y, Pagination } from "swiper/modules";
import type { Swiper as SwiperInstance } from "swiper";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/pagination";

type Testimonial = {
  avatar: string;
  name: string;
  quote: string;
  role: string;
};

const testimonials: readonly Testimonial[] = [
  {
    name: "Shaun Larsen",
    role: "Investment Analyst",
    avatar: "/images/storefront/testimonials/shaun-larsen.png",
    quote:
      "\"BigMedix gave me the strength to overcome my anxiety. The compassionate therapists provided unwavering support, and I've found a renewed sense of purpose and\u2026\u201d",
  },
  {
    name: "Hannes Wettstein",
    role: "CEO & Founder",
    avatar: "/images/storefront/testimonials/hannes-wettstein.png",
    quote:
      "\"The staff is friendly, the office is clean and modern, and Dr. Martinez always takes the time to explain my treatment options. I\u2019m so happy with my smile!\"",
  },
  {
    name: "Roberto Martins",
    role: "Architect",
    avatar: "/images/storefront/testimonials/roberto-martins.png",
    quote:
      "\u201cThe supportive online community on BigMedix has been an invaluable source of comfort. Knowing that I'm not alone and I can connect with others who...\"",
  },
  {
    name: "Diane Iverson",
    role: "Customs Officer",
    avatar: "/images/storefront/testimonials/diane-iverson.png",
    quote:
      "\u201cBigMedix has been a true lifeline for me during my darkest moments. As someone who has battled anxiety and depression for years, finding a platform like...\"",
  },
  {
    name: "Lisa Wallace",
    role: "HR Manager",
    avatar: "/images/storefront/testimonials/Lisa-Wallace.png",
    quote:
      "\"BigMedix truly transformed my approach to life's challenges. With their support, I gained invaluable skills that allowed me to thrive both personally and professionally...\"",
  },
] as const;

function getSlidesOffset(viewportWidth: number) {
  if (viewportWidth >= 1440) {
    return Math.max((viewportWidth - 1290) / 2, 24);
  }

  if (viewportWidth >= 1200) return 30;
  if (viewportWidth >= 768) return 72;
  return 32;
}

function syncSlidesOffset(swiper: SwiperInstance) {
  swiper.params.slidesOffsetBefore = getSlidesOffset(window.innerWidth);
}

export default function StorefrontTestimonials() {
  return (
    <section className="storefront-testimonials" aria-labelledby="storefront-testimonials-title">
      <div className="storefront-testimonials__decor" aria-hidden="true">
        <Image
          className="storefront-testimonials__decor-left"
          src="/icons/storefront/testimonials/background-left.svg"
          alt=""
          width={380}
          height={320}
        />
        <Image
          className="storefront-testimonials__decor-right-top"
          src="/icons/storefront/testimonials/background-right-top.svg"
          alt=""
          width={600}
          height={600}
        />
        <Image
          className="storefront-testimonials__decor-right"
          src="/icons/storefront/testimonials/background-right.svg"
          alt=""
          width={380}
          height={320}
        />
      </div>

      <header className="storefront-testimonials__header">
        <div className="storefront-testimonials__heading">
          <div className="storefront-testimonials__eyebrow">
            <Image
              src="/icons/storefront/testimonials/eyebrow.svg"
              alt=""
              width={20}
              height={20}
              aria-hidden="true"
            />
            <span>Testimonials</span>
          </div>
          <h2
            id="storefront-testimonials-title"
            className="storefront-heading storefront-heading-2 storefront-testimonials__title"
          >
            {"Our patients\u2019 experiences speak for themselves"}
          </h2>
        </div>

        <div className="storefront-testimonials__review-summary">
          <div className="storefront-testimonials__customer-metric">
            <strong>256K+</strong>
            <span>Happy customer reviews</span>
          </div>
          <span className="storefront-testimonials__review-divider" aria-hidden="true" />
          <div className="storefront-testimonials__rating">
            <div className="storefront-testimonials__rating-row">
              <Image
                src="/icons/storefront/testimonials/stars.svg"
                alt="Five-star rating"
                width={97}
                height={18}
              />
              <strong>4.9</strong>
            </div>
            <span>4.9 / 5 Ratings</span>
          </div>
        </div>
      </header>

      <Swiper
        className="storefront-testimonials__swiper"
        modules={[A11y, Pagination]}
        slidesPerView="auto"
        spaceBetween={20}
        initialSlide={1}
        grabCursor
        pagination={{ clickable: true }}
        onBeforeInit={syncSlidesOffset}
        onBeforeResize={syncSlidesOffset}
        a11y={{
          containerMessage: "Patient testimonials carousel",
          itemRoleDescriptionMessage: "Testimonial slide",
          paginationBulletMessage: "Go to testimonial {{index}}",
          slideLabelMessage: "{{index}} of {{slidesLength}}",
        }}
        breakpoints={{
          480: { spaceBetween: 20 },
          768: { spaceBetween: 24 },
          1200: { spaceBetween: 30 },
        }}
      >
        {testimonials.map((testimonial) => (
          <SwiperSlide key={testimonial.name} className="storefront-testimonials__slide">
            <article className="storefront-testimonials__card">
              <Image
                className="storefront-testimonials__quote-icon"
                src="/icons/storefront/testimonials/quote.svg"
                alt=""
                width={36}
                height={36}
                aria-hidden="true"
              />
              <blockquote>
                <p>{testimonial.quote}</p>
              </blockquote>
              <span className="storefront-testimonials__card-divider" aria-hidden="true" />
              <footer className="storefront-testimonials__author">
                <div>
                  <strong>{testimonial.name}</strong>
                  <span>{testimonial.role}</span>
                </div>
                <Image
                  src={testimonial.avatar}
                  alt={`Portrait of ${testimonial.name}`}
                  width={70}
                  height={70}
                  sizes="70px"
                />
              </footer>
            </article>
          </SwiperSlide>
        ))}
      </Swiper>
    </section>
  );
}
