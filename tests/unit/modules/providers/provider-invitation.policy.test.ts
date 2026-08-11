import {
  generateInvitationRawToken,
  hashInvitationToken,
  invitationDeliveryStateFromRecord,
  invitationExpiresAt,
  invitationVerifiersEqual,
  isInvitationPendingUnexpired,
  isTerminalInvitationStatus,
  maskInvitationEmail,
  normalizeInvitationEmail,
  PROVIDER_INVITATION_TTL_HOURS,
  resolveInspectNextAction,
  shouldEnableProviderAdminRole,
  shouldMaterializeExpired,
  assertInvitationTokenMatches,
} from "../../../../src/modules/providers/domain/provider-invitation.policy.js";
import type { ProviderAdminInvitationRecord } from "../../../../src/modules/providers/domain/providers.types.js";

const SECRET = "test-invitation-secret";

function invitation(
  overrides: Partial<ProviderAdminInvitationRecord> = {},
): ProviderAdminInvitationRecord {
  const now = new Date("2026-08-10T12:00:00.000Z");
  return {
    id: "inv-1",
    providerId: "prov-1",
    emailNormalized: "admin@example.com",
    tokenVerifier: hashInvitationToken(SECRET, "a".repeat(43)),
    tokenVersion: 1,
    status: "PENDING",
    version: 1,
    invitedByUserId: "owner-1",
    acceptedByUserId: null,
    expiresAt: invitationExpiresAt(now),
    sentAt: null,
    deliveryFailedAt: null,
    lastSafeDeliveryErrorCode: null,
    acceptedAt: null,
    revokedAt: null,
    expiredAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("provider invitation policy (T107)", () => {
  it("uses keyed verifiers and never stores the raw token shape in digests", () => {
    const raw = generateInvitationRawToken(32);
    expect(raw.length).toBeGreaterThanOrEqual(32);
    const verifier = hashInvitationToken(SECRET, raw);
    expect(verifier).toHaveLength(64);
    expect(verifier).not.toContain(raw);
    expect(
      invitationVerifiersEqual(verifier, hashInvitationToken(SECRET, raw)),
    ).toBe(true);
    expect(
      invitationVerifiersEqual(verifier, hashInvitationToken(SECRET, "other")),
    ).toBe(false);
  });

  it("expires invitations after exactly 72 hours", () => {
    const now = new Date("2026-08-10T00:00:00.000Z");
    const expires = invitationExpiresAt(now);
    expect(PROVIDER_INVITATION_TTL_HOURS).toBe(72);
    expect(expires.getTime() - now.getTime()).toBe(72 * 60 * 60 * 1000);
  });

  it("marks pending invitations expired lazily after expiry", () => {
    const now = new Date("2026-08-13T12:00:00.000Z");
    const pending = invitation({
      expiresAt: new Date("2026-08-12T12:00:00.000Z"),
    });
    expect(isInvitationPendingUnexpired(pending, now)).toBe(false);
    expect(shouldMaterializeExpired(pending, now)).toBe(true);
  });

  it("resolves inspect next action for existing vs unknown emails", () => {
    const pending = invitation();
    const now = new Date("2026-08-10T12:00:00.000Z");
    expect(
      resolveInspectNextAction({
        invitation: pending,
        now,
        existingUser: null,
      }),
    ).toBe("START_ONBOARDING");
    expect(
      resolveInspectNextAction({
        invitation: pending,
        now,
        existingUser: { emailVerified: true },
      }),
    ).toBe("ACCEPT_EXISTING");
    expect(
      resolveInspectNextAction({
        invitation: pending,
        now,
        existingUser: { emailVerified: false },
      }),
    ).toBe("NONE");
  });

  it("masks invitation emails for safe responses", () => {
    expect(maskInvitationEmail("admin@example.com")).toBe("ad***@example.com");
    expect(maskInvitationEmail("bad-email")).toBe("***");
  });

  it("covers token mismatch, delivery-state, and terminal status helpers", () => {
    const pending = invitation();
    expect(() =>
      assertInvitationTokenMatches(pending, hashInvitationToken(SECRET, "other")),
    ).toThrow();
    expect(() =>
      assertInvitationTokenMatches(pending, pending.tokenVerifier),
    ).not.toThrow();

    expect(
      invitationDeliveryStateFromRecord({
        sentAt: new Date(),
        deliveryFailedAt: null,
      }),
    ).toBe("DELIVERED");
    expect(
      invitationDeliveryStateFromRecord({
        sentAt: null,
        deliveryFailedAt: new Date(),
      }),
    ).toBe("RESEND_REQUIRED");
    expect(
      invitationDeliveryStateFromRecord({
        sentAt: null,
        deliveryFailedAt: null,
      }),
    ).toBeNull();

    expect(isTerminalInvitationStatus("ACCEPTED")).toBe(true);
    expect(isTerminalInvitationStatus("REVOKED")).toBe(true);
    expect(isTerminalInvitationStatus("EXPIRED")).toBe(true);
    expect(isTerminalInvitationStatus("PENDING")).toBe(false);

    expect(
      resolveInspectNextAction({
        invitation: invitation({
          expiresAt: new Date("2026-08-01T00:00:00.000Z"),
        }),
        now: new Date("2026-08-10T12:00:00.000Z"),
        existingUser: { emailVerified: true },
      }),
    ).toBe("NONE");
  });

  it("covers verifier mismatch edges, email normalization, and role enablement", () => {
    expect(invitationVerifiersEqual("aa", "aabb")).toBe(false);
    expect(normalizeInvitationEmail("  Admin@Example.COM ")).toBe(
      "admin@example.com",
    );
    expect(() => normalizeInvitationEmail("")).toThrow();
    expect(() => normalizeInvitationEmail("not-an-email")).toThrow();
    expect(
      isInvitationPendingUnexpired(invitation({ status: "ACCEPTED" }), new Date()),
    ).toBe(false);
    expect(shouldEnableProviderAdminRole(0)).toBe(false);
    expect(shouldEnableProviderAdminRole(1)).toBe(true);
  });
});
