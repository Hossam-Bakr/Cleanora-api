import { getPrismaClient } from "../src/database/prisma.js";
import { PrismaProviderVerificationRepository } from "../src/modules/providers/infrastructure/prisma-provider-verification.repository.js";
import { ProviderDocumentPolicyService } from "../src/modules/providers/provider-document-policy.service.js";
import { R1_DOCUMENT_FIELD_RULES } from "../src/modules/providers/domain/provider-document-policy.policy.js";

/**
 * Human-invoked EG baseline bootstrap. It never runs from seed/migration and
 * requires an explicit active Staff actor, reason, and effective timestamp.
 */
async function run(): Promise<void> {
  const actorUserId = process.env["R1_P06_POLICY_STAFF_USER_ID"];
  const reason = process.env["R1_P06_POLICY_REASON"];
  const effectiveAtRaw = process.env["R1_P06_POLICY_EFFECTIVE_AT"];
  if (actorUserId === undefined || reason === undefined || effectiveAtRaw === undefined) {
    throw new Error("R1-P06 policy bootstrap requires explicit actor, reason, and effective time");
  }
  const db = getPrismaClient();
  const activeStaff = await db.userRole.findFirst({
    where: { userId: actorUserId, status: "ENABLED", role: { code: "staff_admin" } },
  });
  if (activeStaff === null) throw new Error("R1-P06 policy bootstrap actor is not an active Staff Admin");
  const service = new ProviderDocumentPolicyService(
    new PrismaProviderVerificationRepository(db),
    async () => true,
  );
  const draft = await service.createDraft({
    actorUserId,
    countryCode: "EG",
    providerKind: "REGISTERED_COMPANY",
    effectiveAt: new Date(effectiveAtRaw),
    commandId: `r1-p06-eg-policy-${effectiveAtRaw}`,
    items: [
      { documentTypeCode: "COMMERCIAL_REGISTRATION", isRequired: true, isActive: true, position: 0, fieldRules: R1_DOCUMENT_FIELD_RULES },
      { documentTypeCode: "TAX_REGISTRATION", isRequired: true, isActive: true, position: 1, fieldRules: R1_DOCUMENT_FIELD_RULES },
    ],
  });
  await service.publish({
    actorUserId,
    policyVersionId: draft.id,
    expectedVersion: draft.version,
    reason,
    commandId: `r1-p06-eg-policy-publish-${effectiveAtRaw}`,
  });
  console.info("R1-P06 EG policy bootstrap completed", { policyVersionId: draft.id });
}

if (require.main === module) {
  void run().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "R1-P06 policy bootstrap failed");
    process.exitCode = 1;
  });
}
