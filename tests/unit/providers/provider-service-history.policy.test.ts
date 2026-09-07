
import { ProviderServiceError } from "../../../src/modules/providers/domain/provider-service.errors.js";
import {
  assertEnableAllowed,
  collectEnableBlockerCodes,
  isManagementVisibleStatusEvent,
  planPriceProposalSupersessions,
  REPLACED_BY_NEW_PROPOSAL_REASON_CODE,
  resolveLifecycleTransition,
  resolvePriceTransition,
  validateProviderReasonText,
} from "../../../src/modules/providers/domain/provider-service.policy.js";
import {
  toProviderServicePriceHistoryItemDto,
  toProviderServiceStatusHistoryItemDto,
} from "../../../src/modules/providers/provider-service.dto.js";
import {
  R1_P09_IDS,
  R1_P09_SENTINELS,
} from "../../helpers/r1-p09-provider-services-fixtures.js";

describe("provider-service history policy (T035)", () => {
  it("resolves proposal and supersession transitions with derived reason code", () => {
    expect(
      resolvePriceTransition({
        fromStatus: null,
        trigger: "PROPOSE_PENDING",
      }),
    ).toEqual({
      toStatus: "PENDING",
      event: "PRICE_PROPOSED_PENDING",
    });
    expect(
      resolvePriceTransition({
        fromStatus: null,
        trigger: "PROPOSE_IMMEDIATE",
      }),
    ).toEqual({
      toStatus: "EFFECTIVE",
      event: "PRICE_EFFECTIVE_IMMEDIATE",
    });
    expect(
      resolvePriceTransition({
        fromStatus: "PENDING",
        trigger: "SUPERSEDE_PENDING",
      }).event,
    ).toBe("PRICE_SUPERSEDED_PENDING");
    expect(
      resolvePriceTransition({
        fromStatus: "EFFECTIVE",
        trigger: "SUPERSEDE_EFFECTIVE",
      }).event,
    ).toBe("PRICE_SUPERSEDED_EFFECTIVE");
    expect(REPLACED_BY_NEW_PROPOSAL_REASON_CODE).toBe("REPLACED_BY_NEW_PROPOSAL");
  });

  it("plans supersessions: pending-only when approval required, pending+effective when immediate", () => {
    expect(
      planPriceProposalSupersessions({
        approvalRequired: true,
        priorPendingId: "pending-1",
        priorEffectiveId: "effective-1",
      }),
    ).toEqual({
      newStatus: "PENDING",
      supersedePendingId: "pending-1",
      supersedeEffectiveId: null,
    });

    expect(
      planPriceProposalSupersessions({
        approvalRequired: false,
        priorPendingId: "pending-1",
        priorEffectiveId: "effective-1",
      }),
    ).toEqual({
      newStatus: "EFFECTIVE",
      supersedePendingId: "pending-1",
      supersedeEffectiveId: "effective-1",
    });
  });

  it("rejects illegal terminal transitions", () => {
    expect(() =>
      resolvePriceTransition({
        fromStatus: "REJECTED",
        trigger: "STAFF_APPROVE",
      }),
    ).toThrow(ProviderServiceError);
    expect(() =>
      resolvePriceTransition({
        fromStatus: "SUPERSEDED",
        trigger: "SUPERSEDE_PENDING",
      }),
    ).toThrow(ProviderServiceError);
  });

  it("resolves enable/disable transitions and same-state no-ops", () => {
    expect(
      resolveLifecycleTransition({
        currentlyEnabled: false,
        action: "ENABLE",
      }),
    ).toMatchObject({
      kind: "TRANSITION",
      event: "OFFERING_ENABLED",
      toEnabled: true,
    });
    expect(
      resolveLifecycleTransition({
        currentlyEnabled: true,
        action: "DISABLE",
      }),
    ).toMatchObject({
      kind: "TRANSITION",
      event: "OFFERING_DISABLED",
      toEnabled: false,
    });
    expect(
      resolveLifecycleTransition({
        currentlyEnabled: true,
        action: "ENABLE",
      }),
    ).toEqual({ kind: "NO_OP", enabled: true });
    expect(
      resolveLifecycleTransition({
        currentlyEnabled: false,
        action: "DISABLE",
      }),
    ).toEqual({ kind: "NO_OP", enabled: false });
  });

  it("requires trimmed reasons of 1–1000 characters", () => {
    expect(validateProviderReasonText("  ready  ")).toBe("ready");
    expect(() => validateProviderReasonText("")).toThrow(ProviderServiceError);
    expect(() => validateProviderReasonText("   ")).toThrow(ProviderServiceError);
    expect(() => validateProviderReasonText("x".repeat(1001))).toThrow(
      ProviderServiceError,
    );
  });

  it("blocks enable when DEC-051 preconditions fail and allows when clear", () => {
    const blocked = collectEnableBlockerCodes({
      estimatedDurationMinutes: R1_P09_SENTINELS.estimatedDurationMinutes,
      noteAr: null,
      noteEn: null,
      catalogSelectable: false,
      priceUnitActive: true,
      hasEffectivePrice: false,
      hasPendingPrice: true,
    });
    expect(blocked).toEqual(
      expect.arrayContaining([
        "CATALOG_SERVICE_UNAVAILABLE",
        "PRICE_APPROVAL_PENDING",
      ]),
    );
    expect(() => assertEnableAllowed(blocked)).toThrow(ProviderServiceError);

    const clear = collectEnableBlockerCodes({
      estimatedDurationMinutes: R1_P09_SENTINELS.estimatedDurationMinutes,
      noteAr: null,
      noteEn: null,
      catalogSelectable: true,
      priceUnitActive: true,
      hasEffectivePrice: true,
      hasPendingPrice: false,
    });
    expect(clear).toEqual([]);
    expect(() => assertEnableAllowed(clear)).not.toThrow();
  });

  it("exposes only enable/disable events on management status history", () => {
    expect(isManagementVisibleStatusEvent("OFFERING_ENABLED")).toBe(true);
    expect(isManagementVisibleStatusEvent("OFFERING_DISABLED")).toBe(true);
    expect(isManagementVisibleStatusEvent("OFFERING_CREATED")).toBe(false);
    expect(isManagementVisibleStatusEvent("CONFIGURATION_UPDATED")).toBe(false);
  });

  it("maps history DTOs without receipt fields", () => {
    const now = new Date("2026-09-05T12:00:00.000Z");
    const priceDto = toProviderServicePriceHistoryItemDto({
      id: "ph-1",
      providerId: R1_P09_IDS.providerId,
      providerServiceId: R1_P09_IDS.providerServiceId,
      providerServicePriceId: R1_P09_IDS.providerServicePriceId,
      event: "PRICE_EFFECTIVE_IMMEDIATE",
      fromStatus: null,
      toStatus: "EFFECTIVE",
      actorUserId: R1_P09_IDS.ownerUserId,
      reasonCode: "PRICE_PROPOSAL",
      reasonText: R1_P09_SENTINELS.reasonText,
      safeBefore: null,
      safeAfter: { status: "EFFECTIVE", providerPrice: "120.00" },
      requestId: R1_P09_IDS.requestId,
      aggregateVersion: 2,
      operationKey: "price-proposal:x",
      receipt: {
        scopeKey: "scope",
        idempotencyKey: R1_P09_IDS.idempotencyKey,
        requestFingerprint: "f".repeat(64),
        safeResultCode: "PROVIDER_SERVICE_PRICE_PROPOSED",
        safeResultJson: { id: "x" },
      },
      createdAt: now,
    });
    expect(priceDto).not.toHaveProperty("scopeKey");
    expect(priceDto).not.toHaveProperty("idempotencyKey");
    expect(priceDto).not.toHaveProperty("requestFingerprint");
    expect(priceDto).not.toHaveProperty("safeResultCode");
    expect(priceDto).not.toHaveProperty("safeResultJson");
    expect(priceDto).not.toHaveProperty("receipt");
    expect(priceDto.aggregateVersion).toBe(2);

    const statusDto = toProviderServiceStatusHistoryItemDto({
      id: "sh-1",
      providerId: R1_P09_IDS.providerId,
      providerServiceId: R1_P09_IDS.providerServiceId,
      event: "OFFERING_ENABLED",
      fromEnabled: false,
      toEnabled: true,
      actorUserId: R1_P09_IDS.ownerUserId,
      reasonCode: "OFFERING_ENABLED",
      reasonText: R1_P09_SENTINELS.reasonText,
      safeBefore: { enabled: false },
      safeAfter: { enabled: true },
      requestId: R1_P09_IDS.requestId,
      aggregateVersion: 3,
      operationKey: "lifecycle:OFFERING_ENABLED:x:3",
      receipt: {
        scopeKey: "scope",
        idempotencyKey: R1_P09_IDS.idempotencyKey,
        requestFingerprint: "f".repeat(64),
        safeResultCode: "PROVIDER_SERVICE_ENABLED",
        safeResultJson: { id: "x" },
      },
      createdAt: now,
    });
    expect(statusDto.event).toBe("OFFERING_ENABLED");
    expect(statusDto).not.toHaveProperty("scopeKey");
    expect(statusDto).not.toHaveProperty("safeResultJson");
  });
});
