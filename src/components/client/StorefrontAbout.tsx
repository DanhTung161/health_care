import Image from "next/image";

import { StorefrontButton } from "@/components/client/StorefrontButton";

type AboutFeatureProps = {
  description: string;
  framedIcon?: boolean;
  icon: string;
  iconClassName?: string;
  title: string;
};

function AboutFeature({
  description,
  framedIcon = false,
  icon,
  iconClassName,
  title,
}: AboutFeatureProps) {
  return (
    <article className="storefront-about__feature">
      <span
        className={`storefront-about__feature-icon${framedIcon ? " storefront-about__feature-icon--framed" : ""}`}
        aria-hidden="true"
      >
        <Image
          className={iconClassName}
          src={icon}
          alt=""
          width={80}
          height={80}
        />
      </span>
      <div className="storefront-about__feature-copy">
        <h3 className="storefront-heading storefront-heading-6">{title}</h3>
        <p className="storefront-body">{description}</p>
      </div>
    </article>
  );
}

export default function StorefrontAbout() {
  return (
    <section className="storefront-about" aria-labelledby="storefront-about-title">
      <div className="storefront-about__inner">
        <div className="storefront-about__content">
          <div className="storefront-about__eyebrow">
            <Image
              src="/icons/storefront/about/eyebrow.svg"
              alt=""
              width={20}
              height={20}
            />
            <span>Who we are</span>
          </div>

          <h2
            id="storefront-about-title"
            className="storefront-heading storefront-heading-2 storefront-about__title"
          >
            We have helped 1500+ families nationwide in health
          </h2>

          <p className="storefront-body storefront-about__description">
            Discover the heart behind our mental health platform. At our core,
            we are a compassionate community of experts dedicated to guiding
            you on your journey to emotional well-being and resilience.
          </p>

          <div className="storefront-about__features">
            <AboutFeature
              title="Professional & Trustworthy"
              description="Good medical professionals uphold high personal and professional standards of conduct."
              framedIcon
              icon="/icons/storefront/about/professional.svg"
              iconClassName="storefront-about__feature-icon--professional"
            />
            <AboutFeature
              title="Warm & Reassuring"
              description="We found that having a doctor who is warm and reassuring actually improves your health."
              icon="/icons/storefront/about/warm-reassuring.svg"
            />
          </div>

          <div className="storefront-about__actions">
            <StorefrontButton
              className="storefront-about__cta"
              href="/appointments"
              icon={
                <svg
                  className="storefront-about__cta-icon"
                  width="34"
                  height="34"
                  viewBox="0 0 34 34"
                  aria-hidden="true"
                >
                  <use href="/icons/storefront/hero/cta-arrow.svg#cta-arrow-icon" />
                </svg>
              }
              iconPosition="leading"
              size="compact"
            >
              Appointment now
            </StorefrontButton>

            <div className="storefront-about__support">
              <Image
                src="/icons/storefront/about/phone.svg"
                alt=""
                width={24}
                height={24}
              />
              <span>
                24/7 Support:{" "}
                <a href="tel:+1890123456">+1890 123 456</a>
              </span>
            </div>
          </div>
        </div>

        <div className="storefront-about__visual">
          <div className="storefront-about__main-image">
            <Image
              src="/images/storefront/about/doctor-with-newborn.png"
              alt="Doctor holding a newborn baby"
              width={1380}
              height={773}
              sizes="(min-width: 1300px) 560px, (min-width: 1024px) 46vw, 82vw"
            />
          </div>
          <div className="storefront-about__secondary-image">
            <Image
              src="/images/storefront/about/care-team-with-patient.png"
              alt="Medical professional supporting an older patient"
              width={996}
              height={664}
              sizes="(min-width: 1300px) 300px, (min-width: 1024px) 25vw, 44vw"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
