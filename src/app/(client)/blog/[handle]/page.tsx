import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { cache } from "react";

import StorefrontBreadcrumb from "@/components/client/StorefrontBreadcrumb";
import { toStorefrontArticleDetail, type StorefrontArticleDetail } from "@/lib/shopify/article-view-model";
import { getArticleByHandle } from "@/lib/shopify/content";

const VALID_ARTICLE_HANDLE = /^[a-z0-9][a-z0-9-]{0,254}$/;

const loadArticle = cache(async (handle: string): Promise<StorefrontArticleDetail> => {
  if (!VALID_ARTICLE_HANDLE.test(handle)) notFound();
  const article = await getArticleByHandle(handle);
  const detail = article ? toStorefrontArticleDetail(article) : null;
  if (!detail || detail.handle !== handle) notFound();
  return detail;
});

type BlogDetailPageProps = {
  params: Promise<{ handle: string }>;
};

export async function generateMetadata({ params }: BlogDetailPageProps): Promise<Metadata> {
  const { handle } = await params;
  const article = await loadArticle(handle);

  return {
    title: `${article.title} | BigMedix`,
    ...(article.summary ? { description: article.summary } : {}),
  };
}

export default async function BlogDetailPage({ params }: BlogDetailPageProps) {
  const { handle } = await params;
  const article = await loadArticle(handle);

  return (
    <>
      <StorefrontBreadcrumb
        backgroundImage="/images/storefront/contact/breadcrumb-hero.png"
        items={[
          { label: "Homepage", href: "/" },
          { label: "Single Post" },
        ]}
        showTitle={false}
        title="Single Post"
      />
      <main aria-label="Blog detail content" className="storefront-blog-detail">
        <article className="storefront-blog-detail__article">
          <div className="storefront-blog-detail__meta">
            {article.category ? (
              <span className="storefront-blog-detail__category">
                <span aria-hidden="true" />
                {article.category}
              </span>
            ) : null}
            <time dateTime={article.publishedAtIso}>{article.publishedAt}</time>
            {article.author ? (
              <span className="storefront-blog-detail__author">
                <span>By </span>
                {article.author}
              </span>
            ) : null}
          </div>

          <h1>{article.title}</h1>

          {article.image ? (
            <div className="storefront-blog-detail__featured-image">
              <Image
                alt={article.imageAlt}
                fill
                priority
                sizes="(min-width: 1024px) 960px, calc(100vw - 48px)"
                src={article.image}
              />
            </div>
          ) : null}

          {article.bodyHtml ? (
            <div
              className="storefront-blog-article-content"
              dangerouslySetInnerHTML={{ __html: article.bodyHtml }}
            />
          ) : null}
        </article>
      </main>
    </>
  );
}
