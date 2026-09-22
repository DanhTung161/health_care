"use client";

import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { useEffect, useId, useRef, useState } from "react";

const accountIconStyle: CSSProperties & {
  "--storefront-header-icon": string;
} = {
  "--storefront-header-icon":
    'url("/icons/storefront/header/account.svg")',
  width: 18,
  height: 22,
};

function AccountDropdown({ id, onNavigate }: { id: string; onNavigate: () => void }) {
  return (
    <div className="storefront-header__account-dropdown" id={id} role="menu">
      <Link
        className="storefront-header__account-option storefront-header__account-option--available"
        href="/login"
        onClick={onNavigate}
        role="menuitem"
      >
        Sign in
      </Link>
    </div>
  );
}

export default function AccountMenu({ variant = "icon" }: { variant?: "icon" | "drawer" }) {
  const [isOpen, setIsOpen] = useState(false);
  const menuId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !containerRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    }

    function handleFocusIn(event: FocusEvent) {
      if (event.target instanceof Node && !containerRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  if (variant === "drawer") {
    return (
      <div className="storefront-header__account-menu storefront-header__drawer-account" ref={containerRef}>
        <button
          aria-controls={menuId}
          aria-expanded={isOpen}
          aria-haspopup="menu"
          className="storefront-header__nav-item storefront-header__nav-item--mobile storefront-header__drawer-account-trigger"
          onClick={() => setIsOpen((current) => !current)}
          ref={triggerRef}
          type="button"
        >
          <span>Account</span>
          <span aria-hidden="true" className="storefront-header__drawer-account-icon" />
        </button>
        {isOpen ? <AccountDropdown id={menuId} onNavigate={() => setIsOpen(false)} /> : null}
      </div>
    );
  }

  return (
    <div
      className="storefront-header__account-menu storefront-header__account-menu--icon storefront-header__utility--account"
      ref={containerRef}
    >
      <button
        aria-controls={menuId}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label="Account"
        className="storefront-header__utility"
        onClick={() => setIsOpen((current) => !current)}
        ref={triggerRef}
        type="button"
      >
        <Image
          aria-hidden="true"
          alt=""
          className="storefront-header__utility-circle"
          height={50}
          src="/icons/storefront/header/utility-circle.svg"
          width={50}
        />
        <span aria-hidden="true" className="storefront-header__utility-glyph" style={accountIconStyle} />
      </button>
      {isOpen ? <AccountDropdown id={menuId} onNavigate={() => setIsOpen(false)} /> : null}
    </div>
  );
}
