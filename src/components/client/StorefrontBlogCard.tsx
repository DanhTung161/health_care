import Image from "next/image";
import Link from "next/link";
import type { StorefrontArticleCard as StorefrontArticleCardViewModel } from "@/lib/shopify/article-view-model";

export default function StorefrontBlogCard({ article }: { article: StorefrontArticleCardViewModel }) {
  return (
    <article className="storefront-blog__card">
      <Link
        className="storefront-blog__image-frame storefront-blog__image-link"
        href={article.href}
        aria-label={`Read ${article.title}`}
      >
        {article.image ? (
          <Image
            src={article.image}
            alt={article.imageAlt}
            fill
            sizes="(min-width: 1200px) 410px, (min-width: 768px) 50vw, 100vw"
          />
        ) : (
          <div className="storefront-blog__image-placeholder" role="img" aria-label="Article image unavailable">
            Image unavailable
          </div>
        )}
      </Link>

      <div className="storefront-blog__meta">
        {article.category ? (
          <span className="storefront-blog__category">
            <span aria-hidden="true" />
            {article.category}
          </span>
        ) : null}
        <time dateTime={article.publishedAtIso}>{article.publishedAt}</time>
        {article.author ? <span className="storefront-blog__author"><span>By </span>{article.author}</span> : null}
      </div>

      <h3 className="storefront-heading storefront-heading-5 storefront-blog__article-title">
        <Link className="storefront-blog__article-title-link" href={article.href}>
          {article.title}
        </Link>
      </h3>
      {article.excerpt ? <p className="storefront-blog__excerpt storefront-body">{article.excerpt}</p> : null}

      <Link className="storefront-blog__read-more" href={article.href}>
        <Image src="/icons/storefront/services/learn-more.svg" alt="" width={34} height={34} aria-hidden="true" />
        <span>Read more</span>
      </Link>
    </article>
  );
}
