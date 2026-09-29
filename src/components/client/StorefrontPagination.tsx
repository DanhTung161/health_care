import Image from "next/image";
import Link from "next/link";

interface StorefrontPaginationProps {
  basePath?: string;
  currentPage: number;
  totalPages: number;
}

function pageHref(basePath: string, page: number) {
  return page === 1 ? basePath : `${basePath}?page=${page}`;
}

export default function StorefrontPagination({
  basePath = "/shop",
  currentPage,
  totalPages,
}: StorefrontPaginationProps) {
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1);
  const previousPage = Math.max(1, currentPage - 1);
  const nextPage = Math.min(totalPages, currentPage + 1);

  return (
    <nav aria-label="Product pagination" className="storefront-pagination">
      <Link
        aria-label="Previous page"
        className="storefront-pagination__control storefront-pagination__arrow"
        href={pageHref(basePath, previousPage)}
      >
        <Image
          alt=""
          height={40}
          src="/icons/storefront/shop/pagination-previous.svg"
          width={40}
        />
      </Link>

      {pages.map((page) => (
        <Link
          aria-current={page === currentPage ? "page" : undefined}
          aria-label={`Page ${page}`}
          className="storefront-pagination__control"
          href={pageHref(basePath, page)}
          key={page}
        >
          {page}
        </Link>
      ))}

      <Link
        aria-label="Next page"
        className="storefront-pagination__control storefront-pagination__arrow"
        href={pageHref(basePath, nextPage)}
      >
        <Image
          alt=""
          height={40}
          src="/icons/storefront/shop/pagination-next.svg"
          width={40}
        />
      </Link>
    </nav>
  );
}
