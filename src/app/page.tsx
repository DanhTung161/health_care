import StorefrontShell from "@/components/client/StorefrontShell";
import StorefrontAbout from "@/components/client/StorefrontAbout";
import StorefrontAppointment from "@/components/client/StorefrontAppointment";
import StorefrontBlog from "@/components/client/StorefrontBlog";
import StorefrontFooter from "@/components/client/StorefrontFooter";
import StorefrontFooterTop from "@/components/client/StorefrontFooterTop";
import StorefrontHero from "@/components/client/StorefrontHero";
import StorefrontMission from "@/components/client/StorefrontMission";
import OurPricing from "@/components/client/OurPricing";
import OurTeam from "@/components/client/OurTeam";
import StorefrontProjects from "@/components/client/StorefrontProjects";
import StorefrontServices from "@/components/client/StorefrontServices";
import StorefrontTestimonials from "@/components/client/StorefrontTestimonials";
import StorefrontTextRun from "@/components/client/StorefrontTextRun";
import StorefrontWhyUs from "@/components/client/StorefrontWhyUs";
import { toStorefrontArticleCard, type StorefrontArticleCard as StorefrontArticleCardViewModel } from "@/lib/shopify/article-view-model";
import { ShopifyError } from "@/lib/shopify/config";
import { getPublishedArticles } from "@/lib/shopify/content";

export default async function HomePage() {
  let articles: StorefrontArticleCardViewModel[] = [];
  let articleLoadFailed = false;

  try {
    const page = await getPublishedArticles({ first: 20 });
    articles = page.items
      .map((article) => toStorefrontArticleCard(article))
      .filter((article): article is StorefrontArticleCardViewModel => article !== null);
  } catch (error) {
    articleLoadFailed = true;
    console.error(
      "Homepage Shopify articles could not be loaded",
      error instanceof ShopifyError
        ? {
            code: error.code,
            message: error.details?.graphqlMessage || error.message,
            extensions: error.details?.graphqlCode ? { code: error.details.graphqlCode } : undefined,
            path: error.details?.path,
          }
        : { code: "UNEXPECTED", message: "Unexpected article loading failure" },
    );
  }

  return (
    <StorefrontShell
      footer={
        <>
          <StorefrontFooterTop />
          <StorefrontFooter />
        </>
      }
    >
      <StorefrontHero />
      <StorefrontAbout />
      <StorefrontMission />
      <StorefrontServices />
      <StorefrontWhyUs />
      <StorefrontProjects />
      <StorefrontTestimonials />
      <OurPricing />
      <OurTeam />
      <StorefrontBlog articles={articles} loadFailed={articleLoadFailed} />
      <StorefrontAppointment />
      <StorefrontTextRun />
    </StorefrontShell>
  );
}
