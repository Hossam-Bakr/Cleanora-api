import type { Prisma, PrismaClient } from "#generated/prisma/client";

import { getPrismaClient } from "#database/prisma";

import type { MediaStoragePort } from "../domain/media.ports.js";

export interface BookingAttachmentFacts {
  readonly mediaId: string;
  readonly contentType: string;
}

export interface BookingAttachmentDelivery {
  readonly url: string;
  readonly urlExpiresAt: string;
}

export interface BookingAttachmentReader {
  readOwnedReadyImage(input: {
    readonly userId: string;
    readonly mediaId: string;
  }): Promise<BookingAttachmentFacts | null>;
  signOwnedReadyImage(input: {
    readonly userId: string;
    readonly mediaId: string;
  }): Promise<BookingAttachmentDelivery | null>;
}

export interface BookingAttachmentDeliveryDeps {
  readonly storage: MediaStoragePort;
  readonly signedUrlTtlSeconds: number;
}

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * @desc Media-owned READY booking attachment lookup and signed delivery.
 * @access Media infrastructure
 */
export function createBookingAttachmentReader(
  databaseContext?: unknown,
  delivery?: BookingAttachmentDeliveryDeps,
): BookingAttachmentReader {
  const client = (databaseContext ?? getPrismaClient()) as
    | PrismaClient
    | Prisma.TransactionClient;
  return {
    async readOwnedReadyImage(input: {
      readonly userId: string;
      readonly mediaId: string;
    }): Promise<BookingAttachmentFacts | null> {
      const row = await loadOwnedReadyImage(client, input);
      if (row === null) {
        return null;
      }
      return { mediaId: row.id, contentType: row.contentType };
    },
    async signOwnedReadyImage(input: {
      readonly userId: string;
      readonly mediaId: string;
    }): Promise<BookingAttachmentDelivery | null> {
      if (delivery === undefined) {
        return null;
      }
      const row = await loadOwnedReadyImage(client, input);
      if (row === null || row.storageProvider !== "CLOUDINARY") {
        return null;
      }
      try {
        const expiresAt = new Date(Date.now() + delivery.signedUrlTtlSeconds * 1000);
        const signed = await delivery.storage.createAuthorizedDeliveryUrl(
          { provider: "CLOUDINARY", storageKey: row.storageKey },
          expiresAt,
        );
        return { url: signed.url, urlExpiresAt: signed.urlExpiresAt };
      } catch {
        return null;
      }
    },
  };
}

async function loadOwnedReadyImage(
  client: PrismaClient | Prisma.TransactionClient,
  input: { readonly userId: string; readonly mediaId: string },
): Promise<{
  readonly id: string;
  readonly contentType: string;
  readonly storageKey: string;
  readonly storageProvider: string;
} | null> {
  const row = await client.mediaFile.findFirst({
    where: {
      id: input.mediaId,
      ownerUserId: input.userId,
      ownerType: "BOOKING_ATTACHMENT",
      status: "READY",
    },
    select: {
      id: true,
      contentType: true,
      storageKey: true,
      storageProvider: true,
    },
  });
  if (row === null || !IMAGE_TYPES.has(row.contentType)) {
    return null;
  }
  return row;
}
