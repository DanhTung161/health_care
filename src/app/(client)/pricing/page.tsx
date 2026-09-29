import type { Metadata } from "next";

import OurPricing from "@/components/client/OurPricing";
import StorefrontBreadcrumb from "@/components/client/StorefrontBreadcrumb";

export const metadata: Metadata = {
  title: "Our Pricing | BigMedix",
};

export default function PricingPage() {
  return (
    <>
      <StorefrontBreadcrumb
        backgroundImage="/images/storefront/doctor-list/breadcrumb-hero.png"
        items={[
          { label: "Homepage", href: "/" },
          { label: "Pages" },
        ]}
        title="Our Pricing"
      />
      <OurPricing />
    </>
  );
}
