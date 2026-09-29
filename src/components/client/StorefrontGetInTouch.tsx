import Image from "next/image";

type ContactLine = {
  accent?: boolean;
  href?: string;
  label?: string;
  value: string;
};

type ContactItem = {
  icon: string;
  id: string;
  lines: readonly ContactLine[];
  title: string;
};

const contactItems: readonly ContactItem[] = [
  {
    id: "contact",
    icon: "/icons/storefront/contact/mail.svg",
    title: "Contact Us",
    lines: [
      {
        accent: true,
        href: "tel:+1890123456",
        label: "Call us: ",
        value: "+1890 123 456",
      },
      {
        href: "mailto:support@example.com",
        label: "Email: ",
        value: "support@example.com",
      },
    ],
  },
  {
    id: "hours",
    icon: "/icons/storefront/contact/clock.svg",
    title: "Opening Hours",
    lines: [
      { value: "Mon - Sat: 7.00 am - 8.00 pm" },
      { value: "Sunday: 8.00 am - 6.00 pm" },
    ],
  },
  {
    id: "office",
    icon: "/icons/storefront/contact/location.svg",
    title: "Our Office",
    lines: [
      { value: "5609 E Sprague Ave, Spokane Valley, WA 99212, USA" },
    ],
  },
] as const;

export default function StorefrontGetInTouch() {
  return (
    <section
      aria-labelledby="storefront-get-in-touch-title"
      className="storefront-get-in-touch"
    >
      <div className="storefront-get-in-touch__container">
        <header className="storefront-get-in-touch__header">
          <div className="storefront-get-in-touch__heading">
            <div className="storefront-get-in-touch__eyebrow">
              <Image
                alt=""
                aria-hidden="true"
                height={20}
                src="/icons/storefront/contact/eyebrow.svg"
                width={20}
              />
              <span>Get In Touch</span>
            </div>
            <h2
              className="storefront-heading storefront-heading-2 storefront-get-in-touch__title"
              id="storefront-get-in-touch-title"
            >
              Immediate medical assistance hotline
            </h2>
          </div>
          <p className="storefront-body storefront-get-in-touch__description">
            Whether you&apos;re experiencing a medical emergency or seeking
            urgent medical advice, our dedicated team of healthcare
            professionals is here to assist you.
          </p>
        </header>

        <div className="storefront-get-in-touch__items">
          {contactItems.map((item) => (
            <article className="storefront-get-in-touch__item" key={item.id}>
              <span aria-hidden="true" className="storefront-get-in-touch__icon">
                <Image alt="" height={24} src={item.icon} width={24} />
              </span>
              <div className="storefront-get-in-touch__item-content">
                <h3>{item.title}</h3>
                <div className="storefront-get-in-touch__lines">
                  {item.lines.map((line) => (
                    <p key={`${line.label ?? ""}${line.value}`}>
                      {line.label}
                      {line.href ? (
                        <a
                          className={
                            line.accent
                              ? "storefront-get-in-touch__link storefront-get-in-touch__link--accent"
                              : "storefront-get-in-touch__link"
                          }
                          href={line.href}
                        >
                          {line.value}
                        </a>
                      ) : (
                        line.value
                      )}
                    </p>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
