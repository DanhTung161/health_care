import { ArrowRight } from "lucide-react";
import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  ReactNode,
} from "react";

type StorefrontButtonCommonProps = {
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
  iconPosition?: "leading" | "trailing";
  size?: "large" | "compact";
  variant?: "primary" | "link";
};

type StorefrontButtonElementProps = StorefrontButtonCommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "className"> & {
    href?: never;
  };

type StorefrontLinkElementProps = StorefrontButtonCommonProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "children" | "className"> & {
    href: string;
  };

export type StorefrontButtonProps =
  | StorefrontButtonElementProps
  | StorefrontLinkElementProps;

function isStorefrontLink(
  props: StorefrontButtonProps,
): props is StorefrontLinkElementProps {
  return typeof props.href === "string";
}

function getButtonClassName({
  className,
  iconPosition,
  size,
  variant,
}: Required<
  Pick<StorefrontButtonCommonProps, "iconPosition" | "size" | "variant">
> &
  Pick<StorefrontButtonCommonProps, "className">) {
  return [
    "storefront-button",
    `storefront-button--${variant}`,
    `storefront-button--${size}`,
    `storefront-button--${iconPosition}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");
}

function ButtonContent({
  children,
  icon,
  iconPosition,
}: Pick<
  StorefrontButtonCommonProps,
  "children" | "icon" | "iconPosition"
>) {
  const resolvedIcon =
    icon === undefined ? <ArrowRight aria-hidden="true" size={16} /> : icon;

  return (
    <>
      {resolvedIcon && iconPosition === "leading" ? (
        <span className="storefront-button__icon" aria-hidden="true">
          {resolvedIcon}
        </span>
      ) : null}
      <span>{children}</span>
      {resolvedIcon && iconPosition === "trailing" ? (
        <span className="storefront-button__icon" aria-hidden="true">
          {resolvedIcon}
        </span>
      ) : null}
    </>
  );
}

export function StorefrontButton(props: StorefrontButtonProps) {
  if (isStorefrontLink(props)) {
    const {
      children,
      className,
      icon,
      iconPosition = "trailing",
      size = "large",
      variant = "primary",
      ...anchorProps
    } = props;
    const buttonClassName = getButtonClassName({
      className,
      iconPosition,
      size,
      variant,
    });

    return (
      <a {...anchorProps} className={buttonClassName}>
        <ButtonContent icon={icon} iconPosition={iconPosition}>
          {children}
        </ButtonContent>
      </a>
    );
  }

  const {
    children,
    className,
    icon,
    iconPosition = "trailing",
    size = "large",
    type = "button",
    variant = "primary",
    ...buttonProps
  } = props;
  const buttonClassName = getButtonClassName({
    className,
    iconPosition,
    size,
    variant,
  });

  return (
    <button {...buttonProps} className={buttonClassName} type={type}>
      <ButtonContent icon={icon} iconPosition={iconPosition}>
        {children}
      </ButtonContent>
    </button>
  );
}
