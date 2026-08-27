
import type { EmailMessage } from "../../../src/integrations/email/email.types.js";
import type { WorkerInvitationSnapshot } from "../../../src/modules/providers/domain/provider-workforce.types.js";
import { ProviderWorkforceEmailDeliveryAdapter } from "../../../src/modules/providers/infrastructure/provider-workforce-email-delivery.adapter.js";
import type { LeasedWorkforceNotification } from "../../../src/modules/providers/infrastructure/prisma-provider-workforce-notification.repository.js";
import { HmacWorkerInvitationProofAdapter } from "../../../src/modules/providers/infrastructure/worker-invitation-proof.adapter.js";
import { ProviderWorkforceNotificationDispatcher } from "../../../src/modules/providers/provider-workforce-notification.dispatcher.js";

const now = new Date("2026-08-23T11:00:00.000Z");
const invitation: WorkerInvitationSnapshot = {
  id: "invitation-1", workerId: "worker-1", invitationVersion: 2,
  emailNormalized: "worker@example.invalid", locale: "EN", status: "PENDING", version: 3,
  issuedByUserId: "owner-1", acceptedByUserId: null,
  issuedAt: now, expiresAt: new Date(now.getTime() + 60_000), acceptedAt: null,
  revokedAt: null, expiredAt: null, supersededAt: null,
};

function leased(overrides: Partial<LeasedWorkforceNotification> = {}): LeasedWorkforceNotification {
  return {
    id: "intent-1",
    template: "INVITATION_ISSUED",
    locale: "EN",
    recipientUserId: null,
    recipientEmailNormalized: invitation.emailNormalized,
    invitationId: invitation.id,
    historyId: "history-1",
    idempotencyKey: "worker:worker-1:invitation:2",
    safeVariables: { invitationVersion: 2 },
    ...overrides,
  };
}

describe("Worker notification locale and durable delivery failure", () => {
  it.each(["AR", "EN"] as const)("renders the stored exact %s locale and regenerates proof only for the SMTP body", async (locale) => {
    const send = vi.fn(async (_message: EmailMessage) => undefined);
    const proof = new HmacWorkerInvitationProofAdapter("synthetic-workforce-email-secret-at-least-32-bytes");
    const adapter = new ProviderWorkforceEmailDeliveryAdapter({
      email: { send },
      identityReader: { getIdentity: vi.fn(), findByEmailNormalized: vi.fn() },
      invitationProof: proof,
      readInvitation: vi.fn(async () => ({ ...invitation, locale })),
      invitationAcceptPath: "/api/v1/worker-invitations/inspect",
    });
    await adapter.deliver(leased({ locale }));
    const message = send.mock.calls[0]?.[0];
    expect(message).toBeDefined();
    expect(message?.to).toEqual([invitation.emailNormalized]);
    expect(message?.idempotencyKey).toBe("worker:worker-1:invitation:2");
    expect(message?.text).toContain("Invitation proof:");
    expect(message?.subject).not.toContain(invitation.emailNormalized);
    expect(message?.idempotencyKey).not.toContain(invitation.emailNormalized);
    const generatedProof = message?.text.split("Invitation proof:\n")[1];
    expect(generatedProof).toBeTruthy();
    expect(message?.subject).not.toContain(generatedProof!);
    expect(message?.idempotencyKey).not.toContain(generatedProof!);
  });

  it("resolves accepted-user email through Authentication and emits no operational phone", async () => {
    const send = vi.fn(async (_message: EmailMessage) => undefined);
    const adapter = new ProviderWorkforceEmailDeliveryAdapter({
      email: { send },
      identityReader: {
        getIdentity: vi.fn(async () => ({ userId: "user-1", status: "ACTIVE" as const, isAccountActive: true, emailNormalized: "user@example.invalid", workerRoleEnabled: true, providerSupervisorRoleEnabled: false, preferredLanguage: "AR" as const })),
        findByEmailNormalized: vi.fn(),
      },
      invitationProof: new HmacWorkerInvitationProofAdapter("synthetic-workforce-email-secret-at-least-32-bytes"),
      readInvitation: vi.fn(),
      invitationAcceptPath: "/api/v1/worker-invitations/inspect",
    });
    await adapter.deliver(leased({ template: "WORKER_REMOVED", locale: "AR", recipientUserId: "user-1", recipientEmailNormalized: null, invitationId: null }));
    expect(send.mock.calls[0]?.[0]?.to).toEqual(["user@example.invalid"]);
    expect(JSON.stringify(send.mock.calls[0]?.[0])).not.toMatch(/\+2010|operationalPhone/iu);
  });

  it("marks SMTP failure for retry without changing or deleting the accepted intent", async () => {
    const row = leased({ template: "WORKER_DEPARTED", recipientUserId: "owner-1", recipientEmailNormalized: null, invitationId: null });
    const repository = {
      lease: vi.fn(async () => [row]),
      markSent: vi.fn(async () => undefined),
      markFailed: vi.fn(async () => undefined),
    };
    const dispatcher = new ProviderWorkforceNotificationDispatcher(
      repository,
      { deliver: vi.fn(async () => { throw new Error("synthetic SMTP outage"); }) },
      () => now,
    );
    await expect(dispatcher.dispatch()).resolves.toEqual({ sent: 0, failed: 1 });
    expect(repository.markSent).not.toHaveBeenCalled();
    expect(repository.markFailed).toHaveBeenCalledWith(
      row.id,
      "WORKFORCE_EMAIL_DELIVERY_FAILED",
      new Date(now.getTime() + 60_000),
    );
    expect(row.idempotencyKey).toBe("worker:worker-1:invitation:2");
  });

  it("never sends a superseded or terminal invitation intent", async () => {
    const send = vi.fn(async (_message: EmailMessage) => undefined);
    const adapter = new ProviderWorkforceEmailDeliveryAdapter({
      email: { send },
      identityReader: { getIdentity: vi.fn(), findByEmailNormalized: vi.fn() },
      invitationProof: new HmacWorkerInvitationProofAdapter("synthetic-workforce-email-secret-at-least-32-bytes"),
      readInvitation: vi.fn(async () => ({ ...invitation, status: "SUPERSEDED" as const })),
      invitationAcceptPath: "/api/v1/worker-invitations/inspect",
    });
    await expect(adapter.deliver(leased())).rejects.toThrow("WORKFORCE_INVITATION_DELIVERY_INVALID");
    expect(send).not.toHaveBeenCalled();
  });
});
