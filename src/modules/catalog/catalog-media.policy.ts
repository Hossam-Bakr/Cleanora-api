/**
 * Catalog-owned guards for Media service-image limits and safe receipts.
 * Numeric ceilings and owner type remain Media-owned; Catalog refuses unsafe
 * shapes before orchestration.
 */

import {
  CATALOG_SERVICE_IMAGE_ALLOWED_CONTENT_TYPES,
  CATALOG_SERVICE_IMAGE_MAX_BYTES,
  CATALOG_SERVICE_IMAGE_MAX_EDGE,
  type CatalogServiceImageReceipt,
} from "#modules/media/media.public";
import { CatalogError } from "./catalog.errors.js";

const FORBIDDEN_RECEIPT_KEYS =
  /storageKey|storage_key|url|signed|credential|secret|cloudinary|providerPayload|privateUrl/iu;

/**
 * @desc Accept only JPEG/PNG/WebP for Catalog service images.
 */
export function assertCatalogServiceImageContentType(mime: string): string {
  if (
    !(CATALOG_SERVICE_IMAGE_ALLOWED_CONTENT_TYPES as readonly string[]).includes(
      mime,
    )
  ) {
    throw new CatalogError(
      "CATALOG_MEDIA_INVALID",
      "Catalog service image content type is unsupported",
    );
  }
  return mime;
}

/**
 * @desc Enforce the Media-owned Catalog service-image byte ceiling.
 */
export function assertCatalogServiceImageByteLimit(bytes: number): void {
  if (
    !Number.isFinite(bytes) ||
    bytes <= 0 ||
    bytes > CATALOG_SERVICE_IMAGE_MAX_BYTES
  ) {
    throw new CatalogError(
      "CATALOG_MEDIA_INVALID",
      "Catalog service image exceeds the allowed byte limit",
    );
  }
}

/**
 * @desc Enforce the Media-owned Catalog service-image max edge after normalize.
 */
export function assertCatalogServiceImageDimensions(input: {
  readonly width: number;
  readonly height: number;
}): void {
  if (
    !Number.isInteger(input.width) ||
    !Number.isInteger(input.height) ||
    input.width < 1 ||
    input.height < 1 ||
    input.width > CATALOG_SERVICE_IMAGE_MAX_EDGE ||
    input.height > CATALOG_SERVICE_IMAGE_MAX_EDGE
  ) {
    throw new CatalogError(
      "CATALOG_MEDIA_INVALID",
      "Catalog service image dimensions are invalid",
    );
  }
}

/**
 * @desc Refuse receipts that leak storage keys, signed URLs, or credentials.
 */
export function assertSafeCatalogServiceImageReceipt(receipt: unknown): void {
  if (receipt === null || typeof receipt !== "object") {
    throw new CatalogError(
      "CATALOG_MEDIA_INVALID",
      "Catalog service image receipt is invalid",
    );
  }
  const value = receipt as CatalogServiceImageReceipt &
    Record<string, unknown>;
  if (
    typeof value.mediaFileId !== "string" ||
    value.mediaFileId.length === 0 ||
    typeof value.ownerUserId !== "string" ||
    value.state !== "READY" ||
    !(CATALOG_SERVICE_IMAGE_ALLOWED_CONTENT_TYPES as readonly string[]).includes(
      value.canonicalContentType,
    ) ||
    typeof value.byteSize !== "number" ||
    typeof value.safeReceiptId !== "string"
  ) {
    throw new CatalogError(
      "CATALOG_MEDIA_INVALID",
      "Catalog service image receipt is incomplete",
    );
  }

  for (const key of Object.keys(value)) {
    if (FORBIDDEN_RECEIPT_KEYS.test(key)) {
      throw new CatalogError(
        "CATALOG_MEDIA_INVALID",
        "Catalog service image receipt leaks Media internals",
      );
    }
  }

  const serialized = JSON.stringify(value);
  if (
    /storageKey|cloudinary|api_secret|https?:\/\//iu.test(serialized)
  ) {
    throw new CatalogError(
      "CATALOG_MEDIA_INVALID",
      "Catalog service image receipt leaks Media internals",
    );
  }
}
