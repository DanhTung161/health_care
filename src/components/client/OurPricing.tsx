"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

type BillingPeriod = "monthly" | "yearly";

type PricingPlan = {
  id: string;
  name: string;
  description: string;
  badge?: string;
  features: readonly string[];
  monthlyPrice: number;
  yearlyPrice: number;
};

const sharedFeatures = [
  "Articles and tips",
  "Activity reminders",
  "Basic health tracking",
  "Weekly wellness check-in",
] as const;

const plans: readonly PricingPlan[] = [
  {
    id: "wellness-starter",
    name: "Wellness Starter Plan",
    description: "Designed to enhance sleep quality with tailored insights.",
    features: sharedFeatures,
    monthlyPrice: 59,
    yearlyPrice: 129,
  },
  {
    id: "sleep-wellness",
    name: "Sleep Wellness Plan",
    description:
      "Ideal for general wellness tracking and building healthy habits.",
    badge: "Popular",
    features: sharedFeatures,
    monthlyPrice: 79,
    yearlyPrice: 159,
  },
  {
    id: "weight-management",
    name: "Weight Management Plan",
    description: "Focus on achieving and maintaining a healthy weight.",
    features: sharedFeatures,
    monthlyPrice: 99,
    yearlyPrice: 179,
  },
] as const;

const billingPeriods: readonly {
  id: BillingPeriod;
  label: string;
}[] = [
  { id: "monthly", label: "Billed monthly" },
  { id: "yearly", label: "Billed yearly" },
] as const;

export default function OurPricing() {
  const [billingPeriod, setBillingPeriod] =
    useState<BillingPeriod>("monthly");

  return (
    <section
      className="storefront-pricing"
      aria-labelledby="storefront-pricing-title"
    >
      <div className="storefront-pricing__container">
        <header className="storefront-pricing__header">
          <div className="storefront-pricing__heading">
            <div className="storefront-pricing__eyebrow">
              <Image
                src="/icons/storefront/pricing/eyebrow.svg"
                alt=""
                width={20}
                height={20}
                aria-hidden="true"
              />
              <span>Our Pricing plan</span>
            </div>
            <h2
              id="storefront-pricing-title"
              className="storefront-heading storefront-heading-2 storefront-pricing__title"
            >
              Choose the right plan for your health journey
            </h2>
          </div>

          <div className="storefront-pricing__intro">
            <p>
              Price transparency in healthcare refers to the availability of
              information about the exact cost of items and services before
              getting them.
            </p>
            <fieldset className="storefront-pricing__periods">
              <legend className="storefront-pricing__sr-only">
                Billing period
              </legend>
              {billingPeriods.map((period) => (
                <label
                  key={period.id}
                  className="storefront-pricing__period"
                >
                  <input
                    type="radio"
                    name="pricing-billing-period"
                    value={period.id}
                    checked={billingPeriod === period.id}
                    onChange={() => setBillingPeriod(period.id)}
                  />
                  <span>{period.label}</span>
                </label>
              ))}
            </fieldset>
          </div>
        </header>

        <div className="storefront-pricing__grid">
          {plans.map((plan) => {
            const price =
              billingPeriod === "monthly"
                ? plan.monthlyPrice
                : plan.yearlyPrice;
            const periodLabel =
              billingPeriod === "monthly" ? "/ month" : "/ year";

            return (
              <article key={plan.id} className="storefront-pricing__card">
                <div className="storefront-pricing__card-content">
                  <div className="storefront-pricing__plan-heading">
                    <h3>{plan.name}</h3>
                    {plan.badge ? (
                      <span className="storefront-pricing__badge">
                        {plan.badge}
                      </span>
                    ) : null}
                  </div>

                  <p className="storefront-pricing__description">
                    {plan.description}
                  </p>

                  <div className="storefront-pricing__features">
                    <h4>Features:</h4>
                    <ul>
                      {plan.features.map((feature) => (
                        <li key={feature}>
                          <Image
                            src="/icons/storefront/pricing/check.svg"
                            alt=""
                            width={17}
                            height={17}
                            aria-hidden="true"
                          />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="storefront-pricing__footer">
                    <p
                      className="storefront-pricing__price"
                      aria-live="polite"
                    >
                      <strong>${price}</strong>
                      <span>{periodLabel}</span>
                    </p>
                    <Link
                      className="storefront-pricing__action"
                      href="/contact"
                      aria-label={`Contact BigMedix about the ${plan.name}`}
                    >
                      <Image
                        src="/icons/storefront/pricing/action.svg"
                        alt=""
                        width={48}
                        height={48}
                        aria-hidden="true"
                      />
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}