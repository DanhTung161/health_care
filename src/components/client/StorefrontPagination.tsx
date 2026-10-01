import Image from "next/image";
import Link from "next/link";

interface PaginationLink {
  href: string;
  page: number;
}

interface StorefrontPaginationProps {
  ariaLabel?: string;
  currentPage: number;
  next?: PaginationLink;
  previous?: PaginationLink;
}

export default function StorefrontPagination({
  ariaLabel = "Product pagination",
  currentPage,
  next,
  previous,
}: StorefrontPaginationProps) {
  const pages = [
    ...(previous ? [previous] : []),
    { href: "", page: currentPage },
    ...(next ? [next] : []),
  ];

  return (
    <nav aria-label={ariaLabel} className="storefront-pagination">
      {previous ? (
        <Link
          aria-label="Previous page"
          className="storefront-pagination__control storefront-pagination__arrow"
          href={previous.href}
        >
          <Image
            alt=""
            height={40}
            src="/icons/storefront/shop/pagination-previous.svg"
            width={40}
          />
        </Link>
      ) : null}

      {pages.map((item) =>
        item.page === currentPage ? (
          <span
            aria-current="page"
            aria-label={`Page ${item.page}`}
            className="storefront-pagination__control"
            key={item.page}
          >
            {item.page}
          </span>
        ) : (
          <Link
            aria-label={`Page ${item.page}`}
            className="storefront-pagination__control"
            href={item.href}
            key={item.page}
          >
            {item.page}
          </Link>
        ),
      )}

      {next ? (
        <Link
          aria-label="Next page"
          className="storefront-pagination__control storefront-pagination__arrow"
          href={next.href}
        >
          <Image
            alt=""
            height={40}
            src="/icons/storefront/shop/pagination-next.svg"
            width={40}
          />
        </Link>
      ) : null}
    </nav>
  );
}
