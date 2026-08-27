
import {
  assertEscortMembership,
  assertTeamTransition,
  assertWorkerTransition,
  isQualifyingWorker,
  normalizeSkills,
  normalizeWorkforceLabel,
  validateReason,
  validateWorkerProfile,
} from "../../../src/modules/providers/domain/provider-workforce.policy.js";
import { resolveWorkforceLocale } from "../../../src/modules/providers/domain/provider-workforce-notification.policy.js";
import { mapPrismaWorkforceError } from "../../../src/modules/providers/infrastructure/provider-workforce.prisma-errors.js";
import { buildWorkerProfile } from "../../helpers/r1-p07-workforce-fixtures.js";

describe("R1-P07 foundation policies", () => {
  it("normalizes labels and rejects duplicate normalized skills", () => {
    expect(normalizeWorkforceLabel("  Deep   CLEANING ")).toBe("deep cleaning");
    expect(() => normalizeSkills(["Deep Cleaning", " deep   cleaning "])).toThrow("WORKFORCE_SKILL_DUPLICATE");
  });

  it("validates complete E.164 profiles and closed type/gender facts", () => {
    expect(() => validateWorkerProfile({
      ...buildWorkerProfile(),
      gender: "FEMALE",
      operationalPhoneE164: "+201012345678",
    })).not.toThrow();
    expect(() => validateWorkerProfile({
      ...buildWorkerProfile(),
      gender: "FEMALE",
      operationalPhoneE164: "01012345678",
    })).toThrow("WORKFORCE_PHONE_INVALID");
  });

  it("enforces terminal lifecycle matrices", () => {
    expect(() => assertWorkerTransition("DRAFT", "ACTIVE")).not.toThrow();
    expect(() => assertWorkerTransition("REMOVED", "ACTIVE")).toThrow("WORKFORCE_INVALID_WORKER_TRANSITION");
    expect(() => assertTeamTransition("INACTIVE", "ARCHIVED")).not.toThrow();
    expect(() => assertTeamTransition("ARCHIVED", "ACTIVE")).toThrow("WORKFORCE_INVALID_TEAM_TRANSITION");
  });

  it("enforces command-specific reasons, meaningful notes, and Escort cleans=false", () => {
    expect(() => validateReason("WORKER_DEACTIVATE", "SECURITY_CONCERN")).toThrow("WORKFORCE_REASON_INVALID");
    expect(() => validateReason("WORKER_REMOVE", "ENGAGEMENT_ENDED", "too short")).toThrow("WORKFORCE_REASON_NOTE_REQUIRED");
    expect(() => validateReason("ACCESS_REVOKE", "SECURITY_CONCERN")).not.toThrow();
    expect(() => assertEscortMembership("ESCORT", true)).toThrow("WORKFORCE_ESCORT_CANNOT_CLEAN");
  });

  it("derives post-acceptance locale and worker readiness without Team membership", () => {
    expect(resolveWorkforceLocale({ preferredLanguage: "EN", acceptedInvitationLocale: "AR" })).toBe("EN");
    expect(resolveWorkforceLocale({ preferredLanguage: "XX", acceptedInvitationLocale: "EN" })).toBe("EN");
    expect(resolveWorkforceLocale({ preferredLanguage: null, acceptedInvitationLocale: null })).toBe("AR");
    expect(isQualifyingWorker({ status: "ACTIVE", profileComplete: true, workerType: "CLEANING_STAFF", identityActive: true, workerRoleEnabled: true, loginAccessActive: true })).toBe(true);
    expect(isQualifyingWorker({ status: "ACTIVE", profileComplete: true, workerType: "ESCORT", identityActive: true, workerRoleEnabled: true, loginAccessActive: true })).toBe(false);
  });

  it("maps Prisma failures to closed safe codes without constraint details", () => {
    const unique = mapPrismaWorkforceError({
      code: "P2002",
      meta: { constraint: "provider_workers_current_identity_unique" },
    });
    expect(unique?.code).toBe("WORKFORCE_STATE_CONFLICT");
    expect(JSON.stringify(unique?.safeDetails ?? {})).not.toContain("provider_workers_current_identity_unique");
    expect(mapPrismaWorkforceError({ code: "P2025" })?.code).toBe("WORKFORCE_RESOURCE_NOT_FOUND");
    expect(mapPrismaWorkforceError({ code: "P2034" })?.code).toBe("WORKFORCE_STATE_CONFLICT");
    expect(mapPrismaWorkforceError({ code: "P2010", meta: { code: "55000" } })?.code)
      .toBe("WORKFORCE_STATE_CONFLICT");
    expect(mapPrismaWorkforceError({
      code: "P2010",
      meta: { driverAdapterError: { cause: { originalCode: "23514" } } },
    })?.code).toBe("WORKFORCE_STATE_CONFLICT");
    expect(mapPrismaWorkforceError({
      name: "DriverAdapterError",
      cause: { kind: "postgres", code: "23514", originalCode: "23514" },
    })?.code).toBe("WORKFORCE_STATE_CONFLICT");
    expect(mapPrismaWorkforceError({
      name: "DriverAdapterError",
      cause: { kind: "postgres", code: "42601", originalCode: "42601" },
    })).toBeNull();
    expect(mapPrismaWorkforceError({ code: "P2010", meta: { code: "42601" } })).toBeNull();
    expect(mapPrismaWorkforceError(new Error("database down"))).toBeNull();
  });
});
