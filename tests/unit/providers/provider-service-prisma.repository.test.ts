import { Prisma } from "#generated/prisma/client";

import { ProviderServiceError } from "../../../src/modules/providers/domain/provider-service.errors.js";
import { PrismaProviderServiceRepository } from "../../../src/modules/providers/infrastructure/prisma-provider-service.repository.js";
import {
  R1_P09_IDS,
  R1_P09_SENTINELS,
} from "../../helpers/r1-p09-provider-services-fixtures.js";

const NOW = new Date("2026-09-05T12:00:00.000Z");

function offeringRow(version = 1) {
  return {
    id: R1_P09_IDS.providerServiceId,
    providerId: R1_P09_IDS.providerId,
    catalogServiceId: R1_P09_IDS.catalogServiceId,
    enabled: false,
    estimatedDurationMinutes: R1_P09_SENTINELS.estimatedDurationMinutes,
    noteAr: R1_P09_SENTINELS.noteAr,
    noteEn: R1_P09_SENTINELS.noteEn,
    version,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function priceRow(
  status: "PENDING" | "EFFECTIVE" | "REJECTED" | "SUPERSEDED" = "EFFECTIVE",
) {
  return {
    id: R1_P09_IDS.providerServicePriceId,
    providerId: R1_P09_IDS.providerId,
    providerServiceId: R1_P09_IDS.providerServiceId,
    catalogServiceId: R1_P09_IDS.catalogServiceId,
    catalogPriceUnitId: R1_P09_IDS.catalogPriceUnitId,
    priceUnitCodeAtProposal: R1_P09_IDS.catalogPriceUnitCode,
    countryIdAtProposal: R1_P09_IDS.countryId,
    countryCodeAtProposal: R1_P09_IDS.countryCode,
    currencyId: R1_P09_IDS.currencyId,
    currencyCode: R1_P09_IDS.currencyCode,
    currencyDecimalPlaces: 2,
    providerPriceMinorUnits: new Prisma.Decimal("12000"),
    minimumChargeMinorUnits: new Prisma.Decimal("15000"),
    maximumPriceMinorUnitsAtProposal: new Prisma.Decimal("999999"),
    approvalRequiredAtProposal: status === "PENDING",
    status,
    proposedByUserId: R1_P09_IDS.ownerUserId,
    effectiveAt: status === "EFFECTIVE" ? NOW : null,
    rejectedAt: status === "REJECTED" ? NOW : null,
    supersededAt: status === "SUPERSEDED" ? NOW : null,
    createdAt: NOW,
  };
}

const receiptFields = {
  scopeKey: "scope",
  idempotencyKey: R1_P09_IDS.idempotencyKey,
  requestFingerprint: "fp",
  safeResultCode: "OK",
  safeResultJson: {
    id: R1_P09_IDS.providerServiceId,
    providerId: R1_P09_IDS.providerId,
    version: 1,
  },
};

describe("prisma-provider-service.repository (mocked delegates)", () => {
  it("maps offering/price reads and writes through Prisma delegates", async () => {
    const db = {
      $queryRaw: vi
        .fn()
        .mockResolvedValueOnce([
          {
            id: R1_P09_IDS.providerId,
            application_status: "APPROVED",
            operational_status: "ACTIVE",
            country_id: R1_P09_IDS.countryId,
            country_code: R1_P09_IDS.countryCode,
          },
        ])
        .mockResolvedValueOnce([{ level: "OWNER", status: "ACTIVE" }])
        .mockResolvedValueOnce([{ id: R1_P09_IDS.providerServiceId }]),
      provider: {
        findUnique: vi.fn(async () => ({
          profile: { displayNameAr: "مزود", displayNameEn: "Provider" },
        })),
      },
      providerMember: {
        findUnique: vi.fn(async () => ({ level: "ADMIN", status: "ACTIVE" })),
      },
      providerService: {
        findFirst: vi.fn(async () => offeringRow()),
        findUnique: vi.fn(async () => offeringRow()),
        findMany: vi.fn(async () => [offeringRow()]),
        create: vi.fn(async () => offeringRow()),
        updateMany: vi.fn(async () => ({ count: 1 })),
      },
      providerServicePrice: {
        findFirst: vi.fn(async () => priceRow("EFFECTIVE")),
        findMany: vi.fn(async () => [
          {
            ...priceRow("PENDING"),
            providerService: { version: 3 },
            provider: {
              profile: { displayNameAr: "مزود", displayNameEn: "Provider" },
            },
          },
        ]),
        create: vi.fn(async () => priceRow("PENDING")),
        updateMany: vi.fn(async () => ({ count: 1 })),
      },
      providerServicePriceHistory: {
        findFirst: vi.fn(async () => null),
        create: vi.fn(async () => ({
          id: "ph-1",
          providerId: R1_P09_IDS.providerId,
          providerServiceId: R1_P09_IDS.providerServiceId,
          providerServicePriceId: R1_P09_IDS.providerServicePriceId,
          event: "PRICE_PROPOSED",
          fromStatus: null,
          toStatus: "PENDING",
          actorUserId: R1_P09_IDS.ownerUserId,
          reasonCode: "PROVIDER_SERVICE_PRICE_PROPOSED",
          reasonText: "reason",
          safeBefore: null,
          safeAfter: { status: "PENDING" },
          requestId: R1_P09_IDS.requestId,
          aggregateVersion: 1,
          ...receiptFields,
          operationKey: "op",
          createdAt: NOW,
        })),
        findMany: vi.fn(async () => []),
      },
      providerServiceStatusHistory: {
        findFirst: vi.fn(async () => ({
          id: "sh-1",
          providerId: R1_P09_IDS.providerId,
          providerServiceId: R1_P09_IDS.providerServiceId,
          event: "OFFERING_CREATED",
          fromEnabled: null,
          toEnabled: false,
          actorUserId: R1_P09_IDS.ownerUserId,
          reasonCode: "PROVIDER_SERVICE_CREATED",
          reasonText: null,
          safeBefore: null,
          safeAfter: { enabled: false },
          requestId: R1_P09_IDS.requestId,
          aggregateVersion: 1,
          ...receiptFields,
          operationKey: "op",
          createdAt: NOW,
        })),
        create: vi.fn(async () => ({
          id: "sh-2",
          providerId: R1_P09_IDS.providerId,
          providerServiceId: R1_P09_IDS.providerServiceId,
          event: "OFFERING_ENABLED",
          fromEnabled: false,
          toEnabled: true,
          actorUserId: R1_P09_IDS.ownerUserId,
          reasonCode: "PROVIDER_SERVICE_ENABLED",
          reasonText: "enable",
          safeBefore: { enabled: false },
          safeAfter: { enabled: true },
          requestId: R1_P09_IDS.requestId,
          aggregateVersion: 2,
          ...receiptFields,
          operationKey: "op",
          createdAt: NOW,
        })),
        findMany: vi.fn(async () => []),
      },
    };

    const repo = new PrismaProviderServiceRepository(db as never, { getCountryCodeById: async () => R1_P09_IDS.countryCode });

    expect(await repo.lockProviderScope(R1_P09_IDS.providerId)).toMatchObject({
      countryCode: R1_P09_IDS.countryCode,
    });
    expect(await repo.findProviderDisplayIdentity(R1_P09_IDS.providerId)).toEqual({
      displayNameAr: "مزود",
      displayNameEn: "Provider",
    });
    expect(
      await repo.findActorMembership(R1_P09_IDS.providerId, R1_P09_IDS.ownerUserId),
    ).toEqual({ level: "ADMIN", active: true });
    expect(
      await repo.lockActorMembership(R1_P09_IDS.providerId, R1_P09_IDS.ownerUserId),
    ).toEqual({ level: "OWNER", active: true });
    expect(
      await repo.findOffering(R1_P09_IDS.providerId, R1_P09_IDS.providerServiceId),
    ).toMatchObject({ id: R1_P09_IDS.providerServiceId });
    expect(
      await repo.lockOffering(R1_P09_IDS.providerId, R1_P09_IDS.providerServiceId),
    ).toMatchObject({ version: 1 });
    expect(
      await repo.findOfferingByCatalogService(
        R1_P09_IDS.providerId,
        R1_P09_IDS.catalogServiceId,
      ),
    ).toMatchObject({ catalogServiceId: R1_P09_IDS.catalogServiceId });
    expect(
      await repo.listOfferings(R1_P09_IDS.providerId, {
        limit: 10,
        cursorCreatedAt: NOW,
        cursorId: "cursor-id",
      }),
    ).toHaveLength(1);

    expect(
      await repo.createOffering({
        providerServiceId: R1_P09_IDS.providerServiceId,
        providerId: R1_P09_IDS.providerId,
        catalogServiceId: R1_P09_IDS.catalogServiceId,
        estimatedDurationMinutes: 90,
        notes: { noteAr: "a", noteEn: "b" },
        expectedCreateVersion: 0,
      }),
    ).toMatchObject({ enabled: false });

    db.providerService.findFirst = vi.fn(async () => offeringRow(2));
    expect(
      await repo.updateConfiguration({
        actorUserId: R1_P09_IDS.ownerUserId,
        providerId: R1_P09_IDS.providerId,
        providerServiceId: R1_P09_IDS.providerServiceId,
        requestId: R1_P09_IDS.requestId,
        idempotencyKey: R1_P09_IDS.idempotencyKey,
        expectedVersion: 1,
        estimatedDurationMinutes: 60,
        notes: { noteAr: null, noteEn: null },
      }),
    ).toMatchObject({ version: 2 });

    expect(
      await repo.setEnabled({
        actorUserId: R1_P09_IDS.ownerUserId,
        providerId: R1_P09_IDS.providerId,
        providerServiceId: R1_P09_IDS.providerServiceId,
        requestId: R1_P09_IDS.requestId,
        idempotencyKey: R1_P09_IDS.idempotencyKey,
        expectedVersion: 2,
        enabled: true,
      }),
    ).toMatchObject({ version: 2 });

    expect(
      await repo.bumpAggregateVersion({
        providerId: R1_P09_IDS.providerId,
        providerServiceId: R1_P09_IDS.providerServiceId,
        expectedVersion: 2,
      }),
    ).toMatchObject({ version: 2 });

    const createdPrice = await repo.createPrice({
      id: R1_P09_IDS.providerServicePriceId,
      providerId: R1_P09_IDS.providerId,
      providerServiceId: R1_P09_IDS.providerServiceId,
      catalogServiceId: R1_P09_IDS.catalogServiceId,
      catalogPriceUnitId: R1_P09_IDS.catalogPriceUnitId,
      priceUnitCodeAtProposal: R1_P09_IDS.catalogPriceUnitCode,
      countryIdAtProposal: R1_P09_IDS.countryId,
      countryCodeAtProposal: R1_P09_IDS.countryCode,
      currencyId: R1_P09_IDS.currencyId,
      currencyCode: R1_P09_IDS.currencyCode,
      currencyDecimalPlaces: 2,
      providerPriceMinorUnits: "12000",
      minimumChargeMinorUnits: "15000",
      maximumPriceMinorUnitsAtProposal: "999999",
      approvalRequiredAtProposal: true,
      status: "PENDING",
      proposedByUserId: R1_P09_IDS.ownerUserId,
      effectiveAt: null,
      createdAt: NOW,
    });
    expect(createdPrice.providerPriceMinorUnits).toBe("12000");

    expect(
      await repo.findPrice(
        R1_P09_IDS.providerId,
        R1_P09_IDS.providerServiceId,
        R1_P09_IDS.providerServicePriceId,
      ),
    ).toMatchObject({ status: "EFFECTIVE" });
    expect(
      await repo.findCurrentEffectivePrice(
        R1_P09_IDS.providerId,
        R1_P09_IDS.providerServiceId,
      ),
    ).toMatchObject({ status: "EFFECTIVE" });
    expect(
      await repo.findCurrentPendingPrice(
        R1_P09_IDS.providerId,
        R1_P09_IDS.providerServiceId,
      ),
    ).toMatchObject({ status: "EFFECTIVE" });

    db.providerServicePrice.findFirst = vi.fn(async () => priceRow("SUPERSEDED"));
    expect(
      await repo.transitionPriceStatus({
        providerId: R1_P09_IDS.providerId,
        providerServiceId: R1_P09_IDS.providerServiceId,
        providerServicePriceId: R1_P09_IDS.providerServicePriceId,
        fromStatus: "EFFECTIVE",
        toStatus: "SUPERSEDED",
        transitionedAt: NOW,
      }),
    ).toMatchObject({ status: "SUPERSEDED" });

    db.providerServicePrice.updateMany = vi.fn(async () => ({ count: 1 }));
    db.providerServicePrice.findFirst = vi.fn(async () => priceRow("REJECTED"));
    expect(
      await repo.transitionPriceStatus({
        providerId: R1_P09_IDS.providerId,
        providerServiceId: R1_P09_IDS.providerServiceId,
        providerServicePriceId: R1_P09_IDS.providerServicePriceId,
        fromStatus: "PENDING",
        toStatus: "REJECTED",
        transitionedAt: NOW,
      }),
    ).toMatchObject({ status: "REJECTED" });

    db.providerServicePrice.findFirst = vi.fn(async () => priceRow("EFFECTIVE"));
    expect(
      await repo.transitionPriceStatus({
        providerId: R1_P09_IDS.providerId,
        providerServiceId: R1_P09_IDS.providerServiceId,
        providerServicePriceId: R1_P09_IDS.providerServicePriceId,
        fromStatus: "PENDING",
        toStatus: "EFFECTIVE",
        transitionedAt: NOW,
      }),
    ).toMatchObject({ status: "EFFECTIVE" });

    expect(
      await repo.listPricesForOffering(
        R1_P09_IDS.providerId,
        R1_P09_IDS.providerServiceId,
        { limit: 5 },
      ),
    ).toHaveLength(1);

    expect(
      await repo.listPendingPricesForStaff({ limit: 5, countryCode: "EG" }),
    ).toEqual([
      expect.objectContaining({
        offeringVersion: 3,
        providerDisplayNameAr: "مزود",
      }),
    ]);

    expect(
      await repo.findReceipt({
        scopeKey: "scope",
        idempotencyKey: R1_P09_IDS.idempotencyKey,
      }),
    ).toMatchObject({ source: "STATUS_HISTORY", historyId: "sh-1" });

    expect(
      await repo.appendPriceHistory({
        providerId: R1_P09_IDS.providerId,
        providerServiceId: R1_P09_IDS.providerServiceId,
        providerServicePriceId: R1_P09_IDS.providerServicePriceId,
        event: "PRICE_PROPOSED_PENDING",
        fromStatus: null,
        toStatus: "PENDING",
        actorUserId: R1_P09_IDS.ownerUserId,
        reasonCode: "PROVIDER_SERVICE_PRICE_PROPOSED",
        reasonText: "reason",
        safeBefore: null,
        safeAfter: { status: "PENDING" },
        requestId: R1_P09_IDS.requestId,
        aggregateVersion: 1,
        operationKey: "op",
        receipt: receiptFields,
      }),
    ).toMatchObject({ id: "ph-1" });

    expect(
      await repo.appendStatusHistory({
        providerId: R1_P09_IDS.providerId,
        providerServiceId: R1_P09_IDS.providerServiceId,
        event: "OFFERING_ENABLED",
        fromEnabled: false,
        toEnabled: true,
        actorUserId: R1_P09_IDS.ownerUserId,
        reasonCode: "PROVIDER_SERVICE_ENABLED",
        reasonText: "enable",
        safeBefore: { enabled: false },
        safeAfter: { enabled: true },
        requestId: R1_P09_IDS.requestId,
        aggregateVersion: 2,
        operationKey: "op",
        receipt: receiptFields,
      }),
    ).toMatchObject({ event: "OFFERING_ENABLED" });

    expect(
      await repo.listPriceHistory({
        providerId: R1_P09_IDS.providerId,
        providerServiceId: R1_P09_IDS.providerServiceId,
        page: { limit: 10 },
      }),
    ).toEqual([]);
    expect(
      await repo.listManagementStatusHistory({
        providerId: R1_P09_IDS.providerId,
        providerServiceId: R1_P09_IDS.providerServiceId,
        page: { limit: 10 },
      }),
    ).toEqual([]);

    db.providerService.findMany = vi.fn(async () => [
      {
        ...offeringRow(),
        enabled: true,
        prices: [priceRow("EFFECTIVE")],
      },
    ]);
    expect(await repo.listReadinessProjections(R1_P09_IDS.providerId)).toEqual([
      expect.objectContaining({
        enabled: true,
        effectivePrice: expect.objectContaining({ status: "EFFECTIVE" }),
        pendingPrice: null,
      }),
    ]);

    db.providerService.findFirst = vi.fn(async () => ({
      ...offeringRow(),
      enabled: true,
      prices: [priceRow("EFFECTIVE")],
    }));
    expect(
      await repo.findEnabledOfferingWithEffectivePrice({
        providerId: R1_P09_IDS.providerId,
        catalogServiceId: R1_P09_IDS.catalogServiceId,
      }),
    ).toMatchObject({
      offering: expect.objectContaining({ enabled: true }),
      effectivePrice: expect.objectContaining({ status: "EFFECTIVE" }),
    });
  });

  it("returns nulls and maps create/transition failure paths", async () => {
    const db = {
      $queryRaw: vi.fn(async () => []),
      provider: { findUnique: vi.fn(async () => null) },
      providerMember: {
        findUnique: vi.fn(async () => ({ level: "MEMBER", status: "ACTIVE" })),
      },
      providerService: {
        findFirst: vi.fn(async () => null),
        findUnique: vi.fn(async () => null),
        findMany: vi.fn(async () => []),
        create: vi.fn(async () => {
          throw {
            code: "P2002",
            meta: { target: ["providerId", "catalogServiceId"] },
          };
        }),
        updateMany: vi.fn(async () => ({ count: 0 })),
      },
      providerServicePrice: {
        findFirst: vi.fn(async () => null),
        findMany: vi.fn(async () => []),
        create: vi.fn(async () => {
          throw {
            code: "P2002",
            meta: { constraint: "provider_service_prices_one_pending" },
          };
        }),
        updateMany: vi.fn(async () => ({ count: 0 })),
      },
      providerServicePriceHistory: {
        findFirst: vi.fn(async () => null),
        create: vi.fn(async () => {
          throw { code: "P2002", meta: { target: ["scope_key"] } };
        }),
        findMany: vi.fn(async () => []),
      },
      providerServiceStatusHistory: {
        findFirst: vi.fn(async () => null),
        create: vi.fn(async () => {
          throw new Error("boom");
        }),
        findMany: vi.fn(async () => []),
      },
    };
    const repo = new PrismaProviderServiceRepository(db as never);

    expect(await repo.lockProviderScope("missing")).toBeNull();
    expect(await repo.findProviderDisplayIdentity("missing")).toBeNull();
    expect(await repo.findActorMembership("p", "u")).toBeNull();
    expect(await repo.lockActorMembership("p", "u")).toBeNull();
    expect(await repo.lockOffering("p", "s")).toBeNull();
    expect(
      await repo.bumpAggregateVersion({
        providerId: "p",
        providerServiceId: "s",
        expectedVersion: 1,
      }),
    ).toBeNull();
    expect(
      await repo.findReceipt({
        scopeKey: "scope",
        idempotencyKey: R1_P09_IDS.idempotencyKey,
      }),
    ).toBeNull();
    expect(
      await repo.findEnabledOfferingWithEffectivePrice({
        providerId: "p",
        catalogServiceId: "c",
      }),
    ).toBeNull();

    await expect(
      repo.updateConfiguration({
        actorUserId: "u",
        providerId: "p",
        providerServiceId: "s",
        requestId: "req",
        idempotencyKey: "idem",
        expectedVersion: 1,
        estimatedDurationMinutes: 30,
        notes: { noteAr: null, noteEn: null },
      }),
    ).rejects.toMatchObject({ code: "PROVIDER_SERVICE_VERSION_CONFLICT" });

    await expect(
      repo.setEnabled({
        actorUserId: "u",
        providerId: "p",
        providerServiceId: "s",
        requestId: "req",
        idempotencyKey: "idem",
        expectedVersion: 1,
        enabled: true,
      }),
    ).rejects.toMatchObject({ code: "PROVIDER_SERVICE_VERSION_CONFLICT" });

    await expect(
      repo.createOffering({
        providerServiceId: "s",
        providerId: "p",
        catalogServiceId: "c",
        estimatedDurationMinutes: 30,
        notes: { noteAr: null, noteEn: null },
        expectedCreateVersion: 0,
      }),
    ).rejects.toMatchObject({ code: "PROVIDER_SERVICE_ALREADY_EXISTS" });

    await expect(
      repo.createPrice({
        id: "price",
        providerId: "p",
        providerServiceId: "s",
        catalogServiceId: "c",
        catalogPriceUnitId: "u",
        priceUnitCodeAtProposal: "PER_VISIT",
        countryIdAtProposal: "c1",
        countryCodeAtProposal: "EG",
        currencyId: "cur",
        currencyCode: "EGP",
        currencyDecimalPlaces: 2,
        providerPriceMinorUnits: "100",
        minimumChargeMinorUnits: "100",
        maximumPriceMinorUnitsAtProposal: "999",
        approvalRequiredAtProposal: true,
        status: "PENDING",
        proposedByUserId: "u",
        effectiveAt: null,
        createdAt: NOW,
      }),
    ).rejects.toMatchObject({ code: "PROVIDER_SERVICE_VERSION_CONFLICT" });

    await expect(
      repo.transitionPriceStatus({
        providerId: "p",
        providerServiceId: "s",
        providerServicePriceId: "price",
        fromStatus: "PENDING",
        toStatus: "EFFECTIVE",
        transitionedAt: NOW,
      }),
    ).rejects.toBeInstanceOf(ProviderServiceError);

    await expect(
      repo.appendPriceHistory({
        providerId: "p",
        providerServiceId: "s",
        providerServicePriceId: "price",
        event: "PRICE_PROPOSED_PENDING",
        fromStatus: null,
        toStatus: "PENDING",
        actorUserId: "u",
        reasonCode: "PROVIDER_SERVICE_PRICE_PROPOSED",
        reasonText: null,
        safeBefore: null,
        safeAfter: { status: "PENDING" },
        requestId: "r",
        aggregateVersion: 1,
        operationKey: "op",
        receipt: receiptFields,
      }),
    ).rejects.toMatchObject({ code: "PROVIDER_SERVICE_IDEMPOTENCY_CONFLICT" });

    await expect(
      repo.appendStatusHistory({
        providerId: "p",
        providerServiceId: "s",
        event: "OFFERING_ENABLED",
        fromEnabled: false,
        toEnabled: true,
        actorUserId: "u",
        reasonCode: "PROVIDER_SERVICE_ENABLED",
        reasonText: null,
        safeBefore: { enabled: false },
        safeAfter: { enabled: true },
        requestId: "r",
        aggregateVersion: 1,
        operationKey: "op",
        receipt: receiptFields,
      }),
    ).rejects.toThrow("boom");
  });
});
