import sharp from "sharp";

import { MediaError } from "../domain/media.errors.js";
import type { ProviderImageProcessor } from "../domain/media.ports.js";
import {
  PROVIDER_IMAGE_DIMENSIONS,
  PROVIDER_IMAGE_MAX_BYTES,
  providerOwnerTypeForImagePurpose,
  type NormalizedProviderImage,
  type ProviderImagePurpose,
} from "../domain/media.types.js";

/** Conservative decoded-pixel ceiling for Provider images. */
const LIMIT_INPUT_PIXELS = 40_000_000;

const ALLOWED_INPUT = new Set(["jpeg", "png", "webp"]);

/**
 * Validates and normalizes Provider logo/cover/gallery images to WebP at the
 * fixed purpose dimensions (FR-042, FR-043). Multer MIME is never trusted alone.
 */
export class SharpProviderImageProcessor implements ProviderImageProcessor {
  public async normalize(input: {
    readonly purpose: ProviderImagePurpose;
    readonly bytes: Buffer;
  }): Promise<NormalizedProviderImage> {
    const { purpose, bytes } = input;
    if (bytes.byteLength === 0) {
      throw new MediaError("MEDIA_IMAGE_INVALID", "Provider image is empty");
    }
    if (bytes.byteLength > PROVIDER_IMAGE_MAX_BYTES) {
      throw new MediaError(
        "MEDIA_IMAGE_TOO_LARGE",
        "Provider image exceeds 5 MiB before normalization",
      );
    }

    const target = PROVIDER_IMAGE_DIMENSIONS[purpose];
    const pipeline = sharp(bytes, {
      failOn: "error",
      limitInputPixels: LIMIT_INPUT_PIXELS,
      animated: false,
      pages: 1,
    });

    const metadata = await pipeline.metadata();
    const format = metadata.format;
    if (format === undefined || !ALLOWED_INPUT.has(format)) {
      throw new MediaError(
        "MEDIA_IMAGE_INVALID",
        "Provider image must be a decodable JPEG, PNG, or WebP",
      );
    }
    if ((metadata.pages ?? 1) > 1 || metadata.pages === -1) {
      throw new MediaError(
        "MEDIA_IMAGE_INVALID",
        "Animated or multi-page images are not accepted",
      );
    }

    const normalized = await pipeline
      .rotate()
      .resize({
        width: target.width,
        height: target.height,
        fit: "cover",
        position: "centre",
      })
      .webp({ quality: 82, effort: 4 })
      .toBuffer({ resolveWithObject: true });

    if (normalized.info.size > PROVIDER_IMAGE_MAX_BYTES) {
      throw new MediaError(
        "MEDIA_IMAGE_TOO_LARGE",
        "Normalized provider image exceeds 5 MiB",
      );
    }

    return {
      bytes: normalized.data,
      contentType: "image/webp",
      byteSize: normalized.info.size,
      width: normalized.info.width,
      height: normalized.info.height,
      purpose,
      ownerType: providerOwnerTypeForImagePurpose(purpose),
    };
  }
}
