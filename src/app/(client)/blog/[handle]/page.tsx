import StorefrontBreadcrumb from "@/components/client/StorefrontBreadcrumb";

export default function BlogDetailPage() {
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
      <main aria-label="Blog detail content" />
    </>
  );
}
