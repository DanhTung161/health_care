import type { Metadata } from "next";

import StorefrontBreadcrumb from "@/components/client/StorefrontBreadcrumb";
import StorefrontFaqs from "@/components/client/StorefrontFaqs";
import StorefrontGetInTouch from "@/components/client/StorefrontGetInTouch";

export const metadata: Metadata = {
  title: "Contact Us | BigMedix",
};

export default function ContactPage() {
  return (
    <>
      <StorefrontBreadcrumb
        backgroundImage="/images/storefront/contact/breadcrumb-hero.png"
        items={[
          { label: "Homepage", href: "/" },
          { label: "Contact" },
        ]}
        title="Contact Us"
      />
      <StorefrontGetInTouch />
      <StorefrontFaqs />
    </>
  );
}
