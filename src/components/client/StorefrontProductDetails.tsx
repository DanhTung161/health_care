"use client";

import Image from "next/image";
import { useState } from "react";

import { StorefrontButton } from "@/components/client/StorefrontButton";
import type { StorefrontProductDetail } from "@/lib/shopify/storefront";

const SHARE_ICONS = [
  { alt: "Facebook", height: 16, src: "/icons/storefront/product-detail/facebook.svg", width: 16 },
  { alt: "X", height: 14, src: "/icons/storefront/product-detail/x.svg", width: 14 },
  { alt: "Instagram", height: 16, src: "/icons/storefront/product-detail/instagram.svg", width: 16 },
  { alt: "YouTube", height: 17, src: "/icons/storefront/product-detail/youtube.svg", width: 16 },
] as const;

export default function StorefrontProductDetails({
  product,
}: {
  product: StorefrontProductDetail;
}) {
  const [quantity, setQuantity] = useState(1);

  return (
    <article className="storefront-product-detail__information">
      <span
        className={
          product.available
            ? "storefront-product-detail__stock"
            : "storefront-product-detail__stock storefront-product-detail__stock--unavailable"
        }
      >
        {product.available ? "In Stock" : "Out of Stock"}
      </span>

      <h1>{product.name}</h1>

      {product.price ? (
        <p className="storefront-product-detail__price">
          <span>{product.price}</span>
          {product.compareAtPrice ? <del>{product.compareAtPrice}</del> : null}
        </p>
      ) : null}

      {product.description ? (
        <p className="storefront-product-detail__description">{product.description}</p>
      ) : null}

      <div className="storefront-product-detail__purchase">
        <span className="storefront-product-detail__quantity-label">Quantity</span>
        <div className="storefront-product-detail__purchase-row">
          <div aria-label="Quantity" className="storefront-product-detail__quantity" role="group">
            <button
              aria-label="Decrease quantity"
              disabled={quantity === 1}
              onClick={() => setQuantity((current) => Math.max(1, current - 1))}
              type="button"
            >
              −
            </button>
            <output aria-live="polite" aria-label={`Quantity ${quantity}`}>{quantity}</output>
            <button
              aria-label="Increase quantity"
              onClick={() => setQuantity((current) => current + 1)}
              type="button"
            >
              +
            </button>
          </div>
          <StorefrontButton
            aria-label={`Add ${quantity} ${product.name} to cart is unavailable in this preview`}
            className="storefront-product-detail__cart"
            disabled
            icon={
              <Image
                alt=""
                height={20}
                src="/icons/storefront/product-detail/cart.svg"
                width={20}
              />
            }
            iconPosition="leading"
          >
            Add To Cart
          </StorefrontButton>
        </div>
      </div>

      <dl className="storefront-product-detail__metadata">
        {product.sku ? (
          <div>
            <dt>SKU:</dt>
            <dd>{product.sku}</dd>
          </div>
        ) : null}
        {product.category ? (
          <div>
            <dt>Category:</dt>
            <dd>{product.category}</dd>
          </div>
        ) : null}
        {product.tags.length > 0 ? (
          <div>
            <dt>Tags:</dt>
            <dd>{product.tags.join(", ")}</dd>
          </div>
        ) : null}
        <div>
          <dt>Share:</dt>
          <dd aria-label="Sharing options" className="storefront-product-detail__share">
            {SHARE_ICONS.map((icon) => (
              <span aria-label={icon.alt} key={icon.alt} role="img" tabIndex={0}>
                <span
                  aria-hidden="true"
                  className="storefront-product-detail__share-icon"
                  style={{
                    height: icon.height,
                    maskImage: `url("${icon.src}")`,
                    WebkitMaskImage: `url("${icon.src}")`,
                    width: icon.width,
                  }}
                />
              </span>
            ))}
          </dd>
        </div>
      </dl>
    </article>
  );
}