
import { CatalogService } from "../../../src/modules/catalog/catalog.service.js";
import type { CatalogRepository } from "../../../src/modules/catalog/catalog.repository.js";
import type { CatalogServiceImageReceipt } from "../../../src/modules/media/media.public.js";

/**
 * US2 OQ-002 neutrality and safe output redaction (FR-021, FR-033, FR-036).
 * T105 extends coverage for protected media delivery / internal reference
 * redaction (FR-036, FR-039–FR-044).
 */
describe("catalog output redaction", () => {
  it("does not allow localized labels or materials-supply flags into audit safe facts", () => {
    const service = new CatalogService({
      authorization: {
        authorizeProtectedOperation: async () => ({ allowed: true }),
      },
      repository: {} as CatalogRepository,
      logger: {
        debug() {},
        info() {},
        warn() {},
        error() {},
        child() {
          return this;
        },
      },
    });

    const safe = service.buildSafeAuditContext({
      serviceId: "svc_1",
      code: "STANDARD_HOME_CLEANING",
      version: 2,
      priceUnitCount: 2,
      fieldCount: 4,
      labelAr: "يجب إحضار المواد",
      labelEn: "Bring materials",
      materialsSupplyRequired: true,
      customerAnswer: "yes",
      idempotencyKey: "secret-key",
    });

    expect(safe).toEqual({
      serviceId: "svc_1",
      code: "STANDARD_HOME_CLEANING",
      version: 2,
      priceUnitCount: 2,
      fieldCount: 4,
    });
    expect(JSON.stringify(safe)).not.toMatch(
      /materials|label|answer|idempotency|supply/iu,
    );
  });

  it("configuration audit snapshots expose counts only, never localized graph text", () => {
    const service = new CatalogService({
      authorization: {
        authorizeProtectedOperation: async () => ({ allowed: true }),
      },
      repository: {} as CatalogRepository,
      logger: {
        debug() {},
        info() {},
        warn() {},
        error() {},
        child() {
          return this;
        },
      },
    });

    const snapshot = service.configurationAuditSnapshot({
      id: "svc_1",
      categoryId: "cat_1",
      code: "STANDARD_HOME_CLEANING",
      displayOrder: 0,
      isActive: false,
      version: 1,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      translations: [{ locale: "EN", name: "Secret", description: "Secret desc" }],
      priceUnits: [
        {
          id: "unit_1",
          code: "PER_VISIT",
          labelAr: "سر",
          labelEn: "Secret unit",
          displayOrder: 0,
          isActive: true,
        },
      ],
      fields: [
        {
          id: "field_1",
          code: "NOTES",
          kind: "TEXT",
          labelAr: "سر",
          labelEn: "Secret field",
          helpTextAr: null,
          helpTextEn: null,
          isRequired: false,
          isActive: true,
          minLength: null,
          maxLength: null,
          numberMode: null,
          minValue: null,
          maxValue: null,
          minSelections: null,
          maxSelections: null,
          displayOrder: 0,
          options: [],
        },
      ],
    });

    expect(snapshot).toEqual({
      serviceId: "svc_1",
      code: "STANDARD_HOME_CLEANING",
      version: 1,
      priceUnitCount: 1,
      fieldCount: 1,
      activePriceUnitCount: 1,
      activeFieldCount: 1,
    });
    expect(JSON.stringify(snapshot)).not.toMatch(/secret|label|translation/iu);
  });

  it("media audit snapshots expose association counts only — never uploader, storage key, or provider payload", () => {
    const service = new CatalogService({
      authorization: {
        authorizeProtectedOperation: async () => ({ allowed: true }),
      },
      repository: {} as CatalogRepository,
      logger: {
        debug() {},
        info() {},
        warn() {},
        error() {},
        child() {
          return this;
        },
      },
    }) as CatalogService & {
      mediaAuditSnapshot: (input: Readonly<Record<string, unknown>>) => Readonly<
        Record<string, string | number | boolean>
      >;
    };

    const snapshot = service.mediaAuditSnapshot({
      serviceId: "svc_1",
      code: "STANDARD_HOME_CLEANING",
      version: 3,
      associationCount: 2,
      mediaFileId: "media_secret",
      ownerUserId: "uploader_staff_secret",
      storageKey: "cloudinary/private/secret-key",
      providerPayload: { public_id: "secret", api_secret: "x" },
      privateUrl: "https://res.cloudinary.com/demo/private/secret",
    });

    expect(snapshot).toEqual({
      serviceId: "svc_1",
      code: "STANDARD_HOME_CLEANING",
      version: 3,
      associationCount: 2,
    });
    expect(JSON.stringify(snapshot)).not.toMatch(
      /uploader|storageKey|cloudinary|api_secret|privateUrl|ownerUserId|media_secret/iu,
    );
  });

  it("protected management media presentation redacts uploader and storage facts from delivery views", () => {
    const service = new CatalogService({
      authorization: {
        authorizeProtectedOperation: async () => ({ allowed: true }),
      },
      repository: {} as CatalogRepository,
      logger: {
        debug() {},
        info() {},
        warn() {},
        error() {},
        child() {
          return this;
        },
      },
    }) as CatalogService & {
      toManagementMediaPresentation: (input: {
        readonly associationId: string;
        readonly displayOrder: number;
        readonly receipt: CatalogServiceImageReceipt;
        readonly delivery: { readonly url: string; readonly expiresAt: Date };
      }) => Readonly<Record<string, unknown>>;
    };

    const receipt: CatalogServiceImageReceipt = {
      mediaFileId: "media_1",
      ownerUserId: "staff_uploader_1",
      state: "READY",
      canonicalContentType: "image/webp",
      byteSize: 2048,
      width: 640,
      height: 480,
      safeReceiptId: "receipt_1",
    };
    const view = service.toManagementMediaPresentation({
      associationId: "assoc_1",
      displayOrder: 0,
      receipt,
      delivery: {
        url: "https://example.invalid/signed-short-lived",
        expiresAt: new Date("2026-08-31T12:05:00.000Z"),
      },
    });

    expect(view).toEqual({
      associationId: "assoc_1",
      mediaId: "media_1",
      displayOrder: 0,
      status: "READY",
      contentType: "image/webp",
      width: 640,
      height: 480,
      deliveryUrl: "https://example.invalid/signed-short-lived",
      deliveryExpiresAt: "2026-08-31T12:05:00.000Z",
    });
    expect(JSON.stringify(view)).not.toMatch(
      /ownerUserId|uploader|storageKey|safeReceiptId|staff_uploader/iu,
    );
  });
});
