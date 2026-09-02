
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
} from "../../../src/modules/media/media.public.js";
import type { Logger } from "../../../src/shared/logger.js";

/**
 * T102 — protected auth/reason/CAS/audit failure compensation with Media cleanup
 * (FR-031–FR-035, FR-038–FR-041, SC-006–SC-008). Fake orchestration only.
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
  mediaFileId: "media_comp_1",
  ownerUserId: principal.userId,
  state: "READY",
  canonicalContentType: "image/png",
  byteSize: 1024,
  width: 400,
  height: 300,
  safeReceiptId: "receipt_comp_1",
};

function createMediaFake(): CatalogServiceImagePort & {
  readonly cleanupCalls: Array<{ mediaFileId: string; safeReasonCode: string }>;
} {
  const cleanupCalls: Array<{ mediaFileId: string; safeReasonCode: string }> = [];
  return {
    cleanupCalls,
    ingest: async (input) => ({
      ...readyReceipt,
      mediaFileId: input.mediaFileId,
    }),
    readValidationReceipt: async () => readyReceipt,
    issueDelivery: async () => ({
      url: "https://example.invalid/delivery",
      expiresAt: new Date(),
    }),
    requestCleanup: async (input) => {
      cleanupCalls.push({
        mediaFileId: input.mediaFileId,
        safeReasonCode: input.safeReasonCode,
      });
    },
  };
}

function createCompensationHarness(options: {
  readonly authorize?: () => Promise<
    { allowed: true } | { allowed: false; denialCode: "PERMISSION_DENIED" }
  >;
  readonly reasonValid?: boolean;
  readonly expectedVersion?: number;
  readonly currentVersion?: number;
  readonly auditFails?: boolean;
}) {
  const media = createMediaFake();
  const insertAssociation = vi.fn(async () => ({
    id: "assoc_1",
    serviceId: "svc_1",
    mediaFileId: "media_comp_1",
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
  const auditAppend = vi.fn(async () => {
    if (options.auditFails) {
      throw new Error("synthetic audit failure");
    }
    return { id: "audit_1", createdAt: "2026-08-31T12:00:00.000Z" };
  });

  const uowDeps: CatalogUnitOfWorkDependencies = {
    tx: {} as CatalogUnitOfWorkDependencies["tx"],
    activeCountryReader: {
      resolveActiveCountry: async () => ({ id: "country_eg", code: "EG" }),
      getActiveCountryById: async () => null,
    },
    privilegedAuditWriter: { append: auditAppend },
    catalogServiceImageAuthorizer: {
      assertReadyCatalogServiceImage: async () => true,
    },
  };

  const repository = {
    unitOfWork: {
      runInTransaction: async <T>(
        work: (deps: CatalogUnitOfWorkDependencies) => Promise<T>,
      ) => work(uowDeps),
    },
    reserveOrReplayCommand: vi.fn(async () => "proceed" as const),
    completeCommand,
    findService: vi.fn(async () => ({
      id: "svc_1",
      categoryId: "cat_1",
      code: "STANDARD_HOME_CLEANING",
      displayOrder: 0,
      isActive: false,
      version: options.currentVersion ?? 1,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      translations: [],
    })),
    lockServiceMediaAssociations: vi.fn(async () => []),
    insertServiceMediaAssociation: insertAssociation,
    bumpServiceVersion: bumpVersion,
  } as unknown as CatalogRepository;

  const service = new CatalogService({
    authorization: {
      authorizeProtectedOperation:
        options.authorize ??
        (async () => ({ allowed: true as const })),
    },
    repository,
    logger: noopLogger,
    catalogServiceImage: media,
    createMediaFileId: () => "media_comp_1",
    ...(options.reasonValid === false
      ? { reasonLookup: async () => null }
      : {}),
  } as never) as CatalogService & {
    uploadServiceMedia: (
      command: {
        readonly serviceId: string;
        readonly expectedVersion: number;
        readonly idempotencyKey: string;
        readonly reasonCode: "catalog_management_change";
        readonly declaredContentType: string;
        readonly bytes: Buffer;
      },
      meta: { readonly principal: AuthenticationPrincipal },
    ) => Promise<unknown>;
  };

  return {
    service,
    media,
    insertAssociation,
    completeCommand,
    bumpVersion,
    auditAppend,
  };
}

const uploadCommand = {
  serviceId: "svc_1",
  expectedVersion: 1,
  idempotencyKey: "00000000-0000-4000-8000-000000000901",
  reasonCode: "catalog_management_change" as const,
  declaredContentType: "image/png",
  bytes: Buffer.from("fake-png"),
};

describe("catalog media compensation (T102, fake orchestration)", () => {
  it("requests Media cleanup and commits no association when authorization is denied", async () => {
    const harness = createCompensationHarness({
      authorize: async () => ({
        allowed: false,
        denialCode: "PERMISSION_DENIED",
      }),
    });
    await expect(
      harness.service.uploadServiceMedia(uploadCommand, { principal }),
    ).rejects.toMatchObject({ code: "CATALOG_FORBIDDEN" });
    expect(harness.insertAssociation).not.toHaveBeenCalled();
    expect(harness.completeCommand).not.toHaveBeenCalled();
    expect(harness.bumpVersion).not.toHaveBeenCalled();
  });

  it("requests Media cleanup and commits no association on CAS version conflict", async () => {
    const harness = createCompensationHarness({
      currentVersion: 3,
      expectedVersion: 1,
    });
    await expect(
      harness.service.uploadServiceMedia(
        { ...uploadCommand, expectedVersion: 1 },
        { principal },
      ),
    ).rejects.toMatchObject({ code: "CATALOG_VERSION_CONFLICT" });
    expect(harness.insertAssociation).not.toHaveBeenCalled();
    expect(harness.media.cleanupCalls.map((call) => call.mediaFileId)).toContain(
      "media_comp_1",
    );
    expect(
      harness.media.cleanupCalls.every((call) =>
        /^[A-Z0-9_]+$/u.test(call.safeReasonCode),
      ),
    ).toBe(true);
  });

  it("requests Media cleanup and commits no association when privileged audit fails", async () => {
    const harness = createCompensationHarness({ auditFails: true });
    await expect(
      harness.service.uploadServiceMedia(uploadCommand, { principal }),
    ).rejects.toBeInstanceOf(Error);
    expect(harness.insertAssociation).not.toHaveBeenCalled();
    expect(harness.completeCommand).not.toHaveBeenCalled();
    expect(harness.media.cleanupCalls.map((call) => call.mediaFileId)).toContain(
      "media_comp_1",
    );
  });

  it("maps Media dependency failures to CATALOG_MEDIA_UNAVAILABLE without leaking provider detail", async () => {
    const media = createMediaFake();
    media.ingest = async () => {
      throw new Error("Cloudinary API secret xyz failed at https://api.cloudinary.com");
    };
    const service = new CatalogService({
      authorization: {
        authorizeProtectedOperation: async () => ({ allowed: true }),
      },
      repository: {
        unitOfWork: {
          runInTransaction: async <T>(
            work: (deps: CatalogUnitOfWorkDependencies) => Promise<T>,
          ) =>
            work({
              tx: {} as CatalogUnitOfWorkDependencies["tx"],
              activeCountryReader: {
                resolveActiveCountry: async () => ({ id: "country_eg", code: "EG" }),
                getActiveCountryById: async () => null,
              },
              privilegedAuditWriter: {
                append: async () => ({
                  id: "audit_1",
                  createdAt: "2026-08-31T12:00:00.000Z",
                }),
              },
              catalogServiceImageAuthorizer: {
                assertReadyCatalogServiceImage: async () => true,
              },
            }),
        },
        reserveOrReplayCommand: vi.fn(async () => "proceed" as const),
        completeCommand: vi.fn(),
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
        insertServiceMediaAssociation: vi.fn(),
        bumpServiceVersion: vi.fn(),
      } as unknown as CatalogRepository,
      logger: noopLogger,
      catalogServiceImage: media,
    } as never) as CatalogService & {
      uploadServiceMedia: (
        command: typeof uploadCommand,
        meta: { readonly principal: AuthenticationPrincipal },
      ) => Promise<unknown>;
    };

    try {
      await service.uploadServiceMedia(uploadCommand, { principal });
      expect.unreachable("expected Media dependency failure");
    } catch (error) {
      expect(error).toBeInstanceOf(CatalogError);
      expect((error as CatalogError).code).toBe("CATALOG_MEDIA_UNAVAILABLE");
      expect((error as CatalogError).message).not.toMatch(
        /cloudinary|api\.|secret|https?:\/\//iu,
      );
    }
  });
});
