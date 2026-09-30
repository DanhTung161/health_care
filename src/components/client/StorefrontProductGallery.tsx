"use client";

import Image from "next/image";
import { useState } from "react";

type ProductImage = {
  alt: string;
  id: string;
  url: string;
};

export default function StorefrontProductGallery({
  images,
  name,
  sale,
}: {
  images: readonly ProductImage[];
  name: string;
  sale: boolean;
}) {
  const [selectedImageId, setSelectedImageId] = useState(images[0]?.id);
  const selectedImage = images.find((image) => image.id === selectedImageId)
    ?? images[0];

  return (
    <div className="storefront-product-gallery">
      <div className="storefront-product-gallery__main">
        {selectedImage ? (
          <Image
            alt={selectedImage.alt}
            className="storefront-product-gallery__image"
            fill
            priority
            sizes="(max-width: 767px) calc(100vw - 32px), (max-width: 1199px) 52vw, 630px"
            src={selectedImage.url}
          />
        ) : (
          <span className="storefront-product-gallery__placeholder">
            No image available for {name}
          </span>
        )}
        {sale ? <span className="storefront-product-gallery__sale">Sale</span> : null}
      </div>

      {images.length > 0 ? (
        <div aria-label={`${name} images`} className="storefront-product-gallery__thumbnails" role="group">
          {images.map((image, index) => {
            const selected = image.id === selectedImage?.id;
            return (
              <button
                aria-label={`View ${name} image ${index + 1}`}
                aria-pressed={selected}
                className={
                  selected
                    ? "storefront-product-gallery__thumbnail storefront-product-gallery__thumbnail--active"
                    : "storefront-product-gallery__thumbnail"
                }
                key={image.id}
                onClick={() => setSelectedImageId(image.id)}
                type="button"
              >
                <Image
                  alt=""
                  className="storefront-product-gallery__thumbnail-image"
                  fill
                  sizes="100px"
                  src={image.url}
                />
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}