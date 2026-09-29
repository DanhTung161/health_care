import type { Metadata } from "next";

import StorefrontBreadcrumb from "@/components/client/StorefrontBreadcrumb";
import StorefrontProjects from "@/components/client/StorefrontProjects";

export const metadata: Metadata = {
  title: "Project | BigMedix",
};

export default function ProjectsPage() {
  return (
    <>
      <StorefrontBreadcrumb
        backgroundImage="/images/storefront/doctor-list/breadcrumb-hero.png"
        items={[
          { label: "Homepage", href: "/" },
          { label: "Projects" },
        ]}
        title="Project"
      />
      <StorefrontProjects variant="grid" />
    </>
  );
}
