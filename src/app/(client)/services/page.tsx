import type { Metadata } from "next";

import StorefrontAppointment from "@/components/client/StorefrontAppointment";
import StorefrontBreadcrumb from "@/components/client/StorefrontBreadcrumb";
import StorefrontServices from "@/components/client/StorefrontServices";
import StorefrontTextRun from "@/components/client/StorefrontTextRun";

export const metadata: Metadata = {
  title: "Services 01 | BigMedix",
};

export default function ServicesPage() {
  return (
    <>
      <StorefrontBreadcrumb
        items={[
          { label: "Homepage", href: "/" },
          { label: "Services" },
        ]}
        title="Services 01"
      />
      <StorefrontServices />
      <div className="storefront-services-page__appointment">
        <StorefrontAppointment />
      </div>
      <StorefrontTextRun />
    </>
  );
}
