import 'server-only';
import { boundedPageSize, shopifyGraphQL } from '@/lib/shopify/client';
import { ShopifyError } from '@/lib/shopify/config';
import type { ShopifyArticleCardDTO, ShopifyArticleDTO, ShopifyBlogDTO, ShopifyPage } from '@/lib/shopify/types';

type Connection<T> = { edges: { node: T }[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } };
type ArticleConnection<T> = {
  edges: { node: T }[];
  pageInfo: {
    endCursor: string | null;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor: string | null;
  };
};
export interface ShopifyArticlePageOptions {
  after?: string | null;
  before?: string | null;
  first?: number;
  last?: number;
}
export interface ShopifyArticlePage {
  items: ShopifyArticleCardDTO[];
  pageInfo: ArticleConnection<ShopifyArticleCardDTO>['pageInfo'];
}
const ARTICLE_FIELDS = `id handle title summary body tags publishedAt isPublished createdAt updatedAt
  image { id url altText width height } author { name } blog { id handle title }`;
const ARTICLE_CARD_FIELDS = `id handle title summary tags publishedAt isPublished
  image { id url altText width height } author { name } blog { id handle title }`;

export async function getBlogs(options: { first?: number; after?: string | null } = {}): Promise<ShopifyPage<ShopifyBlogDTO>> {
  const first = boundedPageSize(options.first);
  const data = await shopifyGraphQL<{ blogs: Connection<ShopifyBlogDTO> }>(
    `query Blogs($first: Int!, $after: String) { blogs(first: $first, after: $after) { edges { node { id handle title } } pageInfo { hasNextPage endCursor } } }`,
    { first, after: options.after ?? null },
  );
  return { items: data.blogs.edges.map(({ node }) => node), pageInfo: data.blogs.pageInfo };
}

export async function getArticles(options: { first?: number; after?: string | null } = {}): Promise<ShopifyPage<ShopifyArticleDTO>> {
  const first = boundedPageSize(options.first);
  const data = await shopifyGraphQL<{ articles: Connection<ShopifyArticleDTO> }>(
    `query Articles($first: Int!, $after: String) { articles(first: $first, after: $after) { edges { node { ${ARTICLE_FIELDS} } } pageInfo { hasNextPage endCursor } } }`,
    { first, after: options.after ?? null },
  );
  return { items: data.articles.edges.map(({ node }) => node), pageInfo: data.articles.pageInfo };
}

function validArticleCursor(cursor: string | null | undefined): string | null {
  if (cursor === null || cursor === undefined) return null;
  if (cursor.length > 2_048 || !/^[A-Za-z0-9+/_=-]+$/.test(cursor)) {
    throw new ShopifyError('INVALID_PAYLOAD', 'Invalid Shopify article pagination cursor');
  }
  return cursor;
}

function articlePagination(options: ShopifyArticlePageOptions) {
  const after = validArticleCursor(options.after);
  const before = validArticleCursor(options.before);
  const backward = options.last !== undefined || before !== null;
  const forward = options.first !== undefined || after !== null;

  if (backward && forward) {
    throw new ShopifyError('INVALID_PAYLOAD', 'Cannot combine forward and backward article pagination');
  }
  if (backward) {
    if (!before) {
      throw new ShopifyError('INVALID_PAYLOAD', 'Backward article pagination requires a cursor');
    }
    return {
      after: null,
      before,
      first: null,
      last: boundedPageSize(options.last),
    };
  }

  return {
    after,
    before: null,
    first: boundedPageSize(options.first),
    last: null,
  };
}

export async function getPublishedArticles(options: ShopifyArticlePageOptions = {}): Promise<ShopifyArticlePage> {
  const pagination = articlePagination(options);
  const data = await shopifyGraphQL<{ articles: ArticleConnection<ShopifyArticleCardDTO> }>(
    `query PublishedArticles($first: Int, $after: String, $last: Int, $before: String) {
      articles(first: $first, after: $after, last: $last, before: $before, query: "published_status:published", sortKey: PUBLISHED_AT, reverse: true) {
        edges { node { ${ARTICLE_CARD_FIELDS} } }
        pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
      }
    }`,
    pagination,
  );
  return { items: data.articles.edges.map(({ node }) => node), pageInfo: data.articles.pageInfo };
}

export async function getArticleByHandle(handle: string, blogId?: string): Promise<ShopifyArticleDTO | null> {
  if (!/^[a-z0-9][a-z0-9-]{0,254}$/.test(handle)) throw new ShopifyError('INVALID_PAYLOAD', 'Invalid article handle');
  if (blogId !== undefined && !/^gid:\/\/shopify\/Blog\/\d+$/.test(blogId)) throw new ShopifyError('INVALID_PAYLOAD', 'Invalid blog ID');
  const blogNumericId = blogId?.slice('gid://shopify/Blog/'.length);
  const data = await shopifyGraphQL<{ articles: Connection<ShopifyArticleDTO> }>(
    `query ArticleByHandle($search: String!) { articles(first: 2, query: $search) { edges { node { ${ARTICLE_FIELDS} } } pageInfo { hasNextPage endCursor } } }`,
    { search: `handle:${handle} published_status:published${blogNumericId ? ` blog_id:${blogNumericId}` : ''}` },
  );
  const exact = data.articles.edges
    .map(({ node }) => node)
    .filter((article) => article.handle === handle && article.isPublished);
  if (exact.length > 1 || (!blogId && data.articles.pageInfo.hasNextPage)) throw new ShopifyError('DATA_INTEGRITY', 'Article handle is ambiguous across blogs');
  return exact[0] ?? null;
}
