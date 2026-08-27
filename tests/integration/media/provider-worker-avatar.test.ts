import sharp from "sharp";

import {
  PrismaTransactionalWorkerAvatarAuthorizer,
  PrismaWorkerAvatarPersistence,
  SharpWorkerAvatarProcessor,
  WorkerAvatarAdapter,
} from "../../../src/modules/media/infrastructure/worker-avatar.adapter.js";
import {
  createTransactionalWorkerAvatarAuthorizer,
  createWorkerAvatarPort,
} from "../../../src/modules/media/infrastructure/media-provider.factory.js";
import { createTestEnvironment } from "../../helpers/test-environment.js";
import type { WorkerAvatarPort, WorkerAvatarReceipt } from "../../../src/modules/media/media.public.js";
import type {
  ProvidersWorkforceTransactionContext,
  ProvidersWorkforceUnitOfWorkPort,
  WorkerSnapshot,
} from "../../../src/modules/providers/domain/provider-workforce.types.js";
import { ProviderWorkforceMediaService } from "../../../src/modules/providers/provider-workforce-media.service.js";

const readyReceipt: WorkerAvatarReceipt = {
  mediaFileId: "media-1", ownerUserId: "owner-1", state: "READY",
  canonicalContentType: "image/webp", byteSize: 100, width: 320, height: 320,
  safeReceiptId: "receipt-1",
};

describe("Worker avatar Media adapter", () => {
  it("composes the Worker avatar pipeline from the existing private Cloudinary configuration", () => {
    const avatar = createWorkerAvatarPort({
      environment: createTestEnvironment({
        MEDIA_STORAGE_PROVIDER: "cloudinary",
        CLOUDINARY_CLOUD_NAME: "demo",
        CLOUDINARY_API_KEY: "key",
        CLOUDINARY_API_SECRET: "secret",
        CLOUDINARY_PROFILE_IMAGE_FOLDER: "cleanora-providers",
        CLOUDINARY_SIGNED_URL_TTL_SECONDS: 300,
        MEDIA_IMAGE_MAX_BYTES: 5 * 1024 * 1024,
      }),
      database: { mediaFile: {} },
      sdk: { config: vi.fn(), uploader: {}, url: vi.fn() } as never,
    });
    expect(avatar.ingest).toBeTypeOf("function");
    expect(avatar.issuePrivateDelivery).toBeTypeOf("function");
  });

  it("builds the transaction-bound exact Worker-avatar authorizer without exposing Media persistence", async () => {
    const findUnique = vi.fn()
      .mockResolvedValueOnce({ ownerUserId: "owner-1", ownerType: "WORKER_PROFILE_IMAGE", status: "READY" })
      .mockResolvedValueOnce(null);
    const authorizer = createTransactionalWorkerAvatarAuthorizer({ mediaFile: { findUnique } });
    await expect(authorizer.assertReadyOwnedProfileImage({ mediaFileId: "media-1", ownerUserId: "owner-1" })).resolves.toBe(true);
    await expect(authorizer.assertReadyOwnedProfileImage({ mediaFileId: "missing", ownerUserId: "owner-1" })).resolves.toBe(false);
    expect(findUnique).toHaveBeenCalledWith({ where: { id: "media-1" } });
  });
  it.each(["image/jpeg", "image/png", "image/webp"])("processes accepted %s input to private WebP", async (contentType) => {
    const sourceContentType = contentType as "image/jpeg" | "image/png" | "image/webp";
    const processor = { process: vi.fn(async () => ({ bytes: Buffer.from("webp"), width: 1200, height: 800, contentType: "image/webp" as const, sourceContentType })) };
    const persistence = {
      reserveAndStore: vi.fn(async () => readyReceipt),
      readReceipt: vi.fn(async () => readyReceipt),
      privateDelivery: vi.fn(async () => ({ url: "https://example.invalid/private", expiresAt: new Date() })),
      cleanup: vi.fn(async () => undefined),
    };
    const adapter = new WorkerAvatarAdapter(processor, persistence);
    await expect(adapter.ingest({ ownerUserId: "owner-1", declaredContentType: contentType, bytes: Buffer.from("valid-image") })).resolves.toEqual(readyReceipt);
    expect(persistence.reserveAndStore).toHaveBeenCalledWith(expect.objectContaining({ contentType: "image/webp", width: 1200, height: 800 }));
  });

  it("rejects unsupported, empty, oversized, or out-of-policy processed input", async () => {
    const processor = { process: vi.fn(async () => ({ bytes: Buffer.from("webp"), width: 1201, height: 800, contentType: "image/webp" as const, sourceContentType: "image/png" as const })) };
    const persistence = {
      reserveAndStore: vi.fn(async () => readyReceipt), readReceipt: vi.fn(), privateDelivery: vi.fn(), cleanup: vi.fn(),
    };
    const adapter = new WorkerAvatarAdapter(processor, persistence);
    await expect(adapter.ingest({ ownerUserId: "owner-1", declaredContentType: "image/gif", bytes: Buffer.from("gif") })).rejects.toMatchObject({ code: "MEDIA_IMAGE_INVALID" });
    await expect(adapter.ingest({ ownerUserId: "owner-1", declaredContentType: "image/png", bytes: Buffer.alloc(0) })).rejects.toMatchObject({ code: "MEDIA_IMAGE_INVALID" });
    await expect(adapter.ingest({ ownerUserId: "owner-1", declaredContentType: "image/png", bytes: Buffer.alloc(5 * 1024 * 1024 + 1) })).rejects.toMatchObject({ code: "MEDIA_IMAGE_TOO_LARGE" });
    await expect(adapter.ingest({ ownerUserId: "owner-1", declaredContentType: "image/png", bytes: Buffer.from("image") })).rejects.toMatchObject({ code: "MEDIA_IMAGE_INVALID" });
    expect(persistence.reserveAndStore).not.toHaveBeenCalled();
  });

  it("decodes, rotates, strips metadata, bounds, and emits a WebP rendition through Sharp", async () => {
    const input = await sharp({
      create: { width: 1600, height: 800, channels: 3, background: "#268f60" },
    }).withMetadata({ orientation: 6 }).jpeg().toBuffer();
    const processed = await new SharpWorkerAvatarProcessor().process(input);
    const metadata = await sharp(processed.bytes).metadata();
    expect(processed).toMatchObject({
      sourceContentType: "image/jpeg",
      contentType: "image/webp",
    });
    expect(Math.max(processed.width, processed.height)).toBeLessThanOrEqual(1200);
    expect(metadata.format).toBe("webp");
    expect(metadata.orientation).toBeUndefined();
    expect(metadata.exif).toBeUndefined();
  });

  it("rejects malformed bytes and a decoded type that disagrees with the declared MIME", async () => {
    await expect(new SharpWorkerAvatarProcessor().process(Buffer.from("not-an-image")))
      .rejects.toMatchObject({ code: "MEDIA_IMAGE_INVALID" });
    const persistence = {
      reserveAndStore: vi.fn(async () => readyReceipt), readReceipt: vi.fn(), privateDelivery: vi.fn(), cleanup: vi.fn(),
    };
    const mismatched = new WorkerAvatarAdapter({
      process: vi.fn(async () => ({
        bytes: Buffer.from("webp"), width: 100, height: 100,
        contentType: "image/webp" as const, sourceContentType: "image/jpeg" as const,
      })),
    }, persistence);
    await expect(mismatched.ingest({
      ownerUserId: "owner-1",
      declaredContentType: "image/png",
      bytes: Buffer.from("image"),
    })).rejects.toMatchObject({ code: "MEDIA_IMAGE_INVALID" });
    expect(persistence.reserveAndStore).not.toHaveBeenCalled();
  });

  it("reserves, stores privately, finalizes, delivers by signed URL, and exposes no storage key", async () => {
    type MediaRow = {
      id: string; ownerUserId: string; ownerType: "WORKER_PROFILE_IMAGE"; storageProvider: "CLOUDINARY";
      storageKey: string; contentType: string; byteSize: number; width: number | null;
      height: number | null; status: string;
    };
    let row: MediaRow | null = null;
    const repository = {
      createPendingUpload: vi.fn(async (input: Omit<MediaRow, "status">) => { row = { ...input, status: "PENDING_UPLOAD" }; }),
      findById: vi.fn(async () => row),
      markStatus: vi.fn(async (_id: string, status: "READY" | "FAILED", extra?: Readonly<Record<string, unknown>>) => {
        if (row !== null) row = { ...row, ...extra, status } as typeof row;
      }),
      markPendingDelete: vi.fn(async () => undefined),
    };
    const storage = {
      storeProfileImage: vi.fn(async () => ({
        provider: "CLOUDINARY" as const, storageKey: "private-key", contentType: "image/webp" as const,
        byteSize: 100, width: 320, height: 320, uploadResourceType: "image" as const, uploadType: "authenticated" as const,
      })),
      createAuthorizedDeliveryUrl: vi.fn(async (_reference: unknown, expiresAt: Date) => ({
        url: "https://example.invalid/signed", urlExpiresAt: expiresAt.toISOString(),
      })),
      remove: vi.fn(async () => ({ destroyResult: "ok" as const })),
    };
    const persistence = new PrismaWorkerAvatarPersistence({
      repository,
      storage,
      createId: () => "media-1",
      createStorageKey: () => "private-key",
      signedUrlTtlSeconds: 300,
      now: () => new Date("2026-08-22T12:00:00.000Z"),
    });
    const receipt = await persistence.reserveAndStore({
      ownerUserId: "owner-1", bytes: Buffer.from("webp"), contentType: "image/webp", width: 320, height: 320,
    });
    expect(receipt).toEqual(expect.objectContaining({ mediaFileId: "media-1", state: "READY", ownerUserId: "owner-1" }));
    expect(JSON.stringify(receipt)).not.toContain("private-key");
    expect(repository.createPendingUpload).toHaveBeenCalledWith(expect.objectContaining({ ownerType: "WORKER_PROFILE_IMAGE" }));
    await expect(persistence.privateDelivery("media-1")).resolves.toEqual({
      url: "https://example.invalid/signed",
      expiresAt: new Date("2026-08-22T12:05:00.000Z"),
    });
    await persistence.cleanup("media-1", "WORKER_AVATAR_REPLACED_OR_REMOVED");
    expect(repository.markPendingDelete).toHaveBeenCalledWith("media-1");
  });

  it("marks a reserved Worker avatar failed when private storage fails", async () => {
    const repository = {
      createPendingUpload: vi.fn(async () => undefined),
      findById: vi.fn(async () => null),
      markStatus: vi.fn(async () => undefined),
      markPendingDelete: vi.fn(async () => undefined),
    };
    const persistence = new PrismaWorkerAvatarPersistence({
      repository,
      storage: {
        storeProfileImage: vi.fn(async () => { throw new Error("synthetic storage failure"); }),
        createAuthorizedDeliveryUrl: vi.fn(),
        remove: vi.fn(),
      },
      createId: () => "media-failed",
      createStorageKey: () => "private-key",
      signedUrlTtlSeconds: 300,
    });
    await expect(persistence.reserveAndStore({
      ownerUserId: "owner-1", bytes: Buffer.from("webp"), contentType: "image/webp", width: 320, height: 320,
    })).rejects.toThrow("synthetic storage failure");
    expect(repository.markStatus).toHaveBeenCalledWith("media-failed", "FAILED", expect.objectContaining({ cleanupEligibleAt: expect.any(Date) }));
  });

  it("transactionally authorizes only the exact READY Worker-profile receipt owner", async () => {
    const read = vi.fn(async () => ({ ownerUserId: "owner-1", ownerType: "WORKER_PROFILE_IMAGE", status: "READY" }));
    const authorizer = new PrismaTransactionalWorkerAvatarAuthorizer({ read });
    await expect(authorizer.assertReadyOwnedProfileImage({ mediaFileId: "media-1", ownerUserId: "owner-1" })).resolves.toBe(true);
    await expect(authorizer.assertReadyOwnedProfileImage({ mediaFileId: "media-1", ownerUserId: "owner-2" })).resolves.toBe(false);
  });
});

const worker: WorkerSnapshot = {
  id: "worker-1", providerId: "provider-1", identityUserId: null, predecessorWorkerId: null,
  status: "DRAFT", version: 1, acceptedInvitationLocale: null, endedAt: null,
  profile: {
    fullLegalName: "Synthetic Worker", gender: "FEMALE", operationalPhoneE164: "+201012345678",
    workerType: "CLEANING_STAFF", displayTitle: null, supervisorCapable: false, skills: [],
    avatarMediaFileId: null, version: 1,
  }, access: null,
};

function mediaHarness(options: {
  readonly transactionFails?: boolean;
  readonly avatarMediaFileId?: string | null;
  readonly replay?: boolean;
} = {}) {
  const currentWorker: WorkerSnapshot = {
    ...worker,
    profile: { ...worker.profile, avatarMediaFileId: options.avatarMediaFileId ?? null },
  };
  const avatar: WorkerAvatarPort = {
    ingest: vi.fn(async () => readyReceipt),
    readValidationReceipt: vi.fn(async () => readyReceipt),
    issuePrivateDelivery: vi.fn(async () => ({ url: "https://example.invalid/private", expiresAt: new Date() })),
    requestCleanup: vi.fn(async () => undefined),
  };
  const setWorkerAvatar = vi.fn(async (input: { readonly mediaFileId: string | null }) => ({
    ...currentWorker,
    profile: { ...currentWorker.profile, avatarMediaFileId: input.mediaFileId, version: 2 },
  }));
  const context = {
    workforce: {
      lockProvider: vi.fn(async () => ({ id: "provider-1", workforceStateVersion: 1 })),
      readActorMembership: vi.fn(async () => ({ level: "OWNER" as const, active: true, version: 1 })),
      lockWorker: vi.fn(async () => currentWorker),
      setWorkerAvatar,
    },
    commands: {
      begin: vi.fn(async () => options.replay
        ? ({ replay: true, result: { outcomeCode: "WORKER_AVATAR_ASSOCIATED", targetId: "worker-1", version: 2, impacts: [] } })
        : ({ replay: false, result: null })),
      accept: vi.fn(async () => undefined),
    },
    history: { append: vi.fn(async () => ({ id: "history-1" })) },
    notifications: { insert: vi.fn(async () => undefined) },
    audit: { append: vi.fn(async () => ({ id: "audit-1", createdAt: new Date().toISOString() })) },
    avatarAuthorizer: { assertReadyOwnedProfileImage: vi.fn(async () => true) },
  } as unknown as ProvidersWorkforceTransactionContext;
  const unitOfWork: ProvidersWorkforceUnitOfWorkPort = {
    run: async (callback) => {
      if (options.transactionFails) throw new Error("synthetic transaction failure");
      return callback(context);
    },
  };
  return { service: new ProviderWorkforceMediaService({ unitOfWork, avatar }), avatar, setWorkerAvatar };
}

describe("Provider Worker avatar orchestration", () => {
  it("associates only the READY owned receipt inside the Providers transaction", async () => {
    const harness = mediaHarness();
    const result = await harness.service.upload({
      actorUserId: "owner-1", providerId: "provider-1", workerId: "worker-1",
      requestId: "00000000-0000-4000-8000-000000000131",
      idempotencyKey: "00000000-0000-4000-8000-000000000132",
      expectedVersion: 1, declaredContentType: "image/png", bytes: Buffer.from("image"),
    });
    expect(result.outcomeCode).toBe("WORKER_AVATAR_ASSOCIATED");
    expect(harness.setWorkerAvatar).toHaveBeenCalledWith(expect.objectContaining({ mediaFileId: "media-1", expectedProfileVersion: 1 }));
    expect(harness.avatar.requestCleanup).not.toHaveBeenCalled();
  });

  it("requests safe cleanup when the post-ingest transaction fails", async () => {
    const harness = mediaHarness({ transactionFails: true });
    await expect(harness.service.upload({
      actorUserId: "owner-1", providerId: "provider-1", workerId: "worker-1",
      requestId: "00000000-0000-4000-8000-000000000133",
      idempotencyKey: "00000000-0000-4000-8000-000000000134",
      expectedVersion: 1, declaredContentType: "image/png", bytes: Buffer.from("image"),
    })).rejects.toThrow("synthetic transaction failure");
    expect(harness.avatar.requestCleanup).toHaveBeenCalledWith({ mediaFileId: "media-1", safeReasonCode: "WORKER_AVATAR_ASSOCIATION_FAILED" });
    expect(harness.setWorkerAvatar).not.toHaveBeenCalled();
  });

  it("cleans the newly ingested orphan on an accepted idempotent replay", async () => {
    const harness = mediaHarness({ replay: true });
    await expect(harness.service.upload({
      actorUserId: "owner-1", providerId: "provider-1", workerId: "worker-1",
      requestId: "00000000-0000-4000-8000-000000000135",
      idempotencyKey: "00000000-0000-4000-8000-000000000136",
      expectedVersion: 1, declaredContentType: "image/png", bytes: Buffer.from("image"),
    })).resolves.toEqual(expect.objectContaining({ outcomeCode: "WORKER_AVATAR_ASSOCIATED", version: 2 }));
    expect(harness.setWorkerAvatar).not.toHaveBeenCalled();
    expect(harness.avatar.requestCleanup).toHaveBeenCalledWith({
      mediaFileId: "media-1",
      safeReasonCode: "WORKER_AVATAR_UNBOUND_REPLAY",
    });
  });

  it("removes the association by profile-version CAS and requests old-media cleanup after commit", async () => {
    const harness = mediaHarness({ avatarMediaFileId: "media-old" });
    const result = await harness.service.remove({
      actorUserId: "owner-1", providerId: "provider-1", workerId: "worker-1",
      requestId: "00000000-0000-4000-8000-000000000137",
      idempotencyKey: "00000000-0000-4000-8000-000000000138",
      expectedVersion: 1,
    });
    expect(result.outcomeCode).toBe("WORKER_AVATAR_REMOVED");
    expect(harness.setWorkerAvatar).toHaveBeenCalledWith(expect.objectContaining({
      mediaFileId: null,
      expectedProfileVersion: 1,
    }));
    expect(harness.avatar.requestCleanup).toHaveBeenCalledWith({
      mediaFileId: "media-old",
      safeReasonCode: "WORKER_AVATAR_REPLACED_OR_REMOVED",
    });
  });
});
