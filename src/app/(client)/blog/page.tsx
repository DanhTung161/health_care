import StorefrontBreadcrumb from "@/components/client/StorefrontBreadcrumb";
import StorefrontBlogCard from "@/components/client/StorefrontBlogCard";
import StorefrontPagination from "@/components/client/StorefrontPagination";
import { toStorefrontArticleCard, type StorefrontArticleCard as StorefrontArticleCardViewModel } from "@/lib/shopify/article-view-model";
import { ShopifyError } from "@/lib/shopify/config";
import { getPublishedArticles, type ShopifyArticlePageOptions } from "@/lib/shopify/content";
import type { StorefrontPaginationState } from "@/lib/shopify/storefront";

const BLOG_PAGE_SIZE = 9;

type BlogPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function singleValue(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function validOpaqueCursor(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (value.length > 2_048 || !/^[A-Za-z0-9+/_=-]+$/.test(value)) {
    throw new ShopifyError("INVALID_PAYLOAD", "Invalid Blog pagination cursor");
  }
  return value;
}

function parseBlogPagination(searchParams: Record<string, string | string[] | undefined>): {
  articleOptions: ShopifyArticlePageOptions;
  page: number;
} {
  const after = validOpaqueCursor(singleValue(searchParams.after));
  const before = validOpaqueCursor(singleValue(searchParams.before));
  const pageValue = singleValue(searchParams.page) ?? "1";

  if (!/^\d{1,6}$/.test(pageValue)) {
    throw new ShopifyError("INVALID_PAYLOAD", "Invalid Blog page");
  }

  const page = Number(pageValue);
  if (!Number.isSafeInteger(page) || page < 1 || (after && before)) {
    throw new ShopifyError("INVALID_PAYLOAD", "Invalid Blog pagination state");
  }
  if (!after && !before && page !== 1) {
    throw new ShopifyError("INVALID_PAYLOAD", "A Blog cursor is required for this page");
  }
  if (after && page < 2) {
    throw new ShopifyError("INVALID_PAYLOAD", "Forward Blog pagination requires page 2 or later");
  }

  return {
    articleOptions: before
      ? { before, last: BLOG_PAGE_SIZE }
      : { after: after ?? null, first: BLOG_PAGE_SIZE },
    page,
  };
}

function paginationHref(page: number, cursorName: "after" | "before", cursor: string): string {
  const params = new URLSearchParams();
  if (page > 1) params.set("page", String(page));
  params.set(cursorName, cursor);
  return `/blog?${params.toString()}`;
}

function blogPagination(
  page: number,
  pageInfo: {
    endCursor: string | null;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor: string | null;
  },
): StorefrontPaginationState | null {
  const previous = pageInfo.hasPreviousPage && pageInfo.startCursor
    ? {
        href: paginationHref(Math.max(1, page - 1), "before", pageInfo.startCursor),
        page: Math.max(1, page - 1),
      }
    : undefined;
  const next = pageInfo.hasNextPage && pageInfo.endCursor
    ? {
        href: paginationHref(page + 1, "after", pageInfo.endCursor),
        page: page + 1,
      }
    : undefined;

  return previous || next ? { currentPage: page, next, previous } : null;
}

export default async function BlogPage({ searchParams }: BlogPageProps) {
  let articles: StorefrontArticleCardViewModel[] = [];
  let articleLoadFailed = false;
  let pagination: StorefrontPaginationState | null = null;

  try {
    const paginationRequest = parseBlogPagination(await searchParams);
    const articlePage = await getPublishedArticles(paginationRequest.articleOptions);
    articles = articlePage.items
      .map((article) => toStorefrontArticleCard(article))
      .filter((article): article is StorefrontArticleCardViewModel => article !== null);
    pagination = blogPagination(paginationRequest.page, articlePage.pageInfo);
  } catch (error) {
    articleLoadFailed = true;
    console.error(
      "Blog page Shopify articles could not be loaded",
      error instanceof ShopifyError
        ? {
            code: error.code,
            message: error.details?.graphqlMessage || error.message,
            extensions: error.details?.graphqlCode ? { code: error.details.graphqlCode } : undefined,
            path: error.details?.path,
          }
        : { code: "UNEXPECTED", message: "Unexpected article loading failure" },
    );
  }

  return (
    <>
      <StorefrontBreadcrumb
        backgroundImage="/images/storefront/contact/breadcrumb-hero.png"
        items={[{ label: "Homepage", href: "/" }, { label: "Blog" }]}
        title="Blog"
      />
      <main className="storefront-blog-page" aria-label="Blog content">
        <div className="storefront-blog-page__container">
          {articles.length > 0 ? (
            <>
              <div className="storefront-blog-page__grid">
                {articles.map((article) => (
                  <StorefrontBlogCard article={article} key={article.id} />
                ))}
              </div>
              {pagination ? (
                <StorefrontPagination
                  ariaLabel="Blog pagination"
                  currentPage={pagination.currentPage}
                  next={pagination.next}
                  previous={pagination.previous}
                />
              ) : null}
            </>
          ) : (
            <p
              className="storefront-blog__state storefront-blog-page__state storefront-body"
              role={articleLoadFailed ? "alert" : "status"}
            >
              {articleLoadFailed ? "Articles are temporarily unavailable." : "No published articles are available."}
            </p>
          )}
        </div>
      </main>
    </>
  );
}
