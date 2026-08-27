import type {
  RecentAuthenticationProofVerifier,
  SensitiveActionProofPurpose,
  WorkerRecentAuthenticationProofVerifier,
} from "../authentication.public.js";

export interface AuthenticationProofConsumptionPort {
  consume(input: {
    readonly actorUserId: string;
    readonly sessionId: string;
    readonly opaqueProof: string;
    readonly purpose: SensitiveActionProofPurpose;
    readonly providerId: string;
    readonly destinationVersionId: string;
    readonly requestId: string;
  }): Promise<{ readonly proofId: string; readonly authenticatedAt: Date } | null>;
}

async function verifyConsumedProof(
  consumption: AuthenticationProofConsumptionPort,
  nowValue: Date,
  input: {
    readonly principalUserId: string;
    readonly sessionId: string;
    readonly opaqueProof: string;
    readonly purpose: SensitiveActionProofPurpose;
    readonly providerId: string;
    readonly targetId: string;
    readonly requestId: string;
    readonly maximumAgeSeconds: 600 | 300;
  },
) {
  const proof = await consumption.consume({
    actorUserId: input.principalUserId,
    sessionId: input.sessionId,
    opaqueProof: input.opaqueProof,
    purpose: input.purpose,
    providerId: input.providerId,
    destinationVersionId: input.targetId,
    requestId: input.requestId,
  });
  if (proof === null
    || nowValue.getTime() - proof.authenticatedAt.getTime() > input.maximumAgeSeconds * 1000
    || proof.authenticatedAt > nowValue) {
    throw new Error(input.purpose === "STAFF_PAYOUT_REVEAL"
      ? "PAYOUT_STEP_UP_REQUIRED"
      : input.purpose.startsWith("WORKER_") || input.purpose.startsWith("PROVIDER_ADMIN_")
        ? "WORKFORCE_REAUTHENTICATION_REQUIRED"
        : "PAYOUT_REAUTHENTICATION_REQUIRED");
  }
  return {
    authenticatedAt: proof.authenticatedAt,
    expiresAt: new Date(proof.authenticatedAt.getTime() + input.maximumAgeSeconds * 1000),
    proofId: proof.proofId,
  } as const;
}

export class ProviderSensitiveActionProofVerifier implements RecentAuthenticationProofVerifier {
  public constructor(
    private readonly consumption: AuthenticationProofConsumptionPort,
    private readonly now: () => Date = () => new Date(),
  ) {}
  public async verify(input: Parameters<RecentAuthenticationProofVerifier["verify"]>[0]) {
    const proof = await verifyConsumedProof(this.consumption, this.now(), {
      ...input,
      targetId: input.destinationVersionId,
    });
    return {
      actorUserId: input.principalUserId,
      sessionId: input.sessionId,
      ...proof,
    };
  }
}

/** Authentication-owned Worker proof verification; Providers sees no verifier secret. */
export class WorkerSensitiveActionProofVerifier implements WorkerRecentAuthenticationProofVerifier {
  public constructor(
    private readonly consumption: AuthenticationProofConsumptionPort,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public verify(input: Parameters<WorkerRecentAuthenticationProofVerifier["verify"]>[0]) {
    return verifyConsumedProof(this.consumption, this.now(), {
      ...input,
      targetId: input.workerId,
    });
  }
}
