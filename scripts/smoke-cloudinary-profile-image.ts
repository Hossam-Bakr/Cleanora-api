/**
 * Bounded live Cloudinary smoke for R1-P04 (owner-authorized).
 * Does not import customers repositories or associate profile images.
 * Never prints credentials or signed URLs.
 *
 * Usage: npm run smoke:cloudinary-profile-image
 */
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { v2 as cloudinary } from "cloudinary";
import sharp from "sharp";

import { loadEnvironment } from "../src/config/env.js";
import type { CloudinaryDestroyResult } from "../src/modules/media/domain/media.types.js";
import {
  CloudinaryMediaAdapter,
  createOpaqueCloudinaryPublicId,
} from "../src/modules/media/infrastructure/cloudinary-media.adapter.js";
import { SharpProfileImageProcessor } from "../src/modules/media/infrastructure/sharp-profile-image.processor.js";

type SmokeEvidence = {
  readonly timestamp: string;
  readonly nonProduction: boolean;
  readonly syntheticInput: true;
  readonly transformationFormat: "image/webp";
  readonly width: number;
  readonly height: number;
  readonly byteSize: number;
  readonly uploadResourceType: string | null;
  readonly uploadType: string | null;
  readonly opaquePublicIdValid: boolean;
  readonly signedGetStatus: number | null;
  readonly signedGetContentType: string | null;
  readonly firstDestroyResult: CloudinaryDestroyResult | null;
  readonly secondLookupOrDestroyResult: CloudinaryDestroyResult | null;
  readonly noCustomerDbImportOrAssociation: true;
  readonly cleanupResidue: "none" | "pending" | "unknown";
  readonly exitCode: number;
  readonly commandName: "smoke:cloudinary-profile-image";
};

function assertDestroyOutcome(
  label: "first" | "second",
  actual: CloudinaryDestroyResult,
  expected: CloudinaryDestroyResult,
): void {
  if (actual !== expected) {
    throw new Error(
      `${label} destroy expected '${expected}' but provider returned '${actual}'`,
    );
  }
}

async function main(): Promise<number> {
  const environment = loadEnvironment(process.env);
  const evidencePath = resolve(
    process.cwd(),
    "specs/R1-P04-customer-profiles-preferences-text-addresses/cloudinary-smoke-evidence.json",
  );

  let publicId: string | undefined;
  let exitCode = 1;
  let evidence: SmokeEvidence = {
    timestamp: new Date().toISOString(),
    nonProduction: environment.NODE_ENV !== "production",
    syntheticInput: true,
    transformationFormat: "image/webp",
    width: 0,
    height: 0,
    byteSize: 0,
    uploadResourceType: null,
    uploadType: null,
    opaquePublicIdValid: false,
    signedGetStatus: null,
    signedGetContentType: null,
    firstDestroyResult: null,
    secondLookupOrDestroyResult: null,
    noCustomerDbImportOrAssociation: true,
    cleanupResidue: "unknown",
    exitCode: 1,
    commandName: "smoke:cloudinary-profile-image",
  };

  const buildAdapter = () =>
    new CloudinaryMediaAdapter(cloudinary, {
      cloudName: environment.CLOUDINARY_CLOUD_NAME!,
      apiKey: environment.CLOUDINARY_API_KEY!,
      apiSecret: environment.CLOUDINARY_API_SECRET!,
      folder: environment.CLOUDINARY_PROFILE_IMAGE_FOLDER!,
      signedUrlTtlSeconds: environment.CLOUDINARY_SIGNED_URL_TTL_SECONDS!,
    });

  try {
    if (environment.NODE_ENV === "production") {
      throw new Error("Refuse live Cloudinary smoke against NODE_ENV=production");
    }
    if (environment.MEDIA_STORAGE_PROVIDER !== "cloudinary") {
      throw new Error("MEDIA_STORAGE_PROVIDER must be cloudinary for smoke");
    }

    const folder = environment.CLOUDINARY_PROFILE_IMAGE_FOLDER!;
    const adapter = buildAdapter();
    const processor = new SharpProfileImageProcessor();

    const jpeg = await sharp({
      create: {
        width: 64,
        height: 48,
        channels: 3,
        background: { r: 12, g: 34, b: 56 },
      },
    })
      .jpeg()
      .toBuffer();

    const normalized = await processor.normalize(jpeg);
    evidence = {
      ...evidence,
      width: normalized.width,
      height: normalized.height,
      byteSize: normalized.byteSize,
    };

    publicId = createOpaqueCloudinaryPublicId(folder);
    const stored = await adapter.storeProfileImage({
      bytes: normalized.bytes,
      ownerUserId: `smoke-${randomUUID()}`,
      mediaId: randomUUID(),
      storageKey: publicId,
    });

    evidence = {
      ...evidence,
      opaquePublicIdValid: stored.storageKey === publicId,
      uploadResourceType: stored.uploadResourceType,
      uploadType: stored.uploadType,
    };

    const delivery = await adapter.createAuthorizedDeliveryUrl(
      stored,
      new Date(Date.now() + environment.CLOUDINARY_SIGNED_URL_TTL_SECONDS! * 1000),
    );

    const response = await fetch(delivery.url);
    const contentType = response.headers.get("content-type");
    await response.arrayBuffer();
    evidence = {
      ...evidence,
      signedGetStatus: response.status,
      signedGetContentType: contentType,
    };

    if (response.status !== 200 || contentType === null || !contentType.includes("image/webp")) {
      throw new Error("Signed GET did not return 200 image/webp");
    }

    const firstDestroy = await adapter.remove({
      provider: "CLOUDINARY",
      storageKey: publicId,
    });
    assertDestroyOutcome("first", firstDestroy.destroyResult, "ok");
    evidence = { ...evidence, firstDestroyResult: firstDestroy.destroyResult };

    const secondDestroy = await adapter.remove({
      provider: "CLOUDINARY",
      storageKey: publicId,
    });
    assertDestroyOutcome("second", secondDestroy.destroyResult, "not_found");
    evidence = {
      ...evidence,
      secondLookupOrDestroyResult: secondDestroy.destroyResult,
      cleanupResidue: "none",
    };
    publicId = undefined;
    exitCode = 0;
  } catch (error) {
    evidence = {
      ...evidence,
      cleanupResidue: publicId === undefined ? "none" : "pending",
    };
    console.error(
      "smoke_failed",
      error instanceof Error ? error.message : "unknown_error",
    );
    exitCode = 1;
  } finally {
    if (publicId !== undefined) {
      try {
        await buildAdapter().remove({
          provider: "CLOUDINARY",
          storageKey: publicId,
        });
        evidence = { ...evidence, cleanupResidue: "none" };
      } catch {
        evidence = { ...evidence, cleanupResidue: "pending" };
      }
    }
    const finalEvidence: SmokeEvidence = { ...evidence, exitCode };
    writeFileSync(evidencePath, `${JSON.stringify(finalEvidence, null, 2)}\n`, "utf8");
    console.log("smoke_evidence_written", evidencePath);
    console.log("smoke_exit_code", exitCode);
  }
  return exitCode;
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error("smoke_crash", error instanceof Error ? error.message : "unknown");
    process.exit(1);
  });
