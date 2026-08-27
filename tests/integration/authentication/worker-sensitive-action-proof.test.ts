
import { sensitiveActionProofSchema } from "../../../src/modules/authentication/auth.schema.js";
import {
  WorkerSensitiveActionProofVerifier,
  type AuthenticationProofConsumptionPort,
} from "../../../src/modules/authentication/infrastructure/provider-sensitive-action-proof.verifier.js";

const now = new Date("2026-08-22T15:00:00.000Z");
const binding = {
  principalUserId: "owner-1",
  sessionId: "session-1",
  opaqueProof: "opaque-proof",
  purpose: "WORKER_ACCESS_REVOKE" as const,
  providerId: "provider-1",
  workerId: "worker-1",
  requestId: "00000000-0000-4000-8000-000000000601",
  maximumAgeSeconds: 600 as const,
};

function createConsumption(authenticatedAt = new Date(now.getTime() - 60_000)) {
  let consumed = false;
  const consume = vi.fn(async (input: Parameters<AuthenticationProofConsumptionPort["consume"]>[0]) => {
    if (consumed
      || input.actorUserId !== binding.principalUserId
      || input.sessionId !== binding.sessionId
      || input.opaqueProof !== binding.opaqueProof
      || input.purpose !== binding.purpose
      || input.providerId !== binding.providerId
      || input.destinationVersionId !== binding.workerId
      || input.requestId !== binding.requestId) return null;
    consumed = true;
    return { proofId: "proof-1", authenticatedAt };
  });
  return { consumption: { consume } satisfies AuthenticationProofConsumptionPort, consume };
}

describe("Worker recent-authentication proof", () => {
  it("accepts all six exact R1-P07 purposes at the authenticated proof endpoint", () => {
    for (const purpose of [
      "WORKER_ACCESS_ISSUE",
      "WORKER_ACCESS_RESET",
      "WORKER_ACCESS_REVOKE",
      "WORKER_REMOVE",
      "PROVIDER_ADMIN_GRANT",
      "PROVIDER_ADMIN_REVOKE",
    ] as const) {
      expect(sensitiveActionProofSchema.safeParse({
        body: {
          currentPassword: "valid-password",
          purpose,
          providerId: binding.providerId,
          destinationVersionId: binding.workerId,
          requestId: binding.requestId,
        },
      }).success).toBe(true);
    }
  });

  it("binds proof consumption to actor, session, purpose, Provider, Worker, and request", async () => {
    const { consumption, consume } = createConsumption();
    const verifier = new WorkerSensitiveActionProofVerifier(consumption, () => now);
    await expect(verifier.verify(binding)).resolves.toMatchObject({
      proofId: "proof-1",
      authenticatedAt: new Date(now.getTime() - 60_000),
      expiresAt: new Date(now.getTime() + 540_000),
    });
    expect(consume).toHaveBeenCalledWith({
      actorUserId: binding.principalUserId,
      sessionId: binding.sessionId,
      opaqueProof: binding.opaqueProof,
      purpose: binding.purpose,
      providerId: binding.providerId,
      destinationVersionId: binding.workerId,
      requestId: binding.requestId,
    });
  });

  it("rejects purpose, target, Provider, request, actor, or session mismatch", async () => {
    for (const changed of [
      { purpose: "WORKER_ACCESS_RESET" as const },
      { workerId: "worker-2" },
      { providerId: "provider-2" },
      { requestId: "00000000-0000-4000-8000-000000000602" },
      { principalUserId: "owner-2" },
      { sessionId: "session-2" },
    ]) {
      const { consumption } = createConsumption();
      const verifier = new WorkerSensitiveActionProofVerifier(consumption, () => now);
      await expect(verifier.verify({ ...binding, ...changed }))
        .rejects.toThrow("WORKFORCE_REAUTHENTICATION_REQUIRED");
    }
  });

  it("rejects replay, proofs older than ten minutes, and future timestamps", async () => {
    const oneUse = createConsumption();
    const verifier = new WorkerSensitiveActionProofVerifier(oneUse.consumption, () => now);
    await verifier.verify(binding);
    await expect(verifier.verify(binding)).rejects.toThrow("WORKFORCE_REAUTHENTICATION_REQUIRED");

    for (const authenticatedAt of [
      new Date(now.getTime() - 600_001),
      new Date(now.getTime() + 1),
    ]) {
      const { consumption } = createConsumption(authenticatedAt);
      await expect(new WorkerSensitiveActionProofVerifier(consumption, () => now).verify(binding))
        .rejects.toThrow("WORKFORCE_REAUTHENTICATION_REQUIRED");
    }
  });
});
