import Image from "next/image";

type WhyUsReason = {
  description: string;
  icon: string;
  label: string;
  metric: string;
  title: string;
};

const reasons: readonly WhyUsReason[] = [
  {
    title: "Enhanced health awareness",
    description: "BigMedix encourages users to stay active through custom goals.",
    metric: "379K+",
    label: "Customers Use",
    icon: "/icons/storefront/why-us/customers.svg",
  },
  {
    title: "Boost in physical activity levels",
    description: "We are recognized in the US and throughout the world for its expertise and care.",
    metric: "129K+",
    label: "Happy Clients",
    icon: "/icons/storefront/why-us/clients.svg",
  },
  {
    title: "Faster response to health changes",
    description: "BigMedix inspires you to keep moving with tailored objectives.",
    metric: "120K+",
    label: "Successful Projects",
    icon: "/icons/storefront/why-us/projects.svg",
  },
] as const;

export default function StorefrontWhyUs() {
  return (
    <section className="storefront-why-us" aria-labelledby="storefront-why-us-title">
      <div className="storefront-why-us__decor" aria-hidden="true">
        <Image className="storefront-why-us__decor-left" src="/icons/storefront/why-us/background-left.svg" alt="" width={380} height={320} />
        <Image className="storefront-why-us__decor-right" src="/icons/storefront/why-us/background-right.svg" alt="" width={380} height={320} />
      </div>

      <div className="storefront-why-us__container">
        <header className="storefront-why-us__header">
          <div className="storefront-why-us__heading">
            <div className="storefront-why-us__eyebrow">
              <Image src="/icons/storefront/why-us/eyebrow.svg" alt="" width={20} height={20} aria-hidden="true" />
              <span>Why Choose Us</span>
            </div>

            <h2 id="storefront-why-us-title" className="storefront-heading storefront-heading-2 storefront-why-us__title">
              Why choose us for health
              <span className="storefront-why-us__title-line">
                <span>tracking</span>
                <span className="storefront-why-us__title-image" aria-hidden="true">
                  <Image src="/images/storefront/why-us/health-monitoring.png" alt="" width={400} height={400} />
                </span>
                <span>monitoring?</span>
              </span>
            </h2>
          </div>

          <p className="storefront-why-us__support storefront-body">
            BigMedix is designed to help you track and understand your health in real time. Whether it&apos;s monitoring vital signs, activity levels, or health patterns.
          </p>
        </header>

        <ul className="storefront-why-us__reasons">
          {reasons.map((reason) => (
            <li key={reason.metric} className="storefront-why-us__reason">
              <h3>{reason.title}</h3>
              <p>{reason.description}</p>
              <div className="storefront-why-us__metric">
                <div>
                  <strong>{reason.metric}</strong>
                  <span>{reason.label}</span>
                </div>
                <Image src={reason.icon} alt="" width={80} height={80} aria-hidden="true" />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
