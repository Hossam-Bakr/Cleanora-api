import { createHash, randomBytes } from "node:crypto";
import { Readable } from "node:stream";

import type { UploadApiResponse, v2 as CloudinaryV2 } from "cloudinary";

import { MediaError } from "../domain/media.errors.js";
import type { MediaStoragePort, StoreProfileImageInput } from "../domain/media.ports.js";
import type {
  CloudinaryDestroyResult,
  DeliveryUrl,
  MediaRemoveResult,
  StoredMediaReference,
} from "../domain/media.types.js";
import { PROFILE_IMAGE_MAX_BYTES, PROFILE_IMAGE_MAX_EDGE } from "../domain/media.types.js";

export interface CloudinaryMediaConfig {
  readonly cloudName: string;
  readonly apiKey: string;
  readonly apiSecret: string;
  readonly folder: string;
  readonly signedUrlTtlSeconds: number;
}

export type CloudinarySdk = typeof CloudinaryV2;

function redactSecrets(message: string, secret: string): string {
  if (secret.length === 0) {
    return message;
  }
  return message.split(secret).join("[REDACTED]");
}

/**
 * Cloudinary adapter for customer profile images (DEC-033).
 * Upload/delete never run inside a Prisma transaction.
 */
export class CloudinaryMediaAdapter implements MediaStoragePort {
  public constructor(
    private readonly sdk: CloudinarySdk,
    private readonly config: CloudinaryMediaConfig,
  ) {
    this.sdk.config({
      cloud_name: config.cloudName,
      api_key: config.apiKey,
      api_secret: config.apiSecret,
      secure: true,
    });
  }

  public async storeProfileImage(
    input: StoreProfileImageInput,
  ): Promise<StoredMediaReference> {
    let response: UploadApiResponse;
    try {
      response = await new Promise<UploadApiResponse>((resolve, reject) => {
        const stream = this.sdk.uploader.upload_stream(
          {
            resource_type: "image",
            type: "authenticated",
            public_id: input.storageKey,
            format: "webp",
            overwrite: false,
            unique_filename: false,
            use_filename: false,
          },
          (error, result) => {
            if (error !== undefined || result === undefined) {
              reject(
                new Error(
                  error?.message ?? "Cloudinary upload returned no result",
                ),
              );
              return;
            }
            resolve(result);
          },
        );
        Readable.from(input.bytes).pipe(stream);
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? redactSecrets(error.message, this.config.apiSecret)
          : "Cloudinary upload failed";
      throw new MediaError("MEDIA_PROVIDER_FAILURE", message);
    }

    this.assertUploadResponse(response, input.storageKey);

    return {
      provider: "CLOUDINARY",
      storageKey: input.storageKey,
      contentType: "image/webp",
      byteSize: response.bytes,
      width: response.width,
      height: response.height,
      uploadResourceType: response.resource_type as "image",
      uploadType: response.type as "authenticated",
    };
  }

  public async createAuthorizedDeliveryUrl(
    reference: Pick<StoredMediaReference, "provider" | "storageKey">,
    expiresAt: Date,
  ): Promise<DeliveryUrl> {
    if (reference.provider !== "CLOUDINARY") {
      throw new MediaError(
        "MEDIA_PROVIDER_UNSUPPORTED",
        "Only Cloudinary delivery is implemented in R1-P04",
      );
    }
    const expiresUnix = Math.floor(expiresAt.getTime() / 1000);
    const url = this.sdk.url(reference.storageKey, {
      resource_type: "image",
      type: "authenticated",
      sign_url: true,
      secure: true,
      expires_at: expiresUnix,
    });
    return {
      url,
      urlExpiresAt: expiresAt.toISOString(),
    };
  }

  public async remove(
    reference: Pick<StoredMediaReference, "provider" | "storageKey">,
  ): Promise<MediaRemoveResult> {
    if (reference.provider !== "CLOUDINARY") {
      throw new MediaError(
        "MEDIA_PROVIDER_UNSUPPORTED",
        "Only Cloudinary deletion is implemented in R1-P04",
      );
    }
    try {
      const result = await this.sdk.uploader.destroy(reference.storageKey, {
        resource_type: "image",
        type: "authenticated",
        invalidate: true,
      });
      const destroyResult = normalizeCloudinaryDestroyResult(result);
      return { destroyResult };
    } catch (error) {
      if (error instanceof MediaError) {
        throw error;
      }
      const message =
        error instanceof Error
          ? redactSecrets(error.message, this.config.apiSecret)
          : "Cloudinary delete failed";
      throw new MediaError("MEDIA_PROVIDER_FAILURE", message);
    }
  }

  private assertUploadResponse(
    response: UploadApiResponse,
    expectedPublicId: string,
  ): void {
    const publicId = response.public_id;
    if (
      response.resource_type !== "image" ||
      response.type !== "authenticated" ||
      (response.format !== "webp" && response.format !== "WEBP") ||
      publicId !== expectedPublicId ||
      typeof response.bytes !== "number" ||
      response.bytes <= 0 ||
      response.bytes > PROFILE_IMAGE_MAX_BYTES ||
      typeof response.width !== "number" ||
      typeof response.height !== "number" ||
      response.width <= 0 ||
      response.height <= 0 ||
      response.width > PROFILE_IMAGE_MAX_EDGE ||
      response.height > PROFILE_IMAGE_MAX_EDGE
    ) {
      throw new MediaError(
        "MEDIA_PROVIDER_FAILURE",
        "Cloudinary upload response failed structural validation",
      );
    }
  }
}

/** Map Cloudinary destroy API outcomes to normalized internal results. */
export function normalizeCloudinaryDestroyResult(
  response: unknown,
): CloudinaryDestroyResult {
  const outcome =
    typeof response === "object" && response !== null && "result" in response
      ? String((response as { result: string }).result)
      : "";
  if (outcome === "ok") {
    return "ok";
  }
  if (outcome === "not found") {
    return "not_found";
  }
  throw new MediaError(
    "MEDIA_PROVIDER_FAILURE",
    "Cloudinary delete returned unexpected result",
  );
}

/** Opaque public_id under the configured folder — never from client filename. */
export function createOpaqueCloudinaryPublicId(folder: string): string {
  const opaque = createHash("sha256")
    .update(randomBytes(32))
    .digest("hex")
    .slice(0, 40);
  let start = 0;
  let end = folder.length;
  while (start < end && folder.charAt(start) === "/") {
    start += 1;
  }
  while (end > start && folder.charAt(end - 1) === "/") {
    end -= 1;
  }
  const normalizedFolder = folder.slice(start, end);
  return `${normalizedFolder}/${opaque}`;
}
