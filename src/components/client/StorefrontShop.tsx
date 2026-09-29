import Image from "next/image";
import Link from "next/link";

import StorefrontPagination from "@/components/client/StorefrontPagination";

interface SampleProduct {
  compareAtPrice?: string;
  href: string;
  image: string;
  name: string;
  price: string;
  sale?: boolean;
}

const SHOP_PAGE_SIZE = 12;

const SAMPLE_PRODUCTS: readonly SampleProduct[] = [
  {
    compareAtPrice: "$149.99",
    href: "/shop/portable-led-monocular",
    image: "/images/storefront/shop/portable-led-monocular.png",
    name: "Portable LED Monocular",
    price: "$124.50",
    sale: true,
  },
  {
    href: "/shop/hand-sanitizer-refreshing",
    image: "/images/storefront/shop/hand-sanitizer-refreshing.png",
    name: "Hand Sanitizer Refreshing",
    price: "$124.50 - $139.99",
  },
  {
    compareAtPrice: "$149.99",
    href: "/shop/basal-body-thermometer",
    image: "/images/storefront/shop/basal-body-thermometer.png",
    name: "Basal Body Thermometer",
    price: "$124.50",
    sale: true,
  },
];

const ACTIONS = [
  {
    icon: "/icons/storefront/shop/wishlist.svg",
    label: "Add to wishlist",
  },
  {
    icon: "/icons/storefront/shop/quick-view.svg",
    label: "Quick view",
    quickView: true,
  },
  {
    icon: "/icons/storefront/shop/compare.svg",
    label: "Compare",
  },
] as const;

function ProductRating() {
  return (
    <div
      aria-label="Rated 4 out of 5 stars from 5 reviews"
      className="storefront-product-card__rating"
      role="img"
    >
      <span aria-hidden="true" className="storefront-product-card__stars">
        {Array.from({ length: 5 }, (_, index) => (
          <Image
            alt=""
            height={12}
            key={index}
            src={
              index < 4
                ? "/icons/storefront/shop/star-filled.svg"
                : "/icons/storefront/shop/star-empty.svg"
            }
            width={12}
          />
        ))}
      </span>
      <span aria-hidden="true">(5)</span>
    </div>
  );
}

function StorefrontProductCard({ product }: { product: SampleProduct }) {
  return (
    <article className="storefront-product-card">
      <div className="storefront-product-card__media">
        <Link
          aria-label={`View ${product.name}`}
          className="storefront-product-card__media-link"
          href={product.href}
        >
          <Image
            alt={product.name}
            className="storefront-product-card__image"
            fill
            sizes="300px"
            src={product.image}
          />
        </Link>

        {product.sale ? (
          <span className="storefront-product-card__sale">Sale</span>
        ) : null}

        <div
          aria-label={`${product.name} preview actions`}
          className="storefront-product-card__actions"
          role="group"
        >
          {ACTIONS.map((action) => (
            <button
              aria-disabled="true"
              aria-label={`${action.label} is unavailable in this preview`}
              className={
                action.quickView
                  ? "storefront-product-card__action storefront-product-card__action--quick-view"
                  : "storefront-product-card__action"
              }
              key={action.label}
              type="button"
            >
              <Image
                alt=""
                className="storefront-product-card__action-icon"
                height={action.quickView ? 20 : 44}
                src={action.icon}
                width={action.quickView ? 20 : 44}
              />
              {action.quickView ? (
                <span className="storefront-product-card__tooltip">
                  Quick View
                </span>
              ) : null}
            </button>
          ))}
        </div>

        <button
          aria-disabled="true"
          aria-label={`Add ${product.name} to cart is unavailable in this preview`}
          className="storefront-product-card__cart"
          type="button"
        >
          <Image
            alt=""
            height={34}
            src="/icons/storefront/shop/cart.svg"
            width={34}
          />
          <span>Add To Cart</span>
        </button>
      </div>

      <div className="storefront-product-card__content">
        <h2>
          <Link href={product.href}>{product.name}</Link>
        </h2>
        <ProductRating />
        <p
          className={
            product.compareAtPrice
              ? "storefront-product-card__price storefront-product-card__price--sale"
              : "storefront-product-card__price"
          }
        >
          <span>{product.price}</span>
          {product.compareAtPrice ? <del>{product.compareAtPrice}</del> : null}
        </p>
      </div>
    </article>
  );
}

export default function StorefrontShop() {
  return (
    <section aria-label="Sample products" className="storefront-shop">
      <div className="storefront-shop__grid">
        {SAMPLE_PRODUCTS.slice(0, SHOP_PAGE_SIZE).map((product) => (
          <StorefrontProductCard key={product.name} product={product} />
        ))}
      </div>
      <StorefrontPagination currentPage={1} totalPages={4} />
    </section>
  );
}
