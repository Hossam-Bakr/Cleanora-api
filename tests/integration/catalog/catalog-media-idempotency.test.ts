
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
 * T103 — PENDING/crash resume, same-key same-payload replay, and same-key
 * different-payload conflict (FR-035, FR-040, SC-006). Fake Catalog+Media only.
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
  mediaFileId: "media_idem_1",
  ownerUserId: principal.userId,
  state: "READY",
  canonicalContentType: "image/webp",
  byteSize: 1500,
  width: 640,
  height: 480,
  safeReceiptId: "receipt_idem_1",
};

function createMediaFake(): CatalogServiceImagePort & {
  ingestCalls: number;
} {
  return {
    ingestCalls: 0,
    async ingest(input) {
      this.ingestCalls += 1;
      return { ...readyReceipt, mediaFileId: input.mediaFileId };
    },
    readValidationReceipt: async () => readyReceipt,
    issueDelivery: async () => ({
      url: "https://example.invalid/delivery",
      expiresAt: new Date(),
    }),
    requestCleanup: async () => undefined,
  };
}

type ReserveOutcome =
  | "proceed"
  | {
      readonly kind: "resume";
      readonly reservedMediaFileId: string;
    }
  | {
      readonly kind: "replay";
      readonly acceptedVersion: number;
    }
  | {
      readonly kind: "conflict";
    };

function createIdempotencyHarness(options: {
  readonly reserve: ReserveOutcome;
}) {
  const media = createMediaFake();
  const insertAssociation = vi.fn(async (input: { readonly mediaFileId: string }) => ({
    id: "assoc_1",
    serviceId: "svc_1",
    mediaFileId: input.mediaFileId,
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
    if (options.reserve === "proceed") {
      return "proceed" as const;
    }
    if (options.reserve.kind === "conflict") {
      throw new CatalogError(
        "CATALOG_IDEMPOTENCY_CONFLICT",
        "Catalog command idempotency key reused with a different payload",
        { httpStatus: 409 },
      );
    }
    if (options.reserve.kind === "replay") {
      return {
        id: "cmd_replay",
        status: "COMPLETED" as const,
        targetType: "SERVICE",
        targetId: "svc_1",
        acceptedVersion: options.reserve.acceptedVersion,
        replayed: true,
      };
    }
    return {
      id: "cmd_pending",
      status: "PENDING" as const,
      targetType: "SERVICE",
      targetId: "svc_1",
      acceptedVersion: null,
      replayed: false,
      reservedMediaFileId: options.reserve.reservedMediaFileId,
    };
  });

  const uowDeps: CatalogUnitOfWorkDependencies = {
    tx: {} as CatalogUnitOfWorkDependencies["tx"],
    activeCountryReader: {
      resolveActiveCountry: async () => ({ id: "country_eg", code: "EG" }),
      getActiveCountryById: async () => null,
    },
    privilegedAuditWriter: {
      append: vi.fn(async () => ({
        id: "audit_1",
        createdAt: "2026-08-31T12:00:00.000Z",
      })),
    },
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
    authorization: {
      authorizeProtectedOperation: async () => ({ allowed: true }),
    },
    repository,
    logger: noopLogger,
    catalogServiceImage: media,
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
    ) => Promise<{
      readonly replayed: boolean;
      readonly acceptedVersion: number;
      readonly association: { readonly mediaFileId: string };
    }>;
  };

  return { service, media, insertAssociation, completeCommand, bumpVersion };
}

const baseCommand = {
  serviceId: "svc_1",
  expectedVersion: 1,
  idempotencyKey: "00000000-0000-4000-8000-000000000A01",
  reasonCode: "catalog_management_change" as const,
  declaredContentType: "image/webp",
  bytes: Buffer.from("fake-webp"),
};

describe("catalog media idempotency (T103, fake orchestration)", () => {
  it("resumes a PENDING reservation after a simulated crash with the same mediaFileId", async () => {
    const harness = createIdempotencyHarness({
      reserve: { kind: "resume", reservedMediaFileId: "media_crash_resume" },
    });
    const result = await harness.service.uploadServiceMedia(baseCommand, { principal });
    expect(result.association.mediaFileId).toBe("media_crash_resume");
    expect(harness.media.ingestCalls).toBe(1);
    expect(harness.insertAssociation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ mediaFileId: "media_crash_resume" }),
    );
  });

  it("replays same key + same payload without a second Media ingest or association write", async () => {
    const harness = createIdempotencyHarness({
      reserve: { kind: "replay", acceptedVersion: 4 },
    });
    const result = await harness.service.uploadServiceMedia(baseCommand, { principal });
    expect(result.replayed).toBe(true);
    expect(result.acceptedVersion).toBe(4);
    expect(harness.media.ingestCalls).toBe(0);
    expect(harness.insertAssociation).not.toHaveBeenCalled();
    expect(harness.bumpVersion).not.toHaveBeenCalled();
  });

  it("rejects same key + different payload as CATALOG_IDEMPOTENCY_CONFLICT", async () => {
    const harness = createIdempotencyHarness({ reserve: { kind: "conflict" } });
    await expect(
      harness.service.uploadServiceMedia(
        {
          ...baseCommand,
          bytes: Buffer.from("different-payload-bytes"),
        },
        { principal },
      ),
    ).rejects.toMatchObject({
      code: "CATALOG_IDEMPOTENCY_CONFLICT",
      httpStatus: 409,
    });
    expect(harness.media.ingestCalls).toBe(0);
    expect(harness.insertAssociation).not.toHaveBeenCalled();
  });
});
