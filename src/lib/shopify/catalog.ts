import 'server-only';
import { boundedPageSize, shopifyGraphQL } from '@/lib/shopify/client';
import { ShopifyError } from '@/lib/shopify/config';
import type { ShopifyCollectionDTO, ShopifyImageDTO, ShopifyPage, ShopifyProductDTO } from '@/lib/shopify/types';

type Image = { id: string; url: string; altText: string | null; width: number | null; height: number | null };
type Edge<T> = { node: T };
type ForwardConnection<T> = { edges: Edge<T>[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } };
export interface ShopifyProductPageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor: string | null;
  endCursor: string | null;
}
type ProductConnection<T> = {
  edges: Edge<T>[];
  pageInfo: ShopifyProductPageInfo;
};
type RawProduct = Omit<ShopifyProductDTO, 'collectionIds' | 'media' | 'variants' | 'category'> & {
  category: ShopifyProductDTO['category'];
  collections: { nodes: { id: string }[] };
  media: { nodes: ({ __typename: string; id: string; image?: Image | null } | null)[] };
  variants: { nodes: ShopifyProductDTO['variants']; pageInfo: { hasNextPage: boolean } };
};
type RawCollection = Omit<ShopifyCollectionDTO, 'image'> & { image: Image | null };

export interface ShopifyProductPage {
  currencyCode: string;
  items: ShopifyProductDTO[];
  pageInfo: ProductConnection<RawProduct>['pageInfo'];
}

export interface ShopifyProductPageOptions {
  after?: string | null;
  before?: string | null;
  first?: number;
  last?: number;
  query?: string | null;
}

export type ShopifyProductWithCurrency = ShopifyProductDTO & {
  currencyCode: string;
};

const MAX_STOREFRONT_PRODUCT_PAGE_SIZE = 12;
const PRODUCT_FIELDS = `id handle title description descriptionHtml vendor productType status tags
  category { id name fullName } createdAt updatedAt seo { title description }
  collections(first: 20) { nodes { id } }
  media(first: 20) { nodes { __typename id ... on MediaImage { image { id url altText width height } } } }
  variants(first: 100) { nodes { id title sku barcode selectedOptions { name value } price compareAtPrice availableForSale inventoryQuantity } pageInfo { hasNextPage } }
  options { name values }`;
const COLLECTION_FIELDS = `id handle title description descriptionHtml updatedAt seo { title description }
  image { id url altText width height }`;

function imageDTO(image: Image | null): ShopifyImageDTO | null {
  return image ? { id: image.id, url: image.url, altText: image.altText, width: image.width, height: image.height } : null;
}

function productDTO(raw: RawProduct): ShopifyProductDTO {
  if (raw.variants.pageInfo.hasNextPage) {
    throw new ShopifyError('DATA_INTEGRITY', 'Product has too many variants for this bounded read');
  }
  return {
    id: raw.id, handle: raw.handle, title: raw.title, description: raw.description,
    descriptionHtml: raw.descriptionHtml, vendor: raw.vendor, productType: raw.productType,
    status: raw.status, tags: raw.tags, category: raw.category,
    collectionIds: raw.collections.nodes.map(({ id }) => id), createdAt: raw.createdAt,
    updatedAt: raw.updatedAt, seo: raw.seo,
    media: raw.media.nodes.flatMap((node) => node?.__typename === 'MediaImage' && node.image ? [imageDTO(node.image)!] : []),
    variants: raw.variants.nodes, options: raw.options,
  };
}

function collectionDTO(raw: RawCollection): ShopifyCollectionDTO {
  return { ...raw, image: imageDTO(raw.image) };
}

function validCursor(cursor: string | null | undefined): string | null {
  if (cursor === null || cursor === undefined) return null;
  if (cursor.length > 2_048 || !/^[A-Za-z0-9+/_=-]+$/.test(cursor)) {
    throw new ShopifyError('INVALID_PAYLOAD', 'Invalid Shopify pagination cursor');
  }
  return cursor;
}

function productPagination(options: ShopifyProductPageOptions) {
  const after = validCursor(options.after);
  const before = validCursor(options.before);
  const backward = options.last !== undefined || before !== null;
  const forward = options.first !== undefined || after !== null;

  if (backward && forward) {
    throw new ShopifyError('INVALID_PAYLOAD', 'Cannot combine forward and backward product pagination');
  }

  if (backward) {
    if (!before) throw new ShopifyError('INVALID_PAYLOAD', 'Backward product pagination requires a cursor');
    return {
      after: null,
      before,
      first: null,
      last: boundedPageSize(options.last ?? MAX_STOREFRONT_PRODUCT_PAGE_SIZE, MAX_STOREFRONT_PRODUCT_PAGE_SIZE),
    };
  }

  return {
    after,
    before: null,
    first: boundedPageSize(options.first ?? 5, MAX_STOREFRONT_PRODUCT_PAGE_SIZE),
    last: null,
  };
}

export async function getProducts(options: ShopifyProductPageOptions = {}): Promise<ShopifyProductPage> {
  const pagination = productPagination(options);
  const query = options.query?.trim() || null;
  if (query && (query.length > 200 || /[\u0000-\u001f]/.test(query))) {
    throw new ShopifyError('INVALID_PAYLOAD', 'Invalid Shopify product query');
  }

  const data = await shopifyGraphQL<{
    shop: { currencyCode: string };
    products: ProductConnection<RawProduct>;
  }>(
    `query Products($first: Int, $after: String, $last: Int, $before: String, $query: String) {
      shop { currencyCode }
      products(first: $first, after: $after, last: $last, before: $before, query: $query) {
        edges { node { ${PRODUCT_FIELDS} } }
        pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
      }
    }`,
    { ...pagination, query },
  );

  return {
    currencyCode: data.shop.currencyCode,
    items: data.products.edges.map(({ node }) => productDTO(node)),
    pageInfo: data.products.pageInfo,
  };
}

export function getProductByHandle(
  handle: string,
  options: { includeCurrency: true },
): Promise<ShopifyProductWithCurrency | null>;
export function getProductByHandle(
  handle: string,
  options?: { includeCurrency?: false },
): Promise<ShopifyProductDTO | null>;
export async function getProductByHandle(
  handle: string,
  options: { includeCurrency?: boolean } = {},
): Promise<ShopifyProductDTO | ShopifyProductWithCurrency | null> {
  if (!/^[a-z0-9][a-z0-9-]{0,254}$/.test(handle)) throw new ShopifyError('INVALID_PAYLOAD', 'Invalid product handle');

  if (options.includeCurrency) {
    const data = await shopifyGraphQL<{
      shop: { currencyCode: string };
      productByHandle: RawProduct | null;
    }>(
      `query ProductByHandleWithCurrency($handle: String!) { shop { currencyCode } productByHandle: productByIdentifier(identifier: { handle: $handle }) { ${PRODUCT_FIELDS} } }`,
      { handle },
    );
    return data.productByHandle
      ? { ...productDTO(data.productByHandle), currencyCode: data.shop.currencyCode }
      : null;
  }

  const data = await shopifyGraphQL<{ productByHandle: RawProduct | null }>(
    `query ProductByHandle($handle: String!) { productByHandle: productByIdentifier(identifier: { handle: $handle }) { ${PRODUCT_FIELDS} } }`,
    { handle },
  );
  return data.productByHandle ? productDTO(data.productByHandle) : null;
}

export async function getCollections(options: { first?: number; after?: string | null } = {}): Promise<ShopifyPage<ShopifyCollectionDTO>> {
  const first = boundedPageSize(options.first);
  const data = await shopifyGraphQL<{ collections: ForwardConnection<RawCollection> }>(
    `query Collections($first: Int!, $after: String) { collections(first: $first, after: $after) { edges { node { ${COLLECTION_FIELDS} } } pageInfo { hasNextPage endCursor } } }`,
    { first, after: options.after ?? null },
  );
  return { items: data.collections.edges.map(({ node }) => collectionDTO(node)), pageInfo: data.collections.pageInfo };
}

export async function getCollectionByHandle(handle: string): Promise<ShopifyCollectionDTO | null> {
  if (!/^[a-z0-9][a-z0-9-]{0,254}$/.test(handle)) throw new ShopifyError('INVALID_PAYLOAD', 'Invalid collection handle');
  const data = await shopifyGraphQL<{ collectionByHandle: RawCollection | null }>(
    `query CollectionByHandle($handle: String!) { collectionByHandle: collectionByIdentifier(identifier: { handle: $handle }) { ${COLLECTION_FIELDS} } }`, { handle },
  );
  return data.collectionByHandle ? collectionDTO(data.collectionByHandle) : null;
}

export async function getCollectionProducts(id: string, options: { first?: number; after?: string | null } = {}): Promise<ShopifyPage<ShopifyProductDTO>> {
  if (!/^gid:\/\/shopify\/Collection\/\d+$/.test(id)) throw new ShopifyError('INVALID_PAYLOAD', 'Invalid collection ID');
  const first = boundedPageSize(options.first ?? 5, 5);
  const data = await shopifyGraphQL<{ collection: { products: ForwardConnection<RawProduct> } | null }>(
    `query CollectionProducts($id: ID!, $first: Int!, $after: String) { collection(id: $id) { products(first: $first, after: $after) { edges { node { ${PRODUCT_FIELDS} } } pageInfo { hasNextPage endCursor } } } }`,
    { id, first, after: options.after ?? null },
  );
  if (!data.collection) throw new ShopifyError('INVALID_PAYLOAD', 'Collection was not found');
  return { items: data.collection.products.edges.map(({ node }) => productDTO(node)), pageInfo: data.collection.products.pageInfo };
}
