import Image from "next/image";
import Link from "next/link";

export interface StorefrontBreadcrumbItem {
  label: string;
  href?: string;
}

export default function StorefrontBreadcrumb({
  backgroundImage = "/images/storefront/breadcrumb/services-hero.png",
  items,
  showTitle = true,
  title,
}: {
  backgroundImage?: string;
  items: readonly StorefrontBreadcrumbItem[];
  showTitle?: boolean;
  title: string;
}) {
  return (
    <section
      aria-label={showTitle ? undefined : title}
      aria-labelledby={showTitle ? "storefront-breadcrumb-title" : undefined}
      className={
        showTitle
          ? "storefront-breadcrumb"
          : "storefront-breadcrumb storefront-breadcrumb--titleless"
      }
    >
      <Image
        alt=""
        className="storefront-breadcrumb__background"
        fill
        preload
        sizes="calc(100vw - 40px)"
        src={backgroundImage}
      />
      <div
        aria-hidden="true"
        className="storefront-breadcrumb__overlay"
      />

      <div className="storefront-breadcrumb__content">
        {showTitle ? <h1 id="storefront-breadcrumb-title">{title}</h1> : null}
        <nav aria-label="Breadcrumb">
          <ol>
            {items.map((item, index) => (
              <li key={`${item.label}-${index}`}>
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