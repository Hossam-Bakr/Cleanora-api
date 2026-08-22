import type { AuthenticationPrincipal, RecentAuthenticationProofVerifier } from "../authentication/authentication.public.js";
import { assertPrimaryRemoval } from "./domain/provider-payout-primary.policy.js";
import { isMeaningfulSafeNote } from "./domain/provider-verification.catalog.js";
import type { PrismaProviderPayoutRepository } from "./infrastructure/prisma-provider-payout.repository.js";
import type { ProviderDenialAuditService } from "./provider-denial-audit.service.js";

export class ProviderPayoutPrimaryService {
  public constructor(
    private readonly repository: PrismaProviderPayoutRepository,
    private readonly proofVerifier: RecentAuthenticationProofVerifier,
    private readonly now: () => Date = () => new Date(),
    private readonly denialAudit?: ProviderDenialAuditService,
  ) {}
  private async authorizeOwner(principal: AuthenticationPrincipal, providerId: string) {
    const provider = await this.repository.readAccess(providerId, principal.userId);
    if (principal.status !== "ACTIVE" || principal.verificationOnly || provider?.applicationStatus !== "APPROVED" || provider.ownerUserId !== principal.userId || provider.members[0]?.status !== "ACTIVE" || provider.members[0]?.level !== "OWNER") {
      if (this.denialAudit !== undefined) {
        return this.denialAudit.denyR1P06({
          actorUserId: principal.userId,
          action: "PROVIDER_PAYOUT_PRIMARY_MUTATION",
          targetId: providerId,
          publicErrorCode: "PROVIDER_SCOPE_DENIED",
        });
      }
      throw new Error("PROVIDER_SCOPE_DENIED");
    }
  }
  public async setPrimary(input: {
    readonly principal: AuthenticationPrincipal; readonly providerId: string; readonly destinationVersionId: string;
    readonly expectedDestinationVersion: number; readonly expectedPrimaryVersion: number;
    readonly reauthenticationProof: string; readonly commandId: string; readonly requestId: string;
  }) {
    await this.authorizeOwner(input.principal, input.providerId);
    const replay = await this.repository.findPrimaryReplay({
      ...input,
      actorUserId: input.principal.userId,
    });
    if (replay !== null) {
      const state = await this.repository.readPrimaryState(input.providerId);
      if (state === null) throw new Error("PAYOUT_PRIMARY_CONFLICT");
      return { selection: replay, primaryStateVersion: state.payoutPrimaryStateVersion };
    }
    const proof = await this.proofVerifier.verify({ principalUserId: input.principal.userId, sessionId: input.principal.sessionId, opaqueProof: input.reauthenticationProof, purpose: "PROVIDER_PAYOUT_PRIMARY_CHANGE", providerId: input.providerId, destinationVersionId: input.destinationVersionId, requestId: input.requestId, maximumAgeSeconds: 600 });
    const selection = await this.repository.setPrimary({ ...input, actorUserId: input.principal.userId, proofId: proof.proofId, now: this.now() });
    const state = await this.repository.readPrimaryState(input.providerId);
    if (state === null) throw new Error("PAYOUT_PRIMARY_CONFLICT");
    return { selection, primaryStateVersion: state.payoutPrimaryStateVersion };
  }
  public async remove(input: {
    readonly principal: AuthenticationPrincipal; readonly providerId: string; readonly destinationVersionId: string;
    readonly expectedVersion: number; readonly expectedPrimaryVersion: number; readonly replacementPrimaryDestinationVersionId: string | null;
    readonly acknowledgeReadinessLoss: boolean; readonly reason: string; readonly reauthenticationProof: string;
    readonly commandId: string; readonly requestId: string;
  }) {
    await this.authorizeOwner(input.principal, input.providerId);
    if (!isMeaningfulSafeNote(input.reason)) throw new Error("VALIDATION_ERROR");
    const replay = await this.repository.findPayoutRemovalReplay({
      ...input,
      actorUserId: input.principal.userId,
    });
    if (replay !== null) {
      const state = await this.repository.readPrimaryState(input.providerId);
      if (state === null) throw new Error("PAYOUT_PRIMARY_CONFLICT");
      return { destination: replay, primaryStateVersion: state.payoutPrimaryStateVersion };
    }
    const [row, primaryState, all] = await Promise.all([
      this.repository.read(input.providerId, input.destinationVersionId),
      this.repository.readPrimaryState(input.providerId),
      this.repository.list({ providerId: input.providerId, limit: 100 }),
    ]);
    if (row === null || primaryState === null || row.version !== input.expectedVersion || primaryState.payoutPrimaryStateVersion !== input.expectedPrimaryVersion) throw new Error("PAYOUT_DESTINATION_VERSION_CONFLICT");
    const primary = primaryState.primaryPayoutDestination;
    const otherApproved = all.filter((item) => item.id !== row.id && item.status === "APPROVED" && item.chain.currentVersionId === item.id && item.chain.effectiveApprovedVersionId === item.id).map((item) => item.id);
    assertPrimaryRemoval({ isPrimary: primary?.destinationVersionId === row.id, otherApprovedDestinationIds: otherApproved, replacementPrimaryDestinationVersionId: input.replacementPrimaryDestinationVersionId, acknowledgeReadinessLoss: input.acknowledgeReadinessLoss });
    const proof = await this.proofVerifier.verify({ principalUserId: input.principal.userId, sessionId: input.principal.sessionId, opaqueProof: input.reauthenticationProof, purpose: row.status === "PENDING_VERIFICATION" ? "PROVIDER_PAYOUT_WITHDRAW" : "PROVIDER_PAYOUT_REMOVE", providerId: input.providerId, destinationVersionId: input.destinationVersionId, requestId: input.requestId, maximumAgeSeconds: 600 });
    const destination = await this.repository.remove({ ...input, actorUserId: input.principal.userId, proofId: proof.proofId, now: this.now() });
    const state = await this.repository.readPrimaryState(input.providerId);
    if (state === null) throw new Error("PAYOUT_PRIMARY_CONFLICT");
    return { destination, primaryStateVersion: state.payoutPrimaryStateVersion };
  }
}
