import Image from "next/image";
import Link from "next/link";

import StorefrontPagination from "@/components/client/StorefrontPagination";
import type {
  StorefrontPaginationState,
  StorefrontProduct,
} from "@/lib/shopify/storefront";

const ACTIONS: readonly {
  icon: string;
  label: string;
  quickView?: boolean;
}[] = [
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

function ProductRating({
  rating,
  reviewCount,
}: {
  rating: number;
  reviewCount?: number;
}) {
  const filledStars = Math.max(0, Math.min(5, Math.round(rating)));

  return (
    <div
      aria-label={`Rated ${rating} out of 5 stars${reviewCount === undefined ? "" : ` from ${reviewCount} reviews`}`}
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
              index < filledStars
                ? "/icons/storefront/shop/star-filled.svg"
                : "/icons/storefront/shop/star-empty.svg"
            }
            width={12}
          />
        ))}
      </span>
      {reviewCount === undefined ? null : (
        <span aria-hidden="true">({reviewCount})</span>
      )}
    </div>
  );
}

function StorefrontProductCard({ product }: { product: StorefrontProduct }) {
  return (
    <article className="storefront-product-card">
      <div className="storefront-product-card__media">
        <Link
          aria-label={`View ${product.name}`}
          className="storefront-product-card__media-link"
          href={product.href}
        >
          {product.image ? (
            <Image
              alt={product.image.alt}
              className="storefront-product-card__image"
              fill
              sizes="300px"
              src={product.image.url}
            />
          ) : (
            <span className="storefront-product-card__image-placeholder">
              No image available
            </span>
          )}
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
        {product.rating === undefined ? null : (
          <ProductRating
            rating={product.rating}
            reviewCount={product.reviewCount}
          />
        )}
        {product.price ? (
          <p
            className={
              product.compareAtPrice
                ? "storefront-product-card__price storefront-product-card__price--sale"
                : "storefront-product-card__price"
            }
          >
            <span>{product.price}</span>
            {product.compareAtPrice ? (
              <del>{product.compareAtPrice}</del>
            ) : null}
          </p>
        ) : null}
      </div>
    </article>
  );
}

export default function StorefrontShop({
  error,
  pagination,
  products,
}: {
  error?: string;
  pagination: StorefrontPaginationState | null;
  products: readonly StorefrontProduct[];
}) {
  return (
    <section aria-label="Products" className="storefront-shop">
      {error ? (
        <p className="storefront-shop__state storefront-shop__state--error" role="alert">
          {error}
        </p>
      ) : products.length === 0 ? (
        <p className="storefront-shop__state">No products available.</p>
      ) : (
        <>
          <div className="storefront-shop__grid">
            {products.map((product) => (
              <StorefrontProductCard key={product.id} product={product} />
            ))}
          </div>
          {pagination ? (
            <StorefrontPagination
              currentPage={pagination.currentPage}
              next={pagination.next}
              previous={pagination.previous}
            />
          ) : null}
        </>
      )}
    </section>
  );
}
