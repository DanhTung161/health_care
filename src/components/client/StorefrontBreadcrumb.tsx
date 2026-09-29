import Image from "next/image";
import Link from "next/link";

export interface StorefrontBreadcrumbItem {
  label: string;
  href?: string;
}

export default function StorefrontBreadcrumb({
  items,
  title,
}: {
  items: readonly StorefrontBreadcrumbItem[];
  title: string;
}) {
  return (
    <section
      aria-labelledby="storefront-breadcrumb-title"
      className="storefront-breadcrumb"
    >
      <Image
        alt=""
        className="storefront-breadcrumb__background"
        fill
        preload
        sizes="calc(100vw - 40px)"
        src="/images/storefront/breadcrumb/services-hero.png"
      />
      <div
        aria-hidden="true"
        className="storefront-breadcrumb__overlay"
      />

      <div className="storefront-breadcrumb__content">
        <h1 id="storefront-breadcrumb-title">{title}</h1>
        <nav aria-label="Breadcrumb">
          <ol>
            {items.map((item, index) => (
              <li key={item.label}>
                {item.href ? (
                  <Link href={item.href}>{item.label}</Link>
                ) : (
                  <span aria-current="page">{item.label}</span>
                )}
                {index < items.length - 1 ? (
                  <Image
                    aria-hidden="true"
                    alt=""
                    height={24}
                    src="/icons/storefront/breadcrumb/arrow-right.svg"
                    width={24}
                  />
                ) : null}
              </li>
            ))}
          </ol>
        </nav>
      </div>
    </section>
  );
}
