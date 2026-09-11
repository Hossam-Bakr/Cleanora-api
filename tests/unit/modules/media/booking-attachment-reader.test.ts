import { createBookingAttachmentReader } from "#modules/media/infrastructure/prisma-booking-attachment.reader";

describe("booking attachment reader", () => {
  it("accepts READY owned images and rejects other files", async () => {
    const findFirst = vi
      .fn()
      .mockResolvedValueOnce({
        id: "media-1",
        contentType: "image/png",
        storageKey: "key-1",
        storageProvider: "CLOUDINARY",
      })
      .mockResolvedValueOnce({
        id: "media-2",
        contentType: "application/pdf",
        storageKey: "key-2",
        storageProvider: "CLOUDINARY",
      })
      .mockResolvedValueOnce(null);
    const reader = createBookingAttachmentReader({
      mediaFile: { findFirst },
    });
    await expect(
      reader.readOwnedReadyImage({ userId: "user-1", mediaId: "media-1" }),
    ).resolves.toEqual({ mediaId: "media-1", contentType: "image/png" });
    await expect(
      reader.readOwnedReadyImage({ userId: "user-1", mediaId: "media-2" }),
    ).resolves.toBeNull();
    await expect(
      reader.readOwnedReadyImage({ userId: "user-1", mediaId: "missing" }),
    ).resolves.toBeNull();
  });

  it("signs owned READY images and omits URLs when signing fails", async () => {
    const findFirst = vi.fn().mockResolvedValue({
      id: "media-1",
      contentType: "image/jpeg",
      storageKey: "key-1",
      storageProvider: "CLOUDINARY",
    });
    const unsigned = createBookingAttachmentReader({
      mediaFile: { findFirst },
    });
    await expect(
      unsigned.signOwnedReadyImage({ userId: "user-1", mediaId: "media-1" }),
    ).resolves.toBeNull();

    const createAuthorizedDeliveryUrl = vi
      .fn()
      .mockResolvedValueOnce({
        url: "https://cdn.example/signed",
        urlExpiresAt: "2026-09-10T12:00:00.000Z",
      })
      .mockRejectedValueOnce(new Error("sign-failed"));
    const signed = createBookingAttachmentReader(
      { mediaFile: { findFirst } },
      {
        storage: { createAuthorizedDeliveryUrl } as never,
        signedUrlTtlSeconds: 60,
      },
    );
    await expect(
      signed.signOwnedReadyImage({ userId: "user-1", mediaId: "media-1" }),
    ).resolves.toEqual({
      url: "https://cdn.example/signed",
      urlExpiresAt: "2026-09-10T12:00:00.000Z",
    });
    await expect(
      signed.signOwnedReadyImage({ userId: "user-1", mediaId: "media-1" }),
    ).resolves.toBeNull();
  });
});
