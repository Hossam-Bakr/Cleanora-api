import { PrismaProviderVerificationRepository } from "../../../src/modules/providers/infrastructure/prisma-provider-verification.repository.js";
import { ProviderDocumentPolicyService } from "../../../src/modules/providers/provider-document-policy.service.js";
import { R1_DOCUMENT_FIELD_RULES } from "../../../src/modules/providers/domain/provider-document-policy.policy.js";

describe("R1-P06 US10 Staff policy service", () => {
  const item = { documentTypeCode: "COMMERCIAL_REGISTRATION", isRequired: true, isActive: true, position: 0, fieldRules: R1_DOCUMENT_FIELD_RULES };
  const policy = { id: "policy-1", status: "DRAFT" as const, effectiveAt: new Date("2026-08-20T00:00:00.000Z"), version: 1 };

  it("authorizes, reads the exact policy, and publishes with an immutable reason", async () => {
    const calls: string[] = [];
    const repository = {
      async findPolicyPublishReplay() { return null; },
      async readPolicy(id: string) { calls.push(`read:${id}`); return policy; },
      async publishPolicy(input: { readonly policyVersionId: string }) { calls.push(`publish:${input.policyVersionId}`); return { ...policy, status: "PUBLISHED" }; },
    } as unknown as PrismaProviderVerificationRepository;
    const service = new ProviderDocumentPolicyService(repository, async () => true);
    await expect(service.publish({ actorUserId: "staff-1", policyVersionId: "policy-1", expectedVersion: 1, reason: "Reviewed and approved Egyptian policy", commandId: "command-1" })).resolves.toMatchObject({ status: "PUBLISHED" });
    expect(calls).toEqual(["read:policy-1", "publish:policy-1"]);
  });

  it("returns a matching publish replay before re-validating the now-published row", async () => {
    const published = { ...policy, status: "PUBLISHED" as const };
    const repository = {
      findPolicyPublishReplay: vi.fn().mockResolvedValue(published),
      readPolicy: vi.fn(),
      publishPolicy: vi.fn(),
    } as unknown as PrismaProviderVerificationRepository;
    const service = new ProviderDocumentPolicyService(repository, async () => true);
    await expect(service.publish({ actorUserId: "staff-1", policyVersionId: "policy-1", expectedVersion: 1, reason: "Reviewed and approved Egyptian policy", commandId: "command-1" })).resolves.toBe(published);
    expect(repository.readPolicy).not.toHaveBeenCalled();
    expect(repository.publishPolicy).not.toHaveBeenCalled();
  });

  it("keeps create and replace operation identities distinct", async () => {
    const keys: string[] = [];
    const repository = {
      async createPolicyDraft(input: { readonly commandId: string }) { keys.push(`create:${input.commandId}`); return policy; },
      async replacePolicyDraft(input: { readonly commandId: string }) { keys.push(`replace:${input.commandId}`); return { ...policy, version: 2 }; },
    } as unknown as PrismaProviderVerificationRepository;
    const service = new ProviderDocumentPolicyService(repository, async () => true);
    await service.createDraft({ actorUserId: "staff-1", countryCode: "EG", providerKind: "REGISTERED_COMPANY", effectiveAt: policy.effectiveAt, commandId: "create-command", items: [item] });
    await service.replaceDraft({ actorUserId: "staff-1", policyVersionId: "policy-1", expectedVersion: 1, effectiveAt: policy.effectiveAt, commandId: "replace-command", items: [item] });
    expect(keys).toEqual(["create:create-command", "replace:replace-command"]);
  });

  it("accepts only an exact policy-draft replay", async () => {
    const stored = {
      ...policy,
      country: { code: "EG" },
      providerKind: "REGISTERED_COMPANY" as const,
      createdByUserId: "staff-1",
      items: [{ ...item, documentType: { code: item.documentTypeCode } }],
    };
    const repository = new PrismaProviderVerificationRepository({
      verificationDocumentPolicyVersion: { findUnique: vi.fn().mockResolvedValue(stored) },
    } as never);
    const command = {
      actorUserId: "staff-1",
      countryCode: "EG",
      providerKind: "REGISTERED_COMPANY" as const,
      effectiveAt: policy.effectiveAt,
      commandId: "create-command",
      items: [item],
    };
    await expect(repository.createPolicyDraft(command)).resolves.toBe(stored);
    await expect(repository.createPolicyDraft({ ...command, actorUserId: "other-staff" }))
      .rejects.toThrow("POLICY_VERSION_CONFLICT");
  });

  it("records bounded policy, verification-truth, and badge-truth activation history idempotently", async () => {
    const effectiveAt = new Date("2026-08-13T09:00:00.000Z");
    const currentPolicy = {
      id: "policy-2",
      policyVersion: 2,
      items: [
        { isRequired: true, documentType: { code: "COMMERCIAL_REGISTRATION" } },
        { isRequired: true, documentType: { code: "TAX_REGISTRATION_CARD" } },
      ],
    };
    const previousPolicy = {
      id: "policy-1",
      policyVersion: 1,
      items: [{ isRequired: true, documentType: { code: "COMMERCIAL_REGISTRATION" } }],
    };
    const history = new Map<string, Record<string, unknown>>();
    let activationState = { id: "document-policy-activation", cursor: null as string | null, version: 1 };
    const historyRepository = {
      async upsert(input: { readonly where: { readonly operationKey: string }; readonly create: Record<string, unknown> }) {
        if (!history.has(input.where.operationKey)) history.set(input.where.operationKey, input.create);
        return history.get(input.where.operationKey);
      },
    };
    const database = {
      provider: {
        async findMany() { return [{ id: "provider-1", profile: { countryId: "country-eg" } }]; },
      },
      verificationDocumentPolicyVersion: {
        async findFirst(input: { readonly where: { readonly policyVersion?: unknown } }) {
          return input.where.policyVersion === undefined ? currentPolicy : previousPolicy;
        },
      },
      providerDocumentChain: {
        async findMany() { return [{ documentType: { code: "COMMERCIAL_REGISTRATION" } }]; },
      },
      providerVerificationHistory: historyRepository,
      providerPolicyActivationState: {
        async upsert() { return activationState; },
        async updateMany(input: { readonly where: { readonly version: number }; readonly data: { readonly cursor: string | null } }) {
          if (input.where.version !== activationState.version) return { count: 0 };
          activationState = { ...activationState, cursor: input.data.cursor, version: activationState.version + 1 };
          return { count: 1 };
        },
      },
      async $transaction<T>(work: (transaction: { readonly providerVerificationHistory: typeof historyRepository }) => Promise<T>) {
        return work({ providerVerificationHistory: historyRepository });
      },
    };
    const repository = new PrismaProviderVerificationRepository(database as never);
    await expect(repository.activateEffectivePolicyBatch({ cursor: null, limit: 10, now: effectiveAt })).resolves.toEqual({ processed: 1, nextCursor: null });
    await repository.activateEffectivePolicyBatch({ cursor: null, limit: 10, now: effectiveAt });
    expect([...history.values()].map((entry) => entry["event"])).toEqual([
      "POLICY_BECAME_EFFECTIVE",
      "VERIFICATION_TRUTH_CHANGED",
      "BADGE_TRUTH_CHANGED",
    ]);
    expect(history.get("policy-truth:policy-2:provider-1")).toMatchObject({ reasonCode: "SATISFIED_TO_BLOCKED" });
    expect(history.get("policy-badge:policy-2:provider-1")).toMatchObject({ reasonCode: "EARNED_TO_NOT_EARNED" });
  });
});
