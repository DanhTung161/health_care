import StorefrontShell from "@/components/client/StorefrontShell";
import StorefrontAbout from "@/components/client/StorefrontAbout";
import StorefrontHero from "@/components/client/StorefrontHero";

export default function HomePage() {
  return (
    <StorefrontShell>
      <StorefrontHero />
      <StorefrontAbout />
    </StorefrontShell>
  );
}
