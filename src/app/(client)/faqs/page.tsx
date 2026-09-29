import type { Metadata } from "next";

import StorefrontBreadcrumb from "@/components/client/StorefrontBreadcrumb";
import StorefrontFaqs from "@/components/client/StorefrontFaqs";

export const metadata: Metadata = {
  title: "FAQs | BigMedix",
};

export default function FaqsPage() {
  return (
    <>
      <StorefrontBreadcrumb
        backgroundImage="/images/storefront/doctor-list/breadcrumb-hero.png"
        items={[
          { label: "Homepage", href: "/" },
          { label: "Faqs" },
        ]}
        title="Faqs Page"
      />
      <StorefrontFaqs />
    </>
  );
}
