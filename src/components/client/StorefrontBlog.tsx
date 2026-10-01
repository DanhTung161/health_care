"use client";

import Image from "next/image";
import { A11y } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import StorefrontBlogCard from "@/components/client/StorefrontBlogCard";
import type { StorefrontArticleCard } from "@/lib/shopify/article-view-model";

type StorefrontBlogProps = {
  articles: StorefrontArticleCard[];
  loadFailed?: boolean;
};

export default function StorefrontBlog({ articles, loadFailed = false }: StorefrontBlogProps) {
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

        {articles.length > 0 ? (
          <Swiper
            className="storefront-blog__swiper"
            modules={[A11y]}
            slidesPerView={1}
            spaceBetween={30}
            watchOverflow
            a11y={{
              containerMessage: "Latest health articles carousel",
              itemRoleDescriptionMessage: "Article slide",
              slideLabelMessage: "{{index}} of {{slidesLength}}",
            }}
            breakpoints={{
              768: { slidesPerView: 2, spaceBetween: 24 },
              1200: { slidesPerView: 3, spaceBetween: 30 },
            }}
          >
            {articles.map((article) => (
              <SwiperSlide key={article.id} className="storefront-blog__slide">
                <StorefrontBlogCard article={article} />
              </SwiperSlide>
            ))}
          </Swiper>
        ) : (
          <p className="storefront-blog__state storefront-body" role={loadFailed ? "alert" : "status"}>
            {loadFailed ? "Articles are temporarily unavailable." : "No published articles are available."}
          </p>
        )}
      </div>
    </section>
  );
}
