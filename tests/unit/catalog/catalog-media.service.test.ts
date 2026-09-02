
import type { AuthenticationPrincipal } from "../../../src/modules/authentication/authentication.public.js";
import { CatalogError } from "../../../src/modules/catalog/catalog.errors.js";
import { CatalogService } from "../../../src/modules/catalog/catalog.service.js";
import type {
  CatalogRepository,
  CatalogUnitOfWorkDependencies,
} from "../../../src/modules/catalog/catalog.repository.js";
import type {
  CatalogServiceImagePort,
  CatalogServiceImageReceipt,
  TransactionalCatalogServiceImageAuthorizer,
} from "../../../src/modules/media/media.public.js";
import type { Logger } from "../../../src/shared/logger.js";

/**
 * T101 — reserve → ingest → final READY reauthorization/CAS → atomic
 * association/audit/receipt, including same-key resume (FR-035, FR-038–FR-041).
 * Media and Catalog fakes only — not a live Prisma/Media proof.
 */

const principal: AuthenticationPrincipal = {
  userId: "user_staff_admin",
  sessionId: "session_1",
  accountCategories: [],
  verifiedCategories: [],
  pendingCategories: [],
  status: "ACTIVE",
  verificationOnly: false,
};

const noopLogger: Logger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
  child() {
    return this;
  },
};

const readyReceipt: CatalogServiceImageReceipt = {
  mediaFileId: "media_reserved_1",
  ownerUserId: principal.userId,
  state: "READY",
  canonicalContentType: "image/webp",
  byteSize: 2048,
  width: 800,
  height: 600,
  safeReceiptId: "receipt_1",
};

/** Intended US4 CatalogService media surface (not yet implemented). */
type CatalogMediaService = CatalogService & {
  uploadServiceMedia(
    command: {
      readonly serviceId: string;
      readonly expectedVersion: number;
      readonly idempotencyKey: string;
      readonly reasonCode: "catalog_management_change";
      readonly declaredContentType: string;
      readonly bytes: Buffer;
    },
    meta: { readonly principal: AuthenticationPrincipal },
  ): Promise<{
    readonly replayed: boolean;
    readonly acceptedVersion: number;
    readonly association: {
      readonly mediaFileId: string;
      readonly displayOrder: number;
    };
  }>;
};

function allowAllAuthorization() {
  return {
    authorizeProtectedOperation: vi.fn(async () => ({
      allowed: true as const,
    })),
  };
}

function createMediaFake(options?: {
  readonly ingest?: CatalogServiceImagePort["ingest"];
}): CatalogServiceImagePort & {
  readonly cleanupCalls: string[];
} {
  const cleanupCalls: string[] = [];
  return {
    cleanupCalls,
    ingest:
      options?.ingest ??
      (async (input) => ({
        ...readyReceipt,
        mediaFileId: input.mediaFileId,
      })),
    readValidationReceipt: async () => readyReceipt,
    issueDelivery: async () => ({
      url: "https://example.invalid/delivery",
      expiresAt: new Date("2026-08-31T12:05:00.000Z"),
    }),
    requestCleanup: async (input) => {
      cleanupCalls.push(input.mediaFileId);
    },
  };
}

function createOrchestrationHarness(options?: {
  readonly reservedMediaFileId?: string;
  readonly reserveResult?: "proceed" | "resume" | "replay";
  readonly authorizerAllows?: boolean;
  readonly media?: ReturnType<typeof createMediaFake>;
}) {
  const media = options?.media ?? createMediaFake();
  const reservedMediaFileId = options?.reservedMediaFileId ?? "media_reserved_1";
  const authorizer: TransactionalCatalogServiceImageAuthorizer = {
    assertReadyCatalogServiceImage: vi.fn(async () => options?.authorizerAllows ?? true),
  };
  const auditAppend = vi.fn(async () => ({
    id: "audit_1",
    createdAt: "2026-08-31T12:00:00.000Z",
  }));
  const insertAssociation = vi.fn(async () => ({
    id: "assoc_1",
    serviceId: "svc_1",
    mediaFileId: reservedMediaFileId,
    displayOrder: 0,
  }));
  const completeCommand = vi.fn(async () => ({
    id: "cmd_1",
    status: "COMPLETED" as const,
    targetType: "SERVICE",
    targetId: "svc_1",
    acceptedVersion: 2,
    replayed: false,
  }));
  const bumpVersion = vi.fn(async () => 2);

  const reserveOrReplayCommand = vi.fn(async () => {
    if (options?.reserveResult === "replay") {
      return {
        id: "cmd_replay",
        status: "COMPLETED" as const,
        targetType: "SERVICE",
        targetId: "svc_1",
        acceptedVersion: 2,
        replayed: true,
      };
    }
    if (options?.reserveResult === "resume") {
      return {
        id: "cmd_pending",
        status: "PENDING" as const,
        targetType: "SERVICE",
        targetId: "svc_1",
        acceptedVersion: null,
        replayed: false,
        reservedMediaFileId,
      };
    }
    return "proceed" as const;
  });

  const uowDeps: CatalogUnitOfWorkDependencies = {
    tx: {} as CatalogUnitOfWorkDependencies["tx"],
    activeCountryReader: {
      resolveActiveCountry: async () => ({ id: "country_eg", code: "EG" }),
      getActiveCountryById: async () => null,
    },
    privilegedAuditWriter: { append: auditAppend },
    catalogServiceImageAuthorizer: authorizer,
  };

  const repository = {
    unitOfWork: {
      runInTransaction: async <T>(
        work: (deps: CatalogUnitOfWorkDependencies) => Promise<T>,
      ) => work(uowDeps),
    },
    reserveOrReplayCommand,
    completeCommand,
    findService: vi.fn(async () => ({
      id: "svc_1",
      categoryId: "cat_1",
      code: "STANDARD_HOME_CLEANING",
      displayOrder: 0,
      isActive: false,
      version: 1,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      translations: [],
    })),
    lockServiceMediaAssociations: vi.fn(async () => []),
    insertServiceMediaAssociation: insertAssociation,
    bumpServiceVersion: bumpVersion,
  } as unknown as CatalogRepository;

  const service = new CatalogService({
    authorization: allowAllAuthorization(),
    repository,
    logger: noopLogger,
    catalogServiceImage: media,
    createMediaFileId: () => reservedMediaFileId,
  } as never) as CatalogMediaService;

  return {
    service,
    media,
    authorizer,
    auditAppend,
    insertAssociation,
    completeCommand,
    bumpVersion,
    reserveOrReplayCommand,
    reservedMediaFileId,
  };
}

describe("catalog media service orchestration (T101, Media+Catalog fakes)", () => {
  it("reserves a stable media id, ingests outside the Catalog tx, then finalizes association/audit/receipt atomically", async () => {
    const harness = createOrchestrationHarness();
    const result = await harness.service.uploadServiceMedia(
      {
        serviceId: "svc_1",
        expectedVersion: 1,
        idempotencyKey: "00000000-0000-4000-8000-000000000801",
        reasonCode: "catalog_management_change",
        declaredContentType: "image/png",
        bytes: Buffer.from("fake-png"),
      },
      { principal },
    );

    expect(result.replayed).toBe(false);
    expect(result.association).toEqual(
      expect.objectContaining({
        mediaFileId: harness.reservedMediaFileId,
        displayOrder: 0,
      }),
    );
    expect(result.acceptedVersion).toBe(2);
    expect(harness.insertAssociation).toHaveBeenCalledTimes(1);
    expect(harness.auditAppend).toHaveBeenCalledTimes(1);
    expect(harness.completeCommand).toHaveBeenCalledTimes(1);
    expect(harness.bumpVersion).toHaveBeenCalledTimes(1);
    expect(harness.authorizer.assertReadyCatalogServiceImage).toHaveBeenCalledWith({
      mediaFileId: harness.reservedMediaFileId,
      uploaderUserId: principal.userId,
    });
    expect(JSON.stringify(result)).not.toMatch(/storageKey|api_secret/iu);
  });

  it("resumes the same reserved mediaFileId for a PENDING same-key retry", async () => {
    const media = createMediaFake();
    const ingest = vi.fn(media.ingest);
    media.ingest = ingest;
    const harness = createOrchestrationHarness({
      reserveResult: "resume",
      reservedMediaFileId: "media_resume_1",
      media,
    });

    const result = await harness.service.uploadServiceMedia(
      {
        serviceId: "svc_1",
        expectedVersion: 1,
        idempotencyKey: "00000000-0000-4000-8000-000000000802",
        reasonCode: "catalog_management_change",
        declaredContentType: "image/jpeg",
        bytes: Buffer.from("fake-jpeg"),
      },
      { principal },
    );

    expect(ingest).toHaveBeenCalledWith(
      expect.objectContaining({ mediaFileId: "media_resume_1" }),
    );
    expect(result.association.mediaFileId).toBe("media_resume_1");
    expect(harness.media.cleanupCalls).toEqual([]);
  });

  it("replays a COMPLETED same-key upload without a second association, audit, or version bump", async () => {
    const harness = createOrchestrationHarness({ reserveResult: "replay" });
    const result = await harness.service.uploadServiceMedia(
      {
        serviceId: "svc_1",
        expectedVersion: 1,
        idempotencyKey: "00000000-0000-4000-8000-000000000803",
        reasonCode: "catalog_management_change",
        declaredContentType: "image/webp",
        bytes: Buffer.from("fake-webp"),
      },
      { principal },
    );

    expect(result.replayed).toBe(true);
    expect(harness.insertAssociation).not.toHaveBeenCalled();
    expect(harness.auditAppend).not.toHaveBeenCalled();
    expect(harness.bumpVersion).not.toHaveBeenCalled();
  });

  it("fails closed when final READY reauthorization rejects the reserved media", async () => {
    const harness = createOrchestrationHarness({ authorizerAllows: false });
    await expect(
      harness.service.uploadServiceMedia(
        {
          serviceId: "svc_1",
          expectedVersion: 1,
          idempotencyKey: "00000000-0000-4000-8000-000000000804",
          reasonCode: "catalog_management_change",
          declaredContentType: "image/png",
          bytes: Buffer.from("fake-png"),
        },
        { principal },
      ),
    ).rejects.toBeInstanceOf(CatalogError);
    expect(harness.insertAssociation).not.toHaveBeenCalled();
    expect(harness.completeCommand).not.toHaveBeenCalled();
    expect(harness.media.cleanupCalls).toContain(harness.reservedMediaFileId);
  });

  it("rejects a safe READY receipt whose mediaFileId does not match the reserved id", async () => {
    const foreignReceipt: CatalogServiceImageReceipt = {
      ...readyReceipt,
      mediaFileId: "media_foreign_other",
    };
    const media = createMediaFake({
      ingest: async () => foreignReceipt,
    });
    const harness = createOrchestrationHarness({
      reservedMediaFileId: "media_reserved_match_required",
      media,
    });

    await expect(
      harness.service.uploadServiceMedia(
        {
          serviceId: "svc_1",
          expectedVersion: 1,
          idempotencyKey: "00000000-0000-4000-8000-000000000805",
          reasonCode: "catalog_management_change",
          declaredContentType: "image/webp",
          bytes: Buffer.from("fake-webp"),
        },
        { principal },
      ),
    ).rejects.toMatchObject({
      code: "CATALOG_MEDIA_INVALID",
    });

    expect(harness.authorizer.assertReadyCatalogServiceImage).not.toHaveBeenCalled();
    expect(harness.insertAssociation).not.toHaveBeenCalled();
    expect(harness.completeCommand).not.toHaveBeenCalled();
    expect(harness.auditAppend).not.toHaveBeenCalled();
    expect(harness.bumpVersion).not.toHaveBeenCalled();
    expect(harness.media.cleanupCalls).toEqual(["media_reserved_match_required"]);
    expect(harness.media.cleanupCalls).not.toContain("media_foreign_other");
  });
});
