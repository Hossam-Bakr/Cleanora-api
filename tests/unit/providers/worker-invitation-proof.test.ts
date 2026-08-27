
import { HmacWorkerInvitationProofAdapter } from "../../../src/modules/providers/infrastructure/worker-invitation-proof.adapter.js";

const secret = "r1-p07-synthetic-auth-verifier-secret-32-bytes-minimum";
const now = new Date("2026-08-22T12:00:00.000Z");
const facts = {
  invitationId: "invitation-1",
  invitationVersion: 2,
  emailNormalized: "worker@example.invalid",
  locale: "AR" as const,
  expiresAt: new Date(now.getTime() + 72 * 60 * 60 * 1000),
};

describe("Worker invitation HMAC proof", () => {
  it("issues deterministic routing plus an opaque signature and verifies exact facts", () => {
    const adapter = new HmacWorkerInvitationProofAdapter(secret);
    const proof = adapter.issue(facts);
    expect(proof.split(".")).toHaveLength(2);
    expect(adapter.inspectRouting(proof)).toEqual({
      invitationId: facts.invitationId,
      invitationVersion: facts.invitationVersion,
      expiresAt: facts.expiresAt,
    });
    expect(adapter.verify(proof, facts, now)).toBe(true);
    expect(proof).not.toContain(facts.emailNormalized);
    const routing = JSON.parse(Buffer.from(proof.split(".")[0]!, "base64url").toString("utf8")) as Record<string, unknown>;
    expect(routing).not.toHaveProperty("emailNormalized");
    expect(routing).not.toHaveProperty("locale");
  });

  it("rejects tampering, wrong version/email/locale, expiry, and malformed routing", () => {
    const adapter = new HmacWorkerInvitationProofAdapter(secret);
    const proof = adapter.issue(facts);
    expect(adapter.verify(`${proof.slice(0, -1)}x`, facts, now)).toBe(false);
    expect(adapter.verify(proof, { ...facts, invitationVersion: 3 }, now)).toBe(false);
    expect(adapter.verify(proof, { ...facts, emailNormalized: "other@example.invalid" }, now)).toBe(false);
    expect(adapter.verify(proof, { ...facts, locale: "EN" }, now)).toBe(false);
    expect(adapter.verify(proof, facts, facts.expiresAt)).toBe(false);
    expect(adapter.inspectRouting("not-a-proof")).toBeNull();
    expect(adapter.inspectRouting("e30.invalid.extra")).toBeNull();
  });

  it("requires the existing verifier secret to meet its safety floor", () => {
    expect(() => new HmacWorkerInvitationProofAdapter("too-short")).toThrow("AUTH_VERIFIER_SECRET");
  });
});
