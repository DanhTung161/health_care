export type ShopifyImageDTO = { id: string; url: string; altText: string | null; width: number | null; height: number | null };
export type ShopifyVariantDTO = {
  id: string; title: string; sku: string | null; barcode: string | null;
  selectedOptions: { name: string; value: string }[];
  price: string; compareAtPrice: string | null;
  availableForSale: boolean; inventoryQuantity: number | null;
};
export type ShopifyProductDTO = {
  id: string; handle: string; title: string; description: string; descriptionHtml: string;
  vendor: string; productType: string; status: string; tags: string[];
  category: { id: string; name: string; fullName: string } | null;
  collectionIds: string[]; createdAt: string; updatedAt: string;
  seo: { title: string | null; description: string | null };
  media: ShopifyImageDTO[]; variants: ShopifyVariantDTO[];
  options: { name: string; values: string[] }[];
};
export type ShopifyCollectionDTO = {
  id: string; handle: string; title: string; description: string; descriptionHtml: string;
  image: ShopifyImageDTO | null; updatedAt: string;
  seo: { title: string | null; description: string | null };
};
export type ShopifyBlogDTO = { id: string; handle: string; title: string };
export type ShopifyArticleDTO = {
  id: string; handle: string; title: string; summary: string | null; body: string | null;
  image: ShopifyImageDTO | null; tags: string[]; publishedAt: string | null;
  createdAt: string; updatedAt: string; blog: ShopifyBlogDTO | null;
};
export type ShopifyPage<T> = { items: T[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } };
