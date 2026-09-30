import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import StorefrontBreadcrumb from "@/components/client/StorefrontBreadcrumb";
import StorefrontProductDetails from "@/components/client/StorefrontProductDetails";
import StorefrontProductGallery from "@/components/client/StorefrontProductGallery";
import { getProductByHandle } from "@/lib/shopify/catalog";
import { mapShopifyProductToDetail } from "@/lib/shopify/storefront";

const VALID_PRODUCT_HANDLE = /^[a-z0-9][a-z0-9-]{0,254}$/;

const loadProduct = cache(async (handle: string) => {
  if (!VALID_PRODUCT_HANDLE.test(handle)) notFound();
  const product = await getProductByHandle(handle, { includeCurrency: true });
  if (!product) notFound();
  return product;
});

type ProductDetailPageProps = {
  params: Promise<{ handle: string }>;
};

export async function generateMetadata({
  params,
}: ProductDetailPageProps): Promise<Metadata> {
  const { handle } = await params;
  const product = await loadProduct(handle);
  const description = product.seo.description?.trim()
    || product.description.trim().slice(0, 160)
    || undefined;

  return {
    description,
    title: `${product.seo.title?.trim() || product.title} | BigMedix`,
  };
}

export default async function ProductDetailPage({
  params,
}: ProductDetailPageProps) {
  const { handle } = await params;
  const sourceProduct = await loadProduct(handle);
  const product = mapShopifyProductToDetail(sourceProduct);

  return (
    <>
      <StorefrontBreadcrumb
        backgroundImage="/images/storefront/doctor-list/breadcrumb-hero.png"
        items={[
          { label: "Homepage", href: "/" },
          { label: "Shop", href: "/shop" },
          { label: product.name },
        ]}
        showTitle={false}
        title={product.name}
      />
      <main className="storefront-product-detail">
        <div className="storefront-product-detail__layout">
          <StorefrontProductGallery
            images={product.images}
            name={product.name}
            sale={product.sale}
          />
          <StorefrontProductDetails product={product} />
        </div>
      </main>
    </>
  );
}