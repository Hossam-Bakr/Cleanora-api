import sharp from "sharp";

import { MediaError } from "../domain/media.errors.js";
import type { ProfileImageProcessor } from "../domain/media.ports.js";
import {
  PROFILE_IMAGE_MAX_BYTES,
  PROFILE_IMAGE_MAX_EDGE,
  type NormalizedProfileImage,
} from "../domain/media.types.js";

/** Conservative decoded-pixel ceiling for R1-P04 profile images. */
const LIMIT_INPUT_PIXELS = 40_000_000;

const ALLOWED_INPUT = new Set(["jpeg", "png", "webp"]);

/**
 * Validates and normalizes customer profile images to WebP (DEC-033).
 * Multer MIME is never trusted alone — Sharp must decode the Buffer.
 */
export class SharpProfileImageProcessor implements ProfileImageProcessor {
  public async normalize(input: Buffer): Promise<NormalizedProfileImage> {
    if (input.byteLength === 0) {
      throw new MediaError("MEDIA_IMAGE_INVALID", "Profile image is empty");
    }
    if (input.byteLength > PROFILE_IMAGE_MAX_BYTES) {
      throw new MediaError(
        "MEDIA_IMAGE_TOO_LARGE",
        "Profile image exceeds 5 MiB before normalization",
      );
    }

    const pipeline = sharp(input, {
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
        "Profile image must be a decodable JPEG, PNG, or WebP",
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
        width: PROFILE_IMAGE_MAX_EDGE,
        height: PROFILE_IMAGE_MAX_EDGE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82, effort: 4 })
      .toBuffer({ resolveWithObject: true });

    if (normalized.info.size > PROFILE_IMAGE_MAX_BYTES) {
      throw new MediaError(
        "MEDIA_IMAGE_TOO_LARGE",
        "Normalized profile image exceeds 5 MiB",
      );
    }

    return {
      bytes: normalized.data,
      contentType: "image/webp",
      byteSize: normalized.info.size,
      width: normalized.info.width,
      height: normalized.info.height,
    };
  }
}
