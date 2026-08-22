import type { PayoutRevealAuditGate } from "../../../src/modules/admin/audit.public.js";
import type { PrismaProviderPayoutRepository } from "../../../src/modules/providers/infrastructure/prisma-provider-payout.repository.js";
import { ProviderPayoutRevealService } from "../../../src/modules/providers/provider-payout-reveal.service.js";
import { createPayoutDataCrypto } from "../../../src/modules/providers/infrastructure/payout-data-crypto.adapter.js";
import { r1P06TestKeyRing } from "../../helpers/r1-p06-test-doubles.js";
import { R1_P06_IDS, R1_P06_SENTINELS } from "../../helpers/r1-p06-fixtures.js";

describe("R1-P06 US8 exact pending-version reveal", () => {
  const rings = r1P06TestKeyRing();
  const crypto = createPayoutDataCrypto(rings);
  const base = {
    providerId: R1_P06_IDS.providerId,
    destinationChainId: R1_P06_IDS.chainId,
    destinationVersionId: R1_P06_IDS.destinationVersionId,
    destinationSequence: 1,
    destinationType: "MOBILE_WALLET" as const,
  };
  const identifier = crypto.encrypt(R1_P06_SENTINELS.wallet, { ...base, fieldName: "IDENTIFIER", encryptionKeyId: "enc-test-v1" });
  const holder = crypto.encrypt(R1_P06_SENTINELS.holderName, { ...base, fieldName: "HOLDER_NAME", encryptionKeyId: "enc-test-v1" });
  const revealRow = {
    id: R1_P06_IDS.destinationVersionId,
    providerId: R1_P06_IDS.providerId,
    chainId: R1_P06_IDS.chainId,
    sequence: 1,
    kind: "MOBILE_WALLET" as const,
    version: 3,
    holderRelationship: "PROVIDER_OWNER" as const,
    identifierCiphertext: identifier.ciphertext,
    identifierNonce: identifier.nonce,
    identifierTag: identifier.authenticationTag,
    identifierEncryptionKeyId: identifier.encryptionKeyId,
    holderNameCiphertext: holder.ciphertext,
    holderNameNonce: holder.nonce,
    holderNameTag: holder.authenticationTag,
    holderNameEncryptionKeyId: holder.encryptionKeyId,
    identityClaim: { fingerprints: [{ lookupKeyId: "lookup-test-v1" }] },
    operator: { code: "TEST_OPERATOR", labelEn: "Synthetic operator" },
    bank: null,
  };

  function setup(options: { authorize?: boolean; proofFails?: boolean; auditFails?: boolean } = {}) {
    const denied: string[] = [];
    const accepted: string[] = [];
    const gate: PayoutRevealAuditGate = {
      async commitAcceptedReveal(input) {
        if (options.auditFails) throw new Error("AUDIT_WRITE_FAILED");
        accepted.push(input.destinationVersionId);
        return { accepted: true, attemptId: "accepted-attempt-1", acceptedAt: new Date("2026-08-13T09:00:00.000Z") };
      },
      async appendDeniedReveal(input) { denied.push(input.safeCode); },
    };
    const repository = {
      async readHolderAuthority() {
        return {
          kind: "REGISTERED_COMPANY" as const,
          applicationStatus: "APPROVED" as const,
          applicationOwnerUserId: "applicant-1",
          ownerUserId: "owner-1",
          members: [{ userId: "owner-1" }],
        };
      },
      async commitRevealGate(input: {
        readonly proofId: string;
        readonly prepareSensitiveResult: (
          row: typeof revealRow,
          authority: { readonly legalEntityName: string | null; readonly ownerLegalName: string | null },
        ) => object;
        readonly createAuditGate: (transaction: never) => PayoutRevealAuditGate;
      }) {
        expect(input.proofId).toBe("proof-1");
        const sensitiveResult = input.prepareSensitiveResult(revealRow, {
          legalEntityName: "Synthetic Company",
          ownerLegalName: R1_P06_SENTINELS.holderName,
        });
        const audit = await input.createAuditGate(undefined as never).commitAcceptedReveal({
          actorUserId: R1_P06_IDS.staffUserId,
          providerId: R1_P06_IDS.providerId,
          destinationVersionId: R1_P06_IDS.destinationVersionId,
          expectedVersion: 3,
          purpose: "MANUAL_PAYOUT_DESTINATION_VERIFICATION",
          reasonCode: command.reason,
          requestId: R1_P06_IDS.requestId,
          encryptionKeyIds: ["enc-test-v1"],
          lookupKeyIds: ["lookup-test-v1"],
          now: new Date("2026-08-13T09:00:00.000Z"),
        });
        return { sensitiveResult, audit };
      },
    } as unknown as PrismaProviderPayoutRepository;
    const proofVerifier = {
      async verify() {
        if (options.proofFails) throw new Error("AUTHENTICATION_PROOF_INVALID");
        return { actorUserId: R1_P06_IDS.staffUserId, sessionId: R1_P06_IDS.sessionId, authenticatedAt: new Date(), expiresAt: new Date(), proofId: "proof-1" };
      },
    };
    const service = new ProviderPayoutRevealService(repository, proofVerifier, gate, () => gate, async () => options.authorize ?? true, rings, () => new Date("2026-08-13T09:00:00.000Z"));
    return { service, accepted, denied };
  }

  const command = {
    actorUserId: R1_P06_IDS.staffUserId,
    sessionId: R1_P06_IDS.sessionId,
    providerId: R1_P06_IDS.providerId,
    destinationVersionId: R1_P06_IDS.destinationVersionId,
    expectedVersion: 3,
    purpose: "MANUAL_PAYOUT_DESTINATION_VERIFICATION" as const,
    reason: "Manual beneficiary lookup before decision",
    stepUpProof: "synthetic-step-up-proof",
    commandId: R1_P06_IDS.commandId,
    requestId: R1_P06_IDS.requestId,
  };

  it("returns plaintext only after the accepted audit gate", async () => {
    const { service, accepted, denied } = setup();
    await expect(service.reveal(command)).resolves.toMatchObject({ destinationVersionId: R1_P06_IDS.destinationVersionId, revealAttemptId: "accepted-attempt-1", fullIdentifier: R1_P06_SENTINELS.wallet, holderLegalName: R1_P06_SENTINELS.holderName, authoritativeHolderLegalName: R1_P06_SENTINELS.holderName });
    expect(accepted).toEqual([R1_P06_IDS.destinationVersionId]);
    expect(denied).toEqual([]);
  });

  it("records safe denials for permission, proof, and audit failures", async () => {
    for (const options of [{ authorize: false }, { proofFails: true }, { auditFails: true }]) {
      const { service, denied } = setup(options);
      await expect(service.reveal(command)).rejects.toThrow();
      expect(denied).toHaveLength(1);
      expect(denied[0]).toMatch(/^[A-Z][A-Z0-9_]+$/u);
    }
  });

  it("rejects unsafe or empty verification reasons before decrypting", async () => {
    const { service, accepted, denied } = setup();
    await expect(service.reveal({ ...command, reason: "short" })).rejects.toThrow("VALIDATION_ERROR");
    expect(accepted).toHaveLength(0);
    expect(denied).toEqual(["VALIDATION_ERROR"]);
  });

  it("rejects a meaningful-looking audit reason that embeds a protected value", async () => {
    const { service, accepted, denied } = setup();
    await expect(service.reveal({
      ...command,
      reason: `Manual verification for ${R1_P06_SENTINELS.wallet}`,
    })).rejects.toThrow("VALIDATION_ERROR");
    expect(accepted).toHaveLength(0);
    expect(denied).toEqual(["VALIDATION_ERROR"]);
  });
});
