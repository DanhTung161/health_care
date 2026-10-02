import 'server-only';
import sanitizeHtml from 'sanitize-html';

import type { ShopifyArticleCardDTO, ShopifyArticleDTO } from '@/lib/shopify/types';

export type StorefrontArticleCard = {
  author: string | null;
  category: string | null;
  excerpt: string | null;
  handle: string;
  href: string;
  id: string;
  image: string | null;
  imageAlt: string;
  publishedAt: string;
  publishedAtIso: string;
  title: string;
};

export type StorefrontArticleDetail = {
  author: string | null;
  bodyHtml: string | null;
  category: string | null;
  handle: string;
  id: string;
  image: string | null;
  imageAlt: string;
  publishedAt: string;
  publishedAtIso: string;
  summary: string | null;
  title: string;
};

const ARTICLE_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
  year: 'numeric',
});

function plainTextSummary(summary: string | null): string | null {
  if (!summary) return null;
  const text = summary
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#(?:39|x27);/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) return null;
  return text.length > 150 ? `${text.slice(0, 147).trimEnd()}...` : text;
}

function shopifyImageUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'cdn.shopify.com' && url.pathname.startsWith('/s/files/')
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

const ARTICLE_BODY_ALLOWED_TAGS = Array.from(new Set([
  ...sanitizeHtml.defaults.allowedTags,
  'figure',
  'figcaption',
  'h1',
  'h2',
  'img',
]));

function isTrustedShopifyContentImage(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:'
      && url.hostname === 'cdn.shopify.com'
      && url.pathname.startsWith('/s/files/');
  } catch {
    return false;
  }
}

function sanitizedArticleBody(body: string | null): string | null {
  if (!body?.trim()) return null;
  const html = sanitizeHtml(body, {
    allowProtocolRelative: false,
    allowedAttributes: {
      a: ['href', 'title'],
      img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
      li: ['value'],
      ol: ['start', 'reversed', 'type'],
      td: ['colspan', 'rowspan'],
      th: ['colspan', 'rowspan', 'scope'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowedTags: ARTICLE_BODY_ALLOWED_TAGS,
    disallowedTagsMode: 'discard',
    exclusiveFilter: (frame) => frame.tag === 'img' && !isTrustedShopifyContentImage(frame.attribs.src),
  }).trim();

  return html || null;
}

export function toStorefrontArticleCard(
  article: ShopifyArticleCardDTO,
  now = new Date(),
): StorefrontArticleCard | null {
  const handle = article.handle.trim();
  const title = article.title.trim();
  const publishedAt = article.publishedAt ? new Date(article.publishedAt) : null;
  if (!article.isPublished || !handle || !title || !publishedAt || Number.isNaN(publishedAt.getTime()) || publishedAt > now) {
    return null;
  }

  return {
    author: article.author?.name.trim() || null,
    category: article.blog?.title.trim() || null,
    excerpt: plainTextSummary(article.summary),
    handle,
    href: `/blog/${encodeURIComponent(handle)}`,
    id: article.id,
    image: shopifyImageUrl(article.image?.url),
    imageAlt: article.image?.altText?.trim() || title,
    publishedAt: ARTICLE_DATE_FORMATTER.format(publishedAt),
    publishedAtIso: publishedAt.toISOString(),
    title,
  };
}

export function toStorefrontArticleDetail(
  article: ShopifyArticleDTO,
  now = new Date(),
): StorefrontArticleDetail | null {
  const handle = article.handle.trim();
  const title = article.title.trim();
  const publishedAt = article.publishedAt ? new Date(article.publishedAt) : null;
  if (!article.isPublished || !handle || !title || !publishedAt || Number.isNaN(publishedAt.getTime()) || publishedAt > now) {
    return null;
  }

  return {
    author: article.author?.name.trim() || null,
    bodyHtml: sanitizedArticleBody(article.body),
    category: article.blog?.title.trim() || null,
    handle,
    id: article.id,
    image: shopifyImageUrl(article.image?.url),
    imageAlt: article.image?.altText?.trim() || title,
    publishedAt: ARTICLE_DATE_FORMATTER.format(publishedAt),
    publishedAtIso: publishedAt.toISOString(),
    summary: plainTextSummary(article.summary),
    title,
  };
}
