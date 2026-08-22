import type {
  AuthenticationProofPurpose,
  RecentAuthenticationProofVerifier,
} from "../authentication.public.js";

export interface AuthenticationProofConsumptionPort {
  consume(input: {
    readonly actorUserId: string;
    readonly sessionId: string;
    readonly opaqueProof: string;
    readonly purpose: AuthenticationProofPurpose;
    readonly providerId: string;
    readonly destinationVersionId: string;
    readonly requestId: string;
  }): Promise<{ readonly proofId: string; readonly authenticatedAt: Date } | null>;
}

export class ProviderSensitiveActionProofVerifier implements RecentAuthenticationProofVerifier {
  public constructor(
    private readonly consumption: AuthenticationProofConsumptionPort,
    private readonly now: () => Date = () => new Date(),
  ) {}
  public async verify(input: Parameters<RecentAuthenticationProofVerifier["verify"]>[0]) {
    const proof = await this.consumption.consume({
      actorUserId: input.principalUserId,
      sessionId: input.sessionId,
      opaqueProof: input.opaqueProof,
      purpose: input.purpose,
      providerId: input.providerId,
      destinationVersionId: input.destinationVersionId,
      requestId: input.requestId,
    });
    const now = this.now();
    if (proof === null || now.getTime() - proof.authenticatedAt.getTime() > input.maximumAgeSeconds * 1000 || proof.authenticatedAt > now) {
      throw new Error(input.purpose === "STAFF_PAYOUT_REVEAL" ? "PAYOUT_STEP_UP_REQUIRED" : "PAYOUT_REAUTHENTICATION_REQUIRED");
    }
    return {
      actorUserId: input.principalUserId,
      sessionId: input.sessionId,
      authenticatedAt: proof.authenticatedAt,
      expiresAt: new Date(proof.authenticatedAt.getTime() + input.maximumAgeSeconds * 1000),
      proofId: proof.proofId,
    };
  }
}
