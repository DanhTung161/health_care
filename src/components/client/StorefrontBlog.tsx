import Image from "next/image";
import Link from "next/link";

type BlogArticle = {
  author: string;
  category: string;
  excerpt: string;
  href: string;
  id: string;
  image: string;
  imageAlt: string;
  publishedAt: string;
  publishedAtIso: string;
  title: string;
};

const articles: readonly BlogArticle[] = [
  {
    id: "wildfire-air-quality",
    title: "Wildfires: How to cope when smoke affects air quality and health",
    excerpt: "As wildfires become more frequent due to climate change and drier conditions, more of us and more...",
    image: "/images/storefront/blog/wildfire-air-quality.png",
    imageAlt: "Healthcare professional examining a sample in a laboratory",
    category: "Staying Healthy",
    publishedAt: "January 8, 2025",
    publishedAtIso: "2025-01-08",
    author: "Admin",
    href: "/blog",
  },
  {
    id: "medication-side-effects",
    title: "Medication side effects: What are your options?",
    excerpt: "Medications can provide a host of health benefits. They may prevent or eliminate a disease.",
    image: "/images/storefront/blog/medication-side-effects.png",
    imageAlt: "Medical team discussing patient care",
    category: "Mind & Mood",
    publishedAt: "January 8, 2025",
    publishedAtIso: "2025-01-08",
    author: "Admin",
    href: "/blog",
  },
  {
    id: "unhealthy-inflammation",
    title: "An action plan to fight unhealthy inflammation",
    excerpt: "In fact, there's a lot you can do. And you may already be doing it. That's because some of the most...",
    image: "/images/storefront/blog/unhealthy-inflammation.png",
    imageAlt: "Clinicians reviewing a dental X-ray with a patient",
    category: "Exercise & Fitness",
    publishedAt: "January 8, 2025",
    publishedAtIso: "2025-01-08",
    author: "Admin",
    href: "/blog",
  },
] as const;

export default function StorefrontBlog() {
  return (
    <section className="storefront-blog" aria-labelledby="storefront-blog-title">
      <div className="storefront-blog__container">
        <header className="storefront-blog__header">
          <div className="storefront-blog__heading">
            <div className="storefront-blog__eyebrow">
              <Image src="/icons/storefront/blog/eyebrow.svg" alt="" width={24} height={24} aria-hidden="true" />
              <span>Our Latest Articles</span>
            </div>
            <h2 id="storefront-blog-title" className="storefront-heading storefront-heading-2 storefront-blog__title">
              Latest health news and expert advice
            </h2>
          </div>

          <p className="storefront-blog__support storefront-body">
            Stay informed with the latest health news, medical breakthroughs, expert insights. Our team of healthcare professionals brings you information on wellness
          </p>
        </header>

        <div className="storefront-blog__grid">
          {articles.map((article) => (
            <article className="storefront-blog__card" key={article.id}>
              <div className="storefront-blog__image-frame">
                <Image src={article.image} alt={article.imageAlt} fill sizes="(min-width: 1200px) 410px, (min-width: 768px) 50vw, 100vw" />
              </div>

              <div className="storefront-blog__meta">
                <span className="storefront-blog__category">
                  <span aria-hidden="true" />
                  {article.category}
                </span>
                <time dateTime={article.publishedAtIso}>{article.publishedAt}</time>
                <span className="storefront-blog__author"><span>By </span>{article.author}</span>
              </div>

              <h3 className="storefront-heading storefront-heading-5 storefront-blog__article-title">{article.title}</h3>
              <p className="storefront-blog__excerpt storefront-body">{article.excerpt}</p>

              <Link className="storefront-blog__read-more" href={article.href}>
                <Image src="/icons/storefront/services/learn-more.svg" alt="" width={34} height={34} aria-hidden="true" />
                <span>Read more</span>
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}