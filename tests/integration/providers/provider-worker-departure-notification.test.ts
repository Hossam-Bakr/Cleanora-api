
import { assertSafeNotificationIntent, resolveWorkforceLocale } from "../../../src/modules/providers/domain/provider-workforce-notification.policy.js";

describe("Worker departure notification intent", () => {
  it("uses the Provider Owner preference and contains no Worker contact or credential material", () => {
    const intent = {
      providerId: "provider-1",
      template: "WORKER_DEPARTED" as const,
      locale: resolveWorkforceLocale({ preferredLanguage: "EN", acceptedInvitationLocale: null }),
      recipientUserId: "owner-1",
      historyId: "history-1",
      safeVariables: { workerVersion: 8 },
      idempotencyKey: "worker:worker-1:departure:8",
    };
    expect(() => assertSafeNotificationIntent(intent)).not.toThrow();
    expect(intent.locale).toBe("EN");
    expect(JSON.stringify(intent)).not.toMatch(/(?:phone|proof|password|token|credential|emailNormalized)/iu);
  });

  it("rejects ambiguous recipients and sensitive template variables", () => {
    expect(() => assertSafeNotificationIntent({
      providerId: "provider-1",
      template: "WORKER_DEPARTED",
      locale: "AR",
      recipientUserId: "owner-1",
      recipientEmailNormalized: "owner@example.invalid",
      safeVariables: { workerVersion: 8 },
      idempotencyKey: "intent-1",
    })).toThrowError(expect.objectContaining({ code: "WORKFORCE_NOTIFICATION_RECIPIENT_INVALID" }));
    expect(() => assertSafeNotificationIntent({
      providerId: "provider-1",
      template: "WORKER_DEPARTED",
      locale: "AR",
      recipientUserId: "owner-1",
      safeVariables: { operationalPhone: "+201011111111" },
      idempotencyKey: "intent-2",
    })).toThrowError(expect.objectContaining({ code: "WORKFORCE_NOTIFICATION_UNSAFE" }));
  });
});
