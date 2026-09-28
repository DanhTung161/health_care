import Image from "next/image";

const footerHighlights = [
  {
    title: "Modern Facilities",
    description: "Multi speciality center with a state of the art facility",
    icon: "facilities",
  },
  {
    title: "Qualified Doctors",
    description: "A team of well experienced doctors you can trust.",
    icon: "qualified-doctors",
  },
  {
    title: "Dedicated Care",
    description: "A promise of dedicated care for a lifetime of well being",
    icon: "dedicated-care",
  },
] as const;

export default function StorefrontFooterTop() {
  return (
    <section
      aria-label="BigMedix care highlights"
      className="storefront-footer-top"
    >
      <Image
        aria-hidden="true"
        alt=""
        className="storefront-footer-top__pattern storefront-footer-top__pattern--left"
        height={320}
        src="/icons/storefront/footer-top/pattern-left.svg"
        width={380}
      />
      <Image
        aria-hidden="true"
        alt=""
        className="storefront-footer-top__pattern storefront-footer-top__pattern--right"
        height={320}
        src="/icons/storefront/footer-top/pattern-right.svg"
        width={380}
      />

      <div className="storefront-footer-top__inner">
        {footerHighlights.map((highlight) => (
          <article className="storefront-footer-top__item" key={highlight.title}>
            {highlight.icon === "facilities" ? (
              <span className="storefront-footer-top__icon storefront-footer-top__icon--facilities">
                <Image
                  aria-hidden="true"
                  alt=""
                  className="storefront-footer-top__icon-circle"
                  height={100}
                  src="/icons/storefront/footer-top/facilities-circle.svg"
                  width={100}
                />
                <Image
                  aria-hidden="true"
                  alt=""
                  className="storefront-footer-top__icon-glyph"
                  height={45}
                  src="/icons/storefront/footer-top/facilities-glyph.svg"
                  width={45}
                />
              </span>
            ) : (
              <span className="storefront-footer-top__icon">
                <Image
                  aria-hidden="true"
                  alt=""
                  className="storefront-footer-top__icon-art"
                  height={100}
                  src={`/icons/storefront/footer-top/${highlight.icon}.svg`}
                  width={100}
                />
              </span>
            )}

            <div className="storefront-footer-top__copy">
              <h2>{highlight.title}</h2>
              <p>{highlight.description}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}