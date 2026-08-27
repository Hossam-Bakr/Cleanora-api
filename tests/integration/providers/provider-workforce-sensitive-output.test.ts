
import { sanitizeHttpLogUrl } from "../../../src/middlewares/http-logger.js";
import { assertSafeNotificationIntent } from "../../../src/modules/providers/domain/provider-workforce-notification.policy.js";
import { assertSafeWorkforceNote } from "../../../src/modules/providers/domain/provider-workforce.policy.js";
import { assertSafeWorkforceFacts } from "../../../src/modules/providers/provider-workforce.dto.js";
import { sanitizeLogContext } from "../../../src/shared/logger.js";
import { R1_P07_SENTINELS } from "../../helpers/r1-p07-workforce-fixtures.js";

describe("R1-P07 generic sensitive-output defenses", () => {
  it("keeps query, fragment, control injection, and secret path values out of the HTTP access URL", () => {
    const raw = `/api/v1/worker-invitations/proof/${R1_P07_SENTINELS.invitationProof}`
      + `?token=${R1_P07_SENTINELS.invitationProof}#${R1_P07_SENTINELS.storageKey}%0aFORGED`;
    const safe = sanitizeHttpLogUrl(raw);

    expect(safe).toBe("/api/v1/worker-invitations/proof/[REDACTED]");
    expect(safe).not.toContain(R1_P07_SENTINELS.invitationProof);
    expect(safe).not.toContain(R1_P07_SENTINELS.storageKey);
    expect(safe).not.toMatch(/[?#\r\n]/u);
  });

  it("redacts workforce proof, phone, email, credential, and storage-key fields recursively in application logs", () => {
    const safe = sanitizeLogContext({
      invitationProof: R1_P07_SENTINELS.invitationProof,
      operationalPhone: R1_P07_SENTINELS.operationalPhone,
      nested: {
        emailNormalized: "private@example.invalid",
        credential: R1_P07_SENTINELS.password,
        storageKey: R1_P07_SENTINELS.storageKey,
      },
      safeCode: "WORKFORCE_STATE_CONFLICT",
    });

    expect(safe).toEqual({
      invitationProof: "[REDACTED]",
      operationalPhone: "[REDACTED]",
      nested: {
        emailNormalized: "[REDACTED]",
        credential: "[REDACTED]",
        storageKey: "[REDACTED]",
      },
      safeCode: "WORKFORCE_STATE_CONFLICT",
    });
    expect(JSON.stringify(safe)).not.toContain(R1_P07_SENTINELS.invitationProof);
  });

  it("rejects forbidden markers at any history depth and rejects sensitive free-form notes", () => {
    for (const facts of [
      { operationalPhoneE164: R1_P07_SENTINELS.operationalPhone },
      { nested: { invitationProof: R1_P07_SENTINELS.invitationProof } },
      { before: [{ storageKey: R1_P07_SENTINELS.storageKey }] },
    ]) {
      expect(() => assertSafeWorkforceFacts(facts))
        .toThrowError(expect.objectContaining({ code: "WORKFORCE_HISTORY_UNSAFE" }));
    }

    for (const note of [
      `Call ${R1_P07_SENTINELS.operationalPhone} before removal`,
      `email: private@example.invalid`,
      `proof=${R1_P07_SENTINELS.invitationProof}`,
      `storageKey=${R1_P07_SENTINELS.storageKey}`,
    ]) {
      expect(() => assertSafeWorkforceNote(note))
        .toThrowError(expect.objectContaining({ code: "WORKFORCE_VALIDATION_FAILED" }));
    }
    expect(() => assertSafeWorkforceNote("Repeated policy breach documented by the owner"))
      .not.toThrow();
  });

  it("uses an exact notification-variable allowlist and exactly one recipient", () => {
    const base = {
      providerId: "provider-1",
      template: "WORKER_REMOVED" as const,
      locale: "AR" as const,
      recipientUserId: "user-1",
      historyId: "history-1",
      idempotencyKey: "worker:worker-1:removed:8",
    };
    expect(() => assertSafeNotificationIntent({
      ...base,
      safeVariables: { workerVersion: 8, reasonCode: "ENGAGEMENT_ENDED" },
    })).not.toThrow();

    for (const safeVariables of [
      { message: R1_P07_SENTINELS.invitationProof },
      { operationalPhone: R1_P07_SENTINELS.operationalPhone },
      { workerVersion: 0 },
      { reasonCode: "unsafe free text" },
    ]) {
      expect(() => assertSafeNotificationIntent({ ...base, safeVariables }))
        .toThrowError(expect.objectContaining({ code: "WORKFORCE_NOTIFICATION_UNSAFE" }));
    }

    expect(() => assertSafeNotificationIntent({
      ...base,
      recipientEmailNormalized: "private@example.invalid",
      safeVariables: { workerVersion: 8 },
    })).toThrowError(expect.objectContaining({ code: "WORKFORCE_NOTIFICATION_RECIPIENT_INVALID" }));
  });
});
