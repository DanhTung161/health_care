import Image from "next/image";

import { StorefrontButton } from "@/components/client/StorefrontButton";

export default function StorefrontHero() {
  return (
    <section className="storefront-hero" aria-labelledby="storefront-hero-title">
      <div className="storefront-hero__decor" aria-hidden="true">
        <Image
          className="storefront-hero__stripes"
          src="/icons/storefront/hero/diagonal-stripes.svg"
          alt=""
          width={1234}
          height={1152}
        />
        <Image
          className="storefront-hero__hex storefront-hero__hex--left"
          src="/icons/storefront/hero/hex-pattern-left.svg"
          alt=""
          width={380}
          height={320}
        />
        <Image
          className="storefront-hero__hex storefront-hero__hex--right"
          src="/icons/storefront/hero/hex-pattern-right.svg"
          alt=""
          width={380}
          height={320}
        />
      </div>

      <div className="storefront-hero__content">
        <div className="storefront-hero__eyebrow">
          <Image
            src="/icons/storefront/hero/trust-shield.svg"
            alt=""
            width={20}
            height={20}
          />
          <span>The best health care services</span>
        </div>

        <h1 id="storefront-hero-title" className="storefront-hero__title">
          Get the care you need &amp; faster.
        </h1>

        <p className="storefront-hero__description">
          Now you can hold your spot at any urgent care location before you
          arrive.
        </p>

        <div className="storefront-hero__trust-row">
          <StorefrontButton
            className="storefront-hero__cta"
            href="/contact"
            icon={
              <svg
                className="storefront-hero__cta-icon"
                width="34"
                height="34"
                viewBox="0 0 34 34"
                aria-hidden="true"
              >
                <use href="/icons/storefront/hero/cta-arrow.svg#cta-arrow-icon" />
              </svg>
            }
            iconPosition="leading"
          >
            Discover Now
          </StorefrontButton>

          <div className="storefront-hero__rating">
            <Image
              src="/icons/storefront/hero/rating-stars.svg"
              alt="5 out of 5 stars"
              width={85}
              height={16}
            />
            <span>5.0/1905 Ratings</span>
          </div>

          <div className="storefront-hero__customers">
            <strong>99%</strong>
            <span>Happy customers</span>
          </div>
        </div>
      </div>

      <div className="storefront-hero__visual">
        <div className="storefront-hero__portrait-disc" aria-hidden="true" />
        <div className="storefront-hero__doctor-frame">
          <Image
            className="storefront-hero__doctor"
            src="/images/storefront/home/hero-doctor.png"
            alt="BigMedix doctor holding a clipboard"
            width={2000}
            height={1333}
            sizes="(min-width: 1600px) 1521px, (min-width: 1200px) 1272px, (min-width: 768px) 1248px, 210vw"
            preload
          />
        </div>
        <svg
          className="storefront-hero__quality-badge"
          viewBox="0 0 200 200"
          aria-hidden="true"
        >
          <g opacity="0.9">
            <use href="/icons/storefront/hero/quality-care-badge.svg#quality-care-background" />
            <use
              className="storefront-hero__quality-badge-text-ring"
              href="/icons/storefront/hero/quality-care-badge.svg#quality-care-copy"
            />
            <use href="/icons/storefront/hero/quality-care-badge.svg#quality-care-mark" />
          </g>
        </svg>
      </div>

      <div id="hero-results" className="storefront-hero__statistics">
        <div className="storefront-hero__statistics-copy">
          <strong>190K+</strong>
          <p>Cured satisfied patients around the globe</p>
        </div>
        <div className="storefront-hero__statistics-team">
          <div className="storefront-hero__avatars" aria-hidden="true">
            <span className="storefront-hero__avatar storefront-hero__avatar--one">
              <Image
                src="/images/storefront/home/hero-doctor-avatar-1.png"
                alt=""
                width={60}
                height={60}
              />
            </span>
            <span className="storefront-hero__avatar storefront-hero__avatar--two">
              <Image
                src="/images/storefront/home/hero-doctor-avatar-2.png"
                alt=""
                width={60}
                height={60}
              />
            </span>
            <span className="storefront-hero__avatar storefront-hero__avatar--three">
              <Image
                src="/images/storefront/home/hero-doctor-avatar-3.png"
                alt=""
                width={60}
                height={60}
              />
            </span>
          </div>
          <p>A team of highly experienced doctors</p>
        </div>
      </div>
    </section>
  );
}
