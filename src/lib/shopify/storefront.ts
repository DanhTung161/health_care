import 'server-only';

import type {
  ShopifyProductPageInfo,
  ShopifyProductPageOptions,
  ShopifyProductWithCurrency,
} from '@/lib/shopify/catalog';
import { ShopifyError } from '@/lib/shopify/config';
import { formatShopifyMoney, toMinorUnits } from '@/lib/shopify/money';
import type { ShopifyImageDTO, ShopifyProductDTO } from '@/lib/shopify/types';

export const SHOP_PAGE_SIZE = 12;

export interface StorefrontImage {
  alt: string;
  id: string;
  url: string;
}

export interface StorefrontProduct {
  compareAtPrice?: string;
  href: string;
  id: string;
  image?: StorefrontImage;
  name: string;
  price?: string;
  rating?: number;
  reviewCount?: number;
  sale: boolean;
}

export interface StorefrontPaginationLink {
  href: string;
  page: number;
}

export interface StorefrontPaginationState {
  currentPage: number;
  next?: StorefrontPaginationLink;
  previous?: StorefrontPaginationLink;
}

interface ParsedShopPagination {
  catalogOptions: ShopifyProductPageOptions;
  page: number;
}

type ShopSearchParams = Record<string, string | string[] | undefined>;

function singleValue(value: string | string[] | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function validOpaqueCursor(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (value.length > 2_048 || !/^[A-Za-z0-9+/_=-]+$/.test(value)) {
    throw new ShopifyError('INVALID_PAYLOAD', 'Invalid Shop pagination cursor');
  }
  return value;
}

export function parseShopPagination(searchParams: ShopSearchParams): ParsedShopPagination {
  const after = validOpaqueCursor(singleValue(searchParams.after));
  const before = validOpaqueCursor(singleValue(searchParams.before));
  const pageValue = singleValue(searchParams.page) ?? '1';

  if (!/^\d{1,6}$/.test(pageValue)) {
    throw new ShopifyError('INVALID_PAYLOAD', 'Invalid Shop page');
  }

  const page = Number(pageValue);
  if (!Number.isSafeInteger(page) || page < 1 || (after && before)) {
    throw new ShopifyError('INVALID_PAYLOAD', 'Invalid Shop pagination state');
  }
  if (!after && !before && page !== 1) {
    throw new ShopifyError('INVALID_PAYLOAD', 'A Shop cursor is required for this page');
  }
  if (after && page < 2) {
    throw new ShopifyError('INVALID_PAYLOAD', 'Forward Shop pagination requires page 2 or later');
  }

  return {
    catalogOptions: before
      ? { before, last: SHOP_PAGE_SIZE, query: 'status:active' }
      : { after: after ?? null, first: SHOP_PAGE_SIZE, query: 'status:active' },
    page,
  };
}

function paginationHref(page: number, cursorName: 'after' | 'before', cursor: string): string {
  const params = new URLSearchParams();
  if (page > 1) params.set('page', String(page));
  params.set(cursorName, cursor);
  return `/shop?${params.toString()}`;
}

export function storefrontPagination(
  page: number,
  pageInfo: ShopifyProductPageInfo,
): StorefrontPaginationState | null {
  const previous = pageInfo.hasPreviousPage && pageInfo.startCursor
    ? {
        href: paginationHref(Math.max(1, page - 1), 'before', pageInfo.startCursor),
        page: Math.max(1, page - 1),
      }
    : undefined;
  const next = pageInfo.hasNextPage && pageInfo.endCursor
    ? {
        href: paginationHref(page + 1, 'after', pageInfo.endCursor),
        page: page + 1,
      }
    : undefined;

  return previous || next ? { currentPage: page, next, previous } : null;
}

function safeImage(image: ShopifyImageDTO | undefined, productTitle: string): StorefrontImage | undefined {
  if (!image) return undefined;
  try {
    const url = new URL(image.url);
    if (url.protocol !== 'https:' || url.hostname !== 'cdn.shopify.com' || !url.pathname.startsWith('/s/files/')) {
      return undefined;
    }
    return { alt: image.altText?.trim() || productTitle, id: image.id, url: url.href };
  } catch {
    return undefined;
  }
}

function priceDisplay(product: ShopifyProductDTO, currencyCode: string) {
  if (product.variants.length === 0) {
    return { compareAtPrice: undefined, price: undefined, sale: false };
  }

  const variants = product.variants.map((variant) => ({
    amount: variant.price,
    compareAmount: variant.compareAtPrice,
    compareMinor: variant.compareAtPrice === null ? null : toMinorUnits(variant.compareAtPrice, currencyCode),
    minor: toMinorUnits(variant.price, currencyCode),
  }));
  const sorted = [...variants].sort((left, right) => left.minor - right.minor);
  const minimum = sorted[0];
  const maximum = sorted[sorted.length - 1];
  const price = minimum.minor === maximum.minor
    ? formatShopifyMoney(minimum.amount, currencyCode)
    : `${formatShopifyMoney(minimum.amount, currencyCode)} - ${formatShopifyMoney(maximum.amount, currencyCode)}`;

  const uniformCompare = minimum.minor === maximum.minor
    && variants.every((variant) => variant.compareMinor !== null)
    && variants.every((variant) => variant.compareMinor === variants[0].compareMinor);
  const sale = uniformCompare && variants[0].compareMinor! > minimum.minor;

  return {
    compareAtPrice: sale ? formatShopifyMoney(variants[0].compareAmount!, currencyCode) : undefined,
    price,
    sale,
  };
}

export function mapShopifyProductToCardProduct(
  product: ShopifyProductDTO,
  currencyCode: string,
): StorefrontProduct {
  const pricing = priceDisplay(product, currencyCode);
  return {
    ...pricing,
    href: `/shop/${product.handle}`,
    id: product.id,
    image: safeImage(product.media[0], product.title),
    name: product.title,
  };
}
export interface StorefrontProductDetail {
  available: boolean;
  category?: string;
  compareAtPrice?: string;
  currencyCode: string;
  description: string;
  handle: string;
  id: string;
  images: StorefrontImage[];
  name: string;
  price?: string;
  sale: boolean;
  selectedOptions: { name: string; value: string }[];
  sku?: string;
  tags: string[];
}

export function mapShopifyProductToDetail(
  product: ShopifyProductWithCurrency,
): StorefrontProductDetail {
  const selectedVariant = product.variants.find((variant) => variant.availableForSale)
    ?? product.variants[0];
  const priceMinor = selectedVariant
    ? toMinorUnits(selectedVariant.price, product.currencyCode)
    : undefined;
  const compareMinor = selectedVariant?.compareAtPrice
    ? toMinorUnits(selectedVariant.compareAtPrice, product.currencyCode)
    : undefined;
  const sale = priceMinor !== undefined
    && compareMinor !== undefined
    && compareMinor > priceMinor;

  return {
    available: selectedVariant?.availableForSale ?? false,
    category: product.category?.name.trim() || product.productType.trim() || undefined,
    compareAtPrice: sale
      ? formatShopifyMoney(selectedVariant!.compareAtPrice!, product.currencyCode)
      : undefined,
    currencyCode: product.currencyCode,
    description: product.description.trim(),
    handle: product.handle,
    id: product.id,
    images: product.media.flatMap((image) => {
      const normalized = safeImage(image, product.title);
      return normalized ? [normalized] : [];
    }),
    name: product.title,
    price: selectedVariant
      ? formatShopifyMoney(selectedVariant.price, product.currencyCode)
      : undefined,
    sale,
    selectedOptions: selectedVariant?.selectedOptions ?? [],
    sku: selectedVariant?.sku?.trim() || undefined,
    tags: product.tags.map((tag) => tag.trim()).filter(Boolean),
  };
}
