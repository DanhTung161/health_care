import Image from "next/image";

type StorefrontService = {
  description: string;
  icon: string;
  iconAccent?: string;
  number: string;
  title: string;
};

const services: readonly StorefrontService[] = [
  {
    number: "01",
    title: "Dentistry",
    description: "Embrace the joy of a radiant smile! Our artistic team crafts dazzling grins with cutting-edge care...",
    icon: "/icons/storefront/services/dentistry.svg",
  },
  {
    number: "02",
    title: "Dermatology",
    description: "Unveil your skin's magic at Medical Center experienced dermatologists, enchanting solutions for skin, hair, and nails.",
    icon: "/icons/storefront/services/dermatology-base.svg",
    iconAccent: "/icons/storefront/services/dermatology-accent.svg",
  },
  {
    number: "03",
    title: "Psychiatry",
    description: "Psychiatric Department at Medical Center is dedicated to provide comprehensive and specialized care for...",
    icon: "/icons/storefront/services/psychiatry.svg",
  },
  {
    number: "04",
    title: "Ophthalmology",
    description: "Comprehensive eye care by experienced ophthalmologists. Vision tests, treatments and friendly service...",
    icon: "/icons/storefront/services/ophthalmology.svg",
  },
  {
    number: "05",
    title: "Orthopedics",
    description: "Discover freedom from pain with BigMedix Orthopedics expertise, your path to a better life.",
    icon: "/icons/storefront/services/orthopedics.svg",
  },
  {
    number: "06",
    title: "Pediatrics",
    description: "We offers expert pediatric services including routine check ups, vaccinations, developmental assessments...",
    icon: "/icons/storefront/services/pediatrics.svg",
  },
] as const;

export default function StorefrontServices() {
  return (
    <section className="storefront-services" aria-labelledby="storefront-services-title">
      <div className="storefront-services__container">
        <header className="storefront-services__header">
          <div className="storefront-services__heading">
            <div className="storefront-services__eyebrow">
              <Image src="/icons/storefront/services/eyebrow.svg" alt="" width={20} height={20} aria-hidden="true" />
              <span>Our Quality Service</span>
            </div>
            <h2 id="storefront-services-title" className="storefront-heading storefront-heading-2 storefront-services__title">
              We provide a wide range of medical services
            </h2>
          </div>

          <p className="storefront-services__support storefront-body">
            We treat you like family, providing compassionate and comprehensive healthcare services tailored to your individual needs.
          </p>
        </header>

        <div className="storefront-services__grid">
          {services.map((service) => (
            <article key={service.number} className="storefront-services__card">
              <div className={`storefront-services__icon${service.iconAccent ? " storefront-services__icon--dermatology" : ""}`} aria-hidden="true">
                <Image src={service.icon} alt="" width={64} height={64} />
                {service.iconAccent ? <Image className="storefront-services__icon-accent" src={service.iconAccent} alt="" width={17} height={17} /> : null}
              </div>
              <span className="storefront-services__number">{service.number}</span>

              <div className="storefront-services__card-copy">
                <h3>{service.title}</h3>
                <p>{service.description}</p>
              </div>

              <span className="storefront-services__learn-more" aria-hidden="true">
                <Image src="/icons/storefront/services/learn-more.svg" alt="" width={34} height={34} />
                <span>Learn More</span>
              </span>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
