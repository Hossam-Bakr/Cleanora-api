import type { ProvidersWorkforceTransactionContext } from "../../../src/modules/providers/domain/provider-workforce.types.js";
import { ProviderWorkforceAccessService } from "../../../src/modules/providers/provider-workforce-access.service.js";
import { ProviderWorkforceAuthorityService } from "../../../src/modules/providers/provider-workforce-authority.service.js";
import { ProviderWorkforceInvitationService } from "../../../src/modules/providers/provider-workforce-invitation.service.js";
import { ProviderWorkforceLifecycleService } from "../../../src/modules/providers/provider-workforce-lifecycle.service.js";

const result = { outcomeCode: "REPLAYED", targetId: "worker-1", version: 5, impacts: [] } as const;
const meta = {
  actorUserId: "owner-1", sessionId: "session-1", providerId: "provider-1", workerId: "worker-1",
  requestId: "request-1", idempotencyKey: "00000000-0000-4000-8000-000000000721", expectedVersion: 4,
};

function replayHarness() {
  const recentProof = { verify: vi.fn(async () => ({
    proofId: "proof-id",
    authenticatedAt: new Date("2026-08-23T00:00:00.000Z"),
    expiresAt: new Date("2026-08-23T00:10:00.000Z"),
  })) };
  const context = {
    commands: { begin: vi.fn(async () => ({ replay: true, result })), accept: vi.fn() },
  } as unknown as ProvidersWorkforceTransactionContext;
  const unitOfWork = { run: async (callback: (value: ProvidersWorkforceTransactionContext) => unknown) => callback(context) };
  return { recentProof, context, unitOfWork };
}

describe("R1-P07 high-risk idempotent retry ordering", () => {
  it("verifies session-bound proof before replaying accepted lifecycle/access/Admin/invitation commands", async () => {
    const lifecycle = replayHarness();
    await expect(new ProviderWorkforceLifecycleService({
      unitOfWork: lifecycle.unitOfWork as never, recentProof: lifecycle.recentProof,
    }).transition({
      ...meta, action: "REMOVE", reasonCode: "ENGAGEMENT_ENDED", note: "Contract ended",
      recentAuthenticationProof: "already-consumed", confirmTeamImpact: false, confirmReadinessImpact: false,
    })).resolves.toEqual(result);
    expect(lifecycle.recentProof.verify).toHaveBeenCalledTimes(1);

    const reset = replayHarness();
    await expect(new ProviderWorkforceAccessService({
      unitOfWork: reset.unitOfWork as never, recentProof: reset.recentProof,
      invitationProof: { issue: vi.fn(), verify: vi.fn(), inspectRouting: vi.fn() },
    }).reset({
      ...meta, expectedAccessVersion: 2, recentAuthenticationProof: "already-consumed",
      email: "worker@example.invalid", locale: "EN",
    })).resolves.toEqual(result);
    expect(reset.recentProof.verify).toHaveBeenCalledTimes(1);

    const revokeAccess = replayHarness();
    await expect(new ProviderWorkforceAccessService({
      unitOfWork: revokeAccess.unitOfWork as never, recentProof: revokeAccess.recentProof,
      invitationProof: { issue: vi.fn(), verify: vi.fn(), inspectRouting: vi.fn() },
    }).revoke({
      ...meta, expectedAccessVersion: 2, recentAuthenticationProof: "already-consumed",
      reasonCode: "SECURITY_CONCERN",
    })).resolves.toEqual(result);
    expect(revokeAccess.recentProof.verify).toHaveBeenCalledTimes(1);

    const authority = replayHarness();
    await expect(new ProviderWorkforceAuthorityService({
      unitOfWork: authority.unitOfWork as never, recentProof: authority.recentProof,
    }).change({
      ...meta, action: "GRANT", expectedMembershipVersion: null,
      recentAuthenticationProof: "already-consumed", reasonCode: "OPERATIONAL_RESPONSIBILITY",
    })).resolves.toEqual(result);
    expect(authority.recentProof.verify).toHaveBeenCalledTimes(1);

    const invitation = replayHarness();
    await expect(new ProviderWorkforceInvitationService({
      unitOfWork: invitation.unitOfWork as never, recentProof: invitation.recentProof,
      invitationProof: { issue: vi.fn(), verify: vi.fn(), inspectRouting: vi.fn() },
    }).issue({
      ...meta, expectedAccessVersion: null, opaqueRecentAuthenticationProof: "already-consumed",
      email: "worker@example.invalid", locale: "AR",
    })).resolves.toEqual(result);
    expect(invitation.recentProof.verify).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid proof before opening a transaction or reserving an idempotency key", async () => {
    const recentProof = { verify: vi.fn(async () => { throw new Error("invalid proof"); }) };
    const context = { commands: { begin: vi.fn(async () => ({ replay: false, result: null })) } } as unknown as ProvidersWorkforceTransactionContext;
    const unitOfWork = { run: async (callback: (value: ProvidersWorkforceTransactionContext) => unknown) => callback(context) };
    const service = new ProviderWorkforceLifecycleService({ unitOfWork: unitOfWork as never, recentProof });
    await expect(service.transition({
      ...meta, action: "REMOVE", reasonCode: "ENGAGEMENT_ENDED", note: "Contract ended",
      recentAuthenticationProof: "invalid", confirmTeamImpact: false, confirmReadinessImpact: false,
    })).rejects.toMatchObject({ code: "WORKFORCE_REAUTHENTICATION_REQUIRED" });
    expect(context.commands.begin).not.toHaveBeenCalled();
    expect(recentProof.verify).toHaveBeenCalledTimes(1);
  });
});
