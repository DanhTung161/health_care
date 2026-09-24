import StorefrontShell from "@/components/client/StorefrontShell";
import StorefrontAbout from "@/components/client/StorefrontAbout";
import StorefrontHero from "@/components/client/StorefrontHero";
import StorefrontMission from "@/components/client/StorefrontMission";
import OurPricing from "@/components/client/OurPricing";
import StorefrontProjects from "@/components/client/StorefrontProjects";
import StorefrontServices from "@/components/client/StorefrontServices";
import StorefrontTestimonials from "@/components/client/StorefrontTestimonials";
import StorefrontWhyUs from "@/components/client/StorefrontWhyUs";

export default function HomePage() {
  return (
    <StorefrontShell>
      <StorefrontHero />
      <StorefrontAbout />
      <StorefrontMission />
      <StorefrontServices />
      <StorefrontWhyUs />
      <StorefrontProjects />
      <StorefrontTestimonials />
      <OurPricing />
    </StorefrontShell>
  );
}
