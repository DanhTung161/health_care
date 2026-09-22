import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";

import AccountMenu from "@/components/client/AccountMenu";
import HeaderNavigation from "@/components/client/HeaderNavigation";
import { StorefrontButton } from "@/components/client/StorefrontButton";

function UtilityLink({
  href,
  icon,
  iconHeight,
  iconWidth,
  label,
  showBadge = false,
}: {
  href: string;
  icon: string;
  iconHeight: number;
  iconWidth: number;
  label: string;
  showBadge?: boolean;
}) {
  const glyphStyle: CSSProperties & {
    "--storefront-header-icon": string;
  } = {
    "--storefront-header-icon": `url("${icon}")`,
    width: iconWidth,
    height: iconHeight,
  };

  return (
    <Link aria-label={label} className="storefront-header__utility" href={href}>
      <Image
        aria-hidden="true"
        className="storefront-header__utility-circle"
        src="/icons/storefront/header/utility-circle.svg"
        alt=""
        width={50}
        height={50}
      />
      <span
        aria-hidden="true"
        className="storefront-header__utility-glyph"
        style={glyphStyle}
      />
      {showBadge ? (
        <span className="storefront-header__cart-badge" aria-hidden="true">
          <Image
            aria-hidden="true"
            src="/icons/storefront/header/cart-badge.svg"
            alt=""
            width={20}
            height={20}
          />
          <span aria-hidden="true">0</span>
        </span>
      ) : null}
    </Link>
  );
}

function AppointmentButton() {
  return (
    <StorefrontButton
      className="storefront-header__appointment"
      href="/appointments"
      icon={
        <span
          aria-hidden="true"
          className="storefront-header__appointment-icon"
        />
      }
      iconPosition="leading"
      size="compact"
      variant="secondary"
    >
      Appointment now
    </StorefrontButton>
  );
}

export default function Header() {
  return (
    <header className="storefront-header">
      <div className="storefront-header__inner">
        <details className="storefront-header__mobile-menu">
          <summary>
            <span className="storefront-header__menu-label storefront-header__menu-label--open">
              Open menu
            </span>
            <span className="storefront-header__menu-label storefront-header__menu-label--close">
              Close menu
            </span>
            <Image
              aria-hidden="true"
              className="storefront-header__menu-icon storefront-header__menu-icon--open"
              src="/icons/storefront/header/menu.svg"
              alt=""
              width={24}
              height={24}
            />
            <Image
              aria-hidden="true"
              className="storefront-header__menu-icon storefront-header__menu-icon--close"
              src="/icons/storefront/header/close.svg"
              alt=""
              width={24}
              height={24}
            />
          </summary>
          <div className="storefront-header__mobile-panel">
            <nav aria-label="Mobile primary navigation">
              <HeaderNavigation variant="mobile" />
              <AccountMenu variant="drawer" />
            </nav>
            <AppointmentButton />
          </div>
        </details>

        <Link
          className="storefront-header__brand"
          href="/"
          aria-label="BigMedix home"
        >
          <Image
            src="/brand/bigmedix-logo.svg"
            alt="BigMedix"
            width={199}
            height={42}
            fetchPriority="high"
          />
        </Link>

        <nav
          className="storefront-header__desktop-nav"
          aria-label="Primary navigation"
        >
          <HeaderNavigation variant="desktop" />
        </nav>

        <div className="storefront-header__desktop-actions">
          <div className="storefront-header__utilities" aria-label="Store tools" role="group">
            <UtilityLink
              href="/search"
              icon="/icons/storefront/header/search.svg"
              iconHeight={24}
              iconWidth={24}
              label="Search"
            />
            <UtilityLink
              href="/cart"
              icon="/icons/storefront/header/shopping-bag.svg"
              iconHeight={22}
              iconWidth={19}
              label="Cart, 0 items"
              showBadge
            />
            <AccountMenu />
          </div>
          <AppointmentButton />
        </div>
      </div>
    </header>
  );
}
