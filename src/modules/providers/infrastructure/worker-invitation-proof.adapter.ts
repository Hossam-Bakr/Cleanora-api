import { createHmac, timingSafeEqual } from "node:crypto";

import {
  canonicalizeWorkerInvitationProofFacts,
  type WorkerInvitationProofFacts,
  type WorkerInvitationProofPort,
} from "../domain/worker-invitation-proof.policy.js";

export class HmacWorkerInvitationProofAdapter implements WorkerInvitationProofPort {
  public constructor(private readonly verifierSecret: string) {
    if (verifierSecret.length < 32) throw new Error("AUTH_VERIFIER_SECRET is not configured safely");
  }

  public issue(facts: WorkerInvitationProofFacts): string {
    const routing = Buffer.from(JSON.stringify({
      invitationId: facts.invitationId,
      invitationVersion: facts.invitationVersion,
      expiresAt: facts.expiresAt.toISOString(),
    }), "utf8").toString("base64url");
    const signature = createHmac("sha256", this.verifierSecret)
      .update(canonicalizeWorkerInvitationProofFacts(facts))
      .digest("base64url");
    return `${routing}.${signature}`;
  }

  public inspectRouting(proof: string): {
    readonly invitationId: string;
    readonly invitationVersion: number;
    readonly expiresAt: Date;
  } | null {
    const [routing, signature, extra] = proof.split(".");
    if (routing === undefined || signature === undefined || extra !== undefined) return null;
    try {
      const decoded = JSON.parse(Buffer.from(routing, "base64url").toString("utf8")) as {
        readonly invitationId?: unknown;
        readonly invitationVersion?: unknown;
        readonly expiresAt?: unknown;
      };
      if (typeof decoded.invitationId !== "string" || decoded.invitationId.length === 0
        || !Number.isSafeInteger(decoded.invitationVersion) || (decoded.invitationVersion as number) <= 0
        || typeof decoded.expiresAt !== "string") return null;
      const expiresAt = new Date(decoded.expiresAt);
      if (Number.isNaN(expiresAt.getTime())) return null;
      return {
        invitationId: decoded.invitationId,
        invitationVersion: decoded.invitationVersion as number,
        expiresAt,
      };
    } catch {
      return null;
    }
  }

  public verify(proof: string, facts: WorkerInvitationProofFacts, now: Date): boolean {
    if (facts.expiresAt.getTime() <= now.getTime()) return false;
    const routing = this.inspectRouting(proof);
    if (routing === null
      || routing.invitationId !== facts.invitationId
      || routing.invitationVersion !== facts.invitationVersion
      || routing.expiresAt.getTime() !== facts.expiresAt.getTime()) return false;
    const expected = Buffer.from(this.issue(facts));
    const supplied = Buffer.from(proof);
    return expected.length === supplied.length && timingSafeEqual(expected, supplied);
  }
}
