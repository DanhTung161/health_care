import 'server-only';
import { boundedPageSize, shopifyGraphQL } from '@/lib/shopify/client';
import { ShopifyError } from '@/lib/shopify/config';
import type { ShopifyArticleDTO, ShopifyBlogDTO, ShopifyPage } from '@/lib/shopify/types';

type Connection<T> = { edges: { node: T }[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } };
const ARTICLE_FIELDS = `id handle title summary body tags publishedAt createdAt updatedAt
  image { id url altText width height } blog { id handle title }`;

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

export async function getArticleByHandle(handle: string, blogId?: string): Promise<ShopifyArticleDTO | null> {
  if (!/^[a-z0-9][a-z0-9-]{0,254}$/.test(handle)) throw new ShopifyError('INVALID_PAYLOAD', 'Invalid article handle');
  if (blogId !== undefined && !/^gid:\/\/shopify\/Blog\/\d+$/.test(blogId)) throw new ShopifyError('INVALID_PAYLOAD', 'Invalid blog ID');
  const blogNumericId = blogId?.slice('gid://shopify/Blog/'.length);
  const data = await shopifyGraphQL<{ articles: Connection<ShopifyArticleDTO> }>(
    `query ArticleByHandle($search: String!) { articles(first: 2, query: $search) { edges { node { ${ARTICLE_FIELDS} } } pageInfo { hasNextPage endCursor } } }`,
    { search: `handle:${handle}${blogNumericId ? ` blog_id:${blogNumericId}` : ''}` },
  );
  const exact = data.articles.edges.map(({ node }) => node).filter((article) => article.handle === handle);
  if (exact.length > 1 || (!blogId && data.articles.pageInfo.hasNextPage)) throw new ShopifyError('DATA_INTEGRITY', 'Article handle is ambiguous across blogs');
  return exact[0] ?? null;
}
