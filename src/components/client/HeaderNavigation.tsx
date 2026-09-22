"use client";

import Link from "next/link";
import { useId, useState } from "react";

interface NavigationChild {
  label: string;
  href?: string;
}

interface NavigationItem {
  label: string;
  href?: string;
  children?: readonly NavigationChild[];
  menuWidth?: "compact" | "wide";
}

const navigationItems: readonly NavigationItem[] = [
  { label: "Home", href: "/" },
  {
    label: "Services",
    menuWidth: "compact",
    children: [
      { label: "Services 01" },
      { label: "Service Single" },
    ],
  },
  {
    label: "Pages",
    menuWidth: "wide",
    children: [
      { label: "Our Doctors - Style 01" },
      { label: "Doctor Single Detail" },
    ],
  },
  { label: "Shop", href: "/shop" },
  {
    label: "Blog",
    menuWidth: "compact",
    children: [{ label: "Blog Grid", href: "/blog" }],
  },
  { label: "Contact", href: "/contact" },
] as const;

function ChildItem({ child }: { child: NavigationChild }) {
  const className = "storefront-header__submenu-item";

  return child.href ? (
    <Link className={className} href={child.href}>
      {child.label}
    </Link>
  ) : (
    <span
      aria-disabled="true"
      className={`${className} storefront-header__submenu-item--unavailable`}
      role="link"
      tabIndex={0}
    >
      {child.label}
    </span>
  );
}

function DirectItem({
  item,
  mobile,
}: {
  item: NavigationItem;
  mobile: boolean;
}) {
  const className = [
    "storefront-header__nav-item",
    item.label === "Home" ? "storefront-header__nav-item--active" : "",
    mobile ? "storefront-header__nav-item--mobile" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return item.href ? (
    <Link className={className} href={item.href}>
      {item.label}
    </Link>
  ) : (
    <span
      aria-disabled="true"
      className={`${className} storefront-header__nav-item--unavailable`}
    >
      {item.label}
    </span>
  );
}

export default function HeaderNavigation({
  variant,
}: {
  variant: "desktop" | "mobile";
}) {
  const [openLabel, setOpenLabel] = useState<string | null>(null);
  const idPrefix = useId();
  const mobile = variant === "mobile";

  return navigationItems.map((item) => {
    if (!item.children) {
      return <DirectItem item={item} key={item.label} mobile={mobile} />;
    }

    const isOpen = openLabel === item.label;
    const menuId = `${idPrefix}-${item.label.toLowerCase()}`;

    if (mobile) {
      return (
        <div className="storefront-header__mobile-nav-group" key={item.label}>
          <button
            aria-controls={menuId}
            aria-expanded={isOpen}
            className="storefront-header__nav-item storefront-header__nav-item--mobile storefront-header__nav-trigger"
            onClick={() =>
              setOpenLabel((current) =>
                current === item.label ? null : item.label,
              )
            }
            type="button"
          >
            <span>{item.label}</span>
            <span aria-hidden="true" className="storefront-header__chevron" />
          </button>
          {isOpen ? (
            <div
              aria-label={`${item.label} submenu`}
              className="storefront-header__mobile-submenu"
              id={menuId}
            >
              {item.children.map((child) => (
                <ChildItem child={child} key={child.label} />
              ))}
            </div>
          ) : null}
        </div>
      );
    }

    return (
      <div
        className="storefront-header__nav-group"
        key={item.label}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setOpenLabel(null);
          }
        }}
        onFocus={() => setOpenLabel(item.label)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpenLabel(null);
            event.currentTarget.querySelector("button")?.focus();
          }
        }}
        onMouseEnter={() => setOpenLabel(item.label)}
        onMouseLeave={() => setOpenLabel(null)}
      >
        <button
          aria-controls={menuId}
          aria-expanded={isOpen}
          className="storefront-header__nav-item storefront-header__nav-trigger"
          type="button"
        >
          <span>{item.label}</span>
          <span aria-hidden="true" className="storefront-header__chevron" />
        </button>
        {isOpen ? (
          <div
            aria-label={`${item.label} submenu`}
            className="storefront-header__submenu"
            id={menuId}
          >
            <div
              className={`storefront-header__submenu-card storefront-header__submenu-card--${item.menuWidth}`}
            >
              {item.children.map((child) => (
                <ChildItem child={child} key={child.label} />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    );
  });
}
