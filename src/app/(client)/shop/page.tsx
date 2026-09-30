import type { Metadata } from "next";

import StorefrontBreadcrumb from "@/components/client/StorefrontBreadcrumb";
import StorefrontShop from "@/components/client/StorefrontShop";
import { getProducts } from "@/lib/shopify/catalog";
import { ShopifyError } from "@/lib/shopify/config";
import {
  mapShopifyProductToCardProduct,
  parseShopPagination,
  storefrontPagination,
} from "@/lib/shopify/storefront";
import type {
  StorefrontPaginationState,
  StorefrontProduct,
} from "@/lib/shopify/storefront";

export const metadata: Metadata = {
  title: "Shop | BigMedix",
};

type ShopPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ShopPage({ searchParams }: ShopPageProps) {
  let errorMessage: string | undefined;
  let pagination: StorefrontPaginationState | null = null;
  let products: StorefrontProduct[] = [];

  try {
    const paginationRequest = parseShopPagination(await searchParams);
    const catalog = await getProducts(paginationRequest.catalogOptions);
    products = catalog.items.map((product) =>
      mapShopifyProductToCardProduct(product, catalog.currencyCode),
    );
    pagination = storefrontPagination(
      paginationRequest.page,
      catalog.pageInfo,
    );
  } catch (error) {
    const failure = error instanceof ShopifyError
      ? `${error.code}: ${error.message}`
      : error instanceof Error
        ? `${error.name}: ${error.message}`
        : "UNEXPECTED";
    console.error(`Shopify catalog load failed: ${failure}`);
    errorMessage = "Unable to load products.";
  }

  return (
    <>
      <StorefrontBreadcrumb
        backgroundImage="/images/storefront/doctor-list/breadcrumb-hero.png"
        items={[{ label: "Homepage", href: "/" }, { label: "Shop" }]}
        title="Shop"
      />
      <StorefrontShop
        error={errorMessage}
        pagination={pagination}
        products={products}
      />
    </>
  );
}
