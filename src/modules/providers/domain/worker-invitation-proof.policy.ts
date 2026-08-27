import type { WorkforceLocale } from "./provider-workforce.types.js";

export const WORKER_INVITATION_PROOF_DOMAIN = "cleanora:worker-invitation:v1" as const;
export const WORKER_INVITATION_TTL_MILLISECONDS = 72 * 60 * 60 * 1000;

export interface WorkerInvitationProofFacts {
  readonly invitationId: string;
  readonly invitationVersion: number;
  readonly emailNormalized: string;
  readonly locale: WorkforceLocale;
  readonly expiresAt: Date;
}

export interface WorkerInvitationProofPort {
  issue(facts: WorkerInvitationProofFacts): string;
  inspectRouting(proof: string): {
    readonly invitationId: string;
    readonly invitationVersion: number;
    readonly expiresAt: Date;
  } | null;
  verify(proof: string, facts: WorkerInvitationProofFacts, now: Date): boolean;
}

export function canonicalizeWorkerInvitationProofFacts(facts: WorkerInvitationProofFacts): string {
  return [
    WORKER_INVITATION_PROOF_DOMAIN,
    facts.invitationId,
    String(facts.invitationVersion),
    facts.emailNormalized.trim().toLocaleLowerCase("en-US"),
    facts.locale,
    facts.expiresAt.toISOString(),
  ].join("\n");
}
