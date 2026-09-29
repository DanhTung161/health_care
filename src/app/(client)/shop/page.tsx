import type { Metadata } from "next";

import StorefrontBreadcrumb from "@/components/client/StorefrontBreadcrumb";
import StorefrontShop from "@/components/client/StorefrontShop";

export const metadata: Metadata = {
  title: "Shop | BigMedix",
};

export default function ShopPage() {
  return (
    <>
      <StorefrontBreadcrumb
        items={[{ label: "Homepage", href: "/" }, { label: "Shop" }]}
        title="Shop"
      />
      <StorefrontShop />
    </>
  );
}
