import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { cache } from "react";

import StorefrontBreadcrumb from "@/components/client/StorefrontBreadcrumb";
import StorefrontBlogSidebar, { type StorefrontBlogCategory } from "@/components/client/StorefrontBlogSidebar";
import {
  toStorefrontArticleCard,
  toStorefrontArticleDetail,
  type StorefrontArticleCard,
  type StorefrontArticleDetail,
} from "@/lib/shopify/article-view-model";
import { getArticleByHandle, getBlogs, getPublishedArticles } from "@/lib/shopify/content";
import type { ShopifyArticleCardDTO } from "@/lib/shopify/types";

const VALID_ARTICLE_HANDLE = /^[a-z0-9][a-z0-9-]{0,254}$/;
const SIDEBAR_BLOG_LIMIT = 8;
const SIDEBAR_ARTICLE_LIMIT = 12;
const RECENT_POST_LIMIT = 5;
const POPULAR_TAG_LIMIT = 8;

const loadArticle = cache(async (handle: string): Promise<StorefrontArticleDetail> => {
  if (!VALID_ARTICLE_HANDLE.test(handle)) notFound();
  const article = await getArticleByHandle(handle);
  const detail = article ? toStorefrontArticleDetail(article) : null;
  if (!detail || detail.handle !== handle) notFound();
  return detail;
});

type BlogSidebarData = {
  categories: StorefrontBlogCategory[];
  recentPosts: StorefrontArticleCard[];
  tags: string[];
};

function realBlogCategories(blogs: { id: string; title: string }[]): StorefrontBlogCategory[] {
  const seen = new Set<string>();
  return blogs.flatMap((blog) => {
    const title = blog.title.trim();
    const key = title.toLocaleLowerCase("en-US");
    if (!title || seen.has(key)) return [];
    seen.add(key);
    return [{ id: blog.id, title }];
  });
}

function popularArticleTags(articles: ShopifyArticleCardDTO[]): string[] {
  const tags = new Map<string, { count: number; firstSeen: number; label: string }>();
  let firstSeen = 0;

  for (const article of articles) {
    const articleTags = new Set<string>();
    for (const value of article.tags) {
      const label = value.trim();
      const key = label.toLocaleLowerCase("en-US");
      if (!label || articleTags.has(key)) continue;
      articleTags.add(key);

      const existing = tags.get(key);
      if (existing) existing.count += 1;
      else tags.set(key, { count: 1, firstSeen: firstSeen++, label });
    }
  }

  return [...tags.values()]
    .sort((left, right) => right.count - left.count || left.firstSeen - right.firstSeen)
    .slice(0, POPULAR_TAG_LIMIT)
    .map(({ label }) => label);
}

async function loadBlogSidebar(currentHandle: string): Promise<BlogSidebarData> {
  const [blogsResult, articlesResult] = await Promise.allSettled([
    getBlogs({ first: SIDEBAR_BLOG_LIMIT }),
    getPublishedArticles({ first: SIDEBAR_ARTICLE_LIMIT }),
  ]);

  const categories = blogsResult.status === "fulfilled"
    ? realBlogCategories(blogsResult.value.items)
    : [];
  const articleCandidates = articlesResult.status === "fulfilled"
    ? articlesResult.value.items
    : [];
  const articleCards = articleCandidates
    .map((candidate) => toStorefrontArticleCard(candidate))
    .filter((candidate): candidate is StorefrontArticleCard => candidate !== null);

  return {
    categories,
    recentPosts: articleCards
      .filter((candidate) => candidate.handle !== currentHandle)
      .slice(0, RECENT_POST_LIMIT),
    tags: popularArticleTags(articleCandidates),
  };
}

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
  const sidebar = await loadBlogSidebar(article.handle);

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
        <div className="storefront-blog-detail__layout">
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
                  sizes="(min-width: 1200px) 910px, (min-width: 992px) calc(100vw - 420px), calc(100vw - 48px)"
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
          <StorefrontBlogSidebar {...sidebar} />
        </div>
      </main>
    </>
  );
}
