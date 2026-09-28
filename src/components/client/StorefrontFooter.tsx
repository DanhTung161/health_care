import Image from "next/image";
import Link from "next/link";

type FooterItem = {
  label: string;
  href?: string;
};

const aboutCompany: readonly FooterItem[] = [
  { label: "Home", href: "/" },
  { label: "About Us" },
  { label: "Careers" },
  { label: "Feedback" },
  { label: "Gallery" },
  { label: "Contact Us", href: "/contact" },
];

const usefulLinks: readonly FooterItem[] = [
  { label: "Specialities" },
  { label: "Doctors", href: "/doctor-list" },
  { label: "Health Checkups" },
  { label: "News & Updates", href: "/blog" },
  { label: "Insurance Partners" },
  { label: "Promotions & Updates" },
];

const ourServices: readonly FooterItem[] = [
  { label: "Dentistry" },
  { label: "Cosmetology" },
  { label: "Psychiatry" },
  { label: "Ophthalmology" },
  { label: "Orthopedics" },
  { label: "Pathology" },
];

const socialIcons = ["facebook", "twitter", "instagram", "pinterest"] as const;

function FooterNavigation({
  items,
  label,
  title,
}: {
  items: readonly FooterItem[];
  label: string;
  title: string;
}) {
  return (
    <nav aria-label={label} className="storefront-footer__column">
      <h2>{title}</h2>
      <ul>
        {items.map((item) => (
          <li key={item.label}>
            {item.href ? (
              <Link href={item.href}>{item.label}</Link>
            ) : (
              <span>{item.label}</span>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}

export default function StorefrontFooter() {
  return (
    <footer className="storefront-footer">
      <div className="storefront-footer__main">
        <div className="storefront-footer__brand-column">
          <Link
            aria-label="BigMedix home"
            className="storefront-footer__brand"
            href="/"
          >
            <Image
              aria-hidden="true"
              alt=""
              height={36}
              src="/brand/bigmedix-icon.svg"
              width={36}
            />
            <span>BigMedix</span>
          </Link>
          <p>
            Your trusted partner in comprehensive healthcare. Discover quality
            health to meet your needs.
          </p>
          <div aria-label="Social networks" className="storefront-footer__socials">
            {socialIcons.map((social) => (
              <span
                aria-label={`${social[0].toUpperCase()}${social.slice(1)} social icon`}
                className={`storefront-footer__social storefront-footer__social--${social}`}
                key={social}
                role="img"
                tabIndex={0}
                title={`${social[0].toUpperCase()}${social.slice(1)} link unavailable`}
              >
                <Image
                  aria-hidden="true"
                  alt=""
                  height={20}
                  src={`/icons/storefront/footer/${social}.svg`}
                  width={20}
                />
              </span>
            ))}
          </div>
        </div>

        <section className="storefront-footer__column storefront-footer__office">
          <h2>Office Address</h2>
          <address>
            <p>5609 E Sprague Ave, Spokane Valley, WA 99212, USA</p>
            <a href="tel:+1890123456">+1890 123 456</a>
            <a href="tel:+1890123678">+1890 123 678</a>
            <a href="mailto:support@example.com">support@example.com</a>
          </address>
        </section>

        <FooterNavigation
          items={aboutCompany}
          label="About company"
          title="About Company"
        />
        <FooterNavigation
          items={usefulLinks}
          label="Useful links"
          title="Useful Links"
        />
        <FooterNavigation
          items={ourServices}
          label="Our services"
          title="Our Services"
        />
      </div>

      <div className="storefront-footer__bottom">
        <div className="storefront-footer__bottom-inner">
          <p>
            Copyright © 2025{" "}
            <Link className="storefront-footer__copyright-brand" href="/">
              BigMedix
            </Link>
            . All rights reserved
          </p>
          <div className="storefront-footer__legal" aria-label="Legal information">
            <span>Privacy &amp; Cookie Policy</span>
            <span>Terms of Service</span>
          </div>
          <a className="storefront-footer__back-to-top" href="#storefront-top">
            <span>Back to the top</span>
            <svg aria-hidden="true" viewBox="0 0 12.9636 13.3333">
              <path
                d="M7.31515 3.19036V13.3333H5.64848V3.19036L1.17852 7.66033L0 6.48183L6.48182 0L12.9637 6.48183L11.7852 7.66033L7.31515 3.19036Z"
                fill="currentColor"
              />
            </svg>
          </a>
        </div>
      </div>
    </footer>
  );
}