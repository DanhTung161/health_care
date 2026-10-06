import Image from "next/image";
import Link from "next/link";

import type { StorefrontArticleCard } from "@/lib/shopify/article-view-model";
const RECENT_POST_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  day: "2-digit",
  month: "short",
  timeZone: "UTC",
  year: "numeric",
});

export type StorefrontBlogCategory = {
  id: string;
  title: string;
};

type StorefrontBlogSidebarProps = {
  categories: StorefrontBlogCategory[];
  recentPosts: StorefrontArticleCard[];
  tags: string[];
};

export default function StorefrontBlogSidebar({ categories, recentPosts, tags }: StorefrontBlogSidebarProps) {
  if (categories.length === 0 && recentPosts.length === 0 && tags.length === 0) return null;

  return (
    <aside className="storefront-blog-sidebar" aria-label="Blog sidebar">
      {categories.length > 0 ? (
        <section className="storefront-blog-sidebar__section" aria-labelledby="blog-categories-heading">
          <h2 id="blog-categories-heading">Blog Categories</h2>
          <ul className="storefront-blog-sidebar__categories">
            {categories.map((category) => (
              <li key={category.id} tabIndex={0}>
                <span aria-hidden="true" />
                <span>{category.title}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {recentPosts.length > 0 ? (
        <section className="storefront-blog-sidebar__section" aria-labelledby="recent-posts-heading">
          <h2 id="recent-posts-heading">Recent Posts</h2>
          <div className="storefront-blog-sidebar__recent-posts">
            {recentPosts.map((post) => (
              <article className="storefront-blog-sidebar__recent-post" key={post.id}>
                <Link className="storefront-blog-sidebar__recent-image" href={post.href} aria-label={`Read ${post.title}`}>
                  {post.image ? (
                    <Image alt={post.imageAlt} fill sizes="80px" src={post.image} />
                  ) : (
                    <span aria-hidden="true" />
                  )}
                </Link>
                <div>
                  <h3><Link href={post.href}>{post.title}</Link></h3>
                  <time dateTime={post.publishedAtIso}>
                    {RECENT_POST_DATE_FORMATTER.format(new Date(post.publishedAtIso))}
                  </time>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {tags.length > 0 ? (
        <section className="storefront-blog-sidebar__section" aria-labelledby="popular-tags-heading">
          <h2 id="popular-tags-heading">Popular Tags</h2>
          <div className="storefront-blog-sidebar__tags">
            {tags.map((tag) => <span key={tag.toLocaleLowerCase("en-US")} tabIndex={0}>{tag}</span>)}
          </div>
        </section>
      ) : null}
    </aside>
  );
}
