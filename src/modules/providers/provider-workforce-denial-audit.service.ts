import type { DenialAuditWriter } from "../admin/audit.public.js";

import { WorkforcePolicyError } from "./domain/provider-workforce.policy.js";

export interface WorkforceHighRiskDenialContext {
  readonly actorUserId: string;
  readonly providerId: string;
  readonly targetType: "provider_worker" | "provider_worker_access" | "provider_admin_membership" | "worker_invitation";
  readonly targetId: string;
  readonly expectedVersion: number;
  readonly requestId: string;
  readonly action: string;
}

/**
 * Run one high-risk command and retain a minimal denial row if it is rejected.
 * Accepted evidence stays transaction-bound in the command service. This
 * non-transactional path deliberately receives no phone, email, proof, note,
 * credential, invitation token, or before/after personal data.
 */
export async function runWithWorkforceDenialAudit<T>(
  writer: DenialAuditWriter | undefined,
  input: WorkforceHighRiskDenialContext,
  command: () => Promise<T>,
): Promise<T> {
  try {
    return await command();
  } catch (error: unknown) {
    if (writer !== undefined) {
      await writer.append({
        actorType: "USER",
        actorId: input.actorUserId,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        reason: error instanceof WorkforcePolicyError ? error.code : "INTERNAL_FAILURE",
        outcome: "DENIED",
        context: {
          providerId: input.providerId,
          expectedVersion: input.expectedVersion,
        },
        requestId: input.requestId,
      });
    }
    throw error;
  }
}
