import Image from "next/image";

import StorefrontMissionTabs from "@/components/client/StorefrontMissionTabs";

type MissionBrand = {
  className: string;
  height: number;
  icon: string;
  name: string;
  width: number;
};

const missionBrands: readonly MissionBrand[] = [
  { name: "CigicHealth", icon: "/icons/storefront/mission/brand-cigichealth.svg", className: "storefront-mission__brand--cigichealth", width: 254, height: 38 },
  { name: "Mediacare", icon: "/icons/storefront/mission/brand-mediacare-primary.svg", className: "storefront-mission__brand--primary", width: 215, height: 40 },
  { name: "Anthonio", icon: "/icons/storefront/mission/brand-anthonio.svg", className: "storefront-mission__brand--anthonio", width: 220, height: 38 },
  { name: "Mediacare", icon: "/icons/storefront/mission/brand-mediacare-secondary.svg", className: "storefront-mission__brand--secondary", width: 215, height: 40 },
  { name: "Nikeune", icon: "/icons/storefront/mission/brand-nikeune.svg", className: "storefront-mission__brand--nikeune", width: 202, height: 40 },
  { name: "Medicasu", icon: "/icons/storefront/mission/brand-medicasu.svg", className: "storefront-mission__brand--medicasu", width: 229, height: 40 },
] as const;

export default function StorefrontMission() {
  return (
    <section className="storefront-mission" aria-labelledby="storefront-mission-title">
      <div className="storefront-mission__decor" aria-hidden="true">
        <Image className="storefront-mission__decor-left" src="/icons/storefront/mission/background-left.svg" alt="" width={380} height={320} />
        <Image className="storefront-mission__decor-right-top" src="/icons/storefront/mission/background-right-top.svg" alt="" width={600} height={600} />
        <Image className="storefront-mission__decor-right-bottom" src="/icons/storefront/mission/background-right.svg" alt="" width={380} height={320} />
      </div>

      <div className="storefront-mission__intro">
        <div className="storefront-mission__eyebrow">
          <Image src="/icons/storefront/mission/eyebrow.svg" alt="" width={20} height={20} />
          <span>Empowering your health</span>
        </div>
        <h2 id="storefront-mission-title" className="storefront-heading storefront-heading-2 storefront-mission__title">
          Committed to exceptional patient centered care
        </h2>
        <p className="storefront-mission__support">
          Our team of skilled professionals is committed to providing personalized, compassionate care.
        </p>
      </div>

      <div className="storefront-mission__content">
        <StorefrontMissionTabs />
      </div>

      <div className="storefront-mission__brands" aria-label="Healthcare partners">
        {missionBrands.map((brand) => (
          <div key={`${brand.name}-${brand.icon}`} className={`storefront-mission__brand ${brand.className}`}>
            <Image src={brand.icon} alt={brand.name} width={brand.width} height={brand.height} />
          </div>
        ))}
      </div>
    </section>
  );
}
