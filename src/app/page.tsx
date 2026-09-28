import StorefrontShell from "@/components/client/StorefrontShell";
import StorefrontAbout from "@/components/client/StorefrontAbout";
import StorefrontAppointment from "@/components/client/StorefrontAppointment";
import StorefrontBlog from "@/components/client/StorefrontBlog";
import StorefrontFooter from "@/components/client/StorefrontFooter";
import StorefrontFooterTop from "@/components/client/StorefrontFooterTop";
import StorefrontHero from "@/components/client/StorefrontHero";
import StorefrontMission from "@/components/client/StorefrontMission";
import OurPricing from "@/components/client/OurPricing";
import OurTeam from "@/components/client/OurTeam";
import StorefrontProjects from "@/components/client/StorefrontProjects";
import StorefrontServices from "@/components/client/StorefrontServices";
import StorefrontTestimonials from "@/components/client/StorefrontTestimonials";
import StorefrontTextRun from "@/components/client/StorefrontTextRun";
import StorefrontWhyUs from "@/components/client/StorefrontWhyUs";

export default function HomePage() {
  return (
    <StorefrontShell
      footer={
        <>
          <StorefrontFooterTop />
          <StorefrontFooter />
        </>
      }
    >
      <StorefrontHero />
      <StorefrontAbout />
      <StorefrontMission />
      <StorefrontServices />
      <StorefrontWhyUs />
      <StorefrontProjects />
      <StorefrontTestimonials />
      <OurPricing />
      <OurTeam />
      <StorefrontBlog />
      <StorefrontAppointment />
      <StorefrontTextRun />
    </StorefrontShell>
  );
}
