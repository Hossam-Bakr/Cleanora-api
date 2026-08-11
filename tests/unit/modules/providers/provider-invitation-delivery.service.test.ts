import { ProviderInvitationDeliveryService } from "../../../../src/modules/providers/provider-invitation-delivery.service.js";
import type { ProviderAdminInvitationRecord } from "../../../../src/modules/providers/domain/providers.types.js";

const NOW = new Date("2026-08-10T12:00:00.000Z");

function invitation(
  overrides: Partial<ProviderAdminInvitationRecord> = {},
): ProviderAdminInvitationRecord {
  return {
    id: "inv-1",
    providerId: "prov-1",
    emailNormalized: "admin@example.com",
    tokenVerifier: "a".repeat(64),
    tokenVersion: 1,
    status: "PENDING",
    version: 1,
    invitedByUserId: "owner-1",
    acceptedByUserId: null,
    expiresAt: new Date("2026-08-13T12:00:00.000Z"),
    sentAt: null,
    deliveryFailedAt: null,
    lastSafeDeliveryErrorCode: null,
    acceptedAt: null,
    revokedAt: null,
    expiredAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe("ProviderInvitationDeliveryService (T156)", () => {
  it("marks DELIVERED and RESEND_REQUIRED, and skips non-pending locks", async () => {
    const updateInvitation = vi.fn(async (input: Record<string, unknown>) =>
      invitation({
        ...input,
        id: "inv-1",
        status: "PENDING",
      } as never),
    );
    const unitOfWork = {
      run: vi.fn(async (work: (ctx: unknown) => unknown) =>
        work({
          providers: {
            lockInvitationById: vi.fn(async () => invitation()),
            updateInvitation,
          },
        }),
      ),
    };

    const delivered = await new ProviderInvitationDeliveryService({
      unitOfWork: unitOfWork as never,
      invitationEmail: {
        deliverInvitationOnce: vi.fn(async () => "DELIVERED" as const),
      },
      now: () => NOW,
    }).deliverAfterCommit({
      invitation: invitation(),
      rawToken: "raw-token",
    });
    expect(delivered.deliveryState).toBe("DELIVERED");
    expect(updateInvitation).toHaveBeenCalledWith(
      expect.objectContaining({ sentAt: NOW }),
    );

    updateInvitation.mockClear();
    const failed = await new ProviderInvitationDeliveryService({
      unitOfWork: unitOfWork as never,
      invitationEmail: {
        deliverInvitationOnce: vi.fn(async () => "RESEND_REQUIRED" as const),
      },
      now: () => NOW,
    }).deliverAfterCommit({
      invitation: invitation(),
      rawToken: "raw-token",
    });
    expect(failed.deliveryState).toBe("RESEND_REQUIRED");
    expect(updateInvitation).toHaveBeenCalledWith(
      expect.objectContaining({
        deliveryFailedAt: NOW,
        lastSafeDeliveryErrorCode: "PROVIDER_INVITATION_DELIVERY_FAILED",
      }),
    );

    const original = invitation({ status: "ACCEPTED" });
    const skippedUpdate = vi.fn();
    const skipped = await new ProviderInvitationDeliveryService({
      unitOfWork: {
        run: vi.fn(async (work: (ctx: unknown) => unknown) =>
          work({
            providers: {
              lockInvitationById: vi.fn(async () =>
                invitation({ status: "ACCEPTED" }),
              ),
              updateInvitation: skippedUpdate,
            },
          }),
        ),
      } as never,
      invitationEmail: {
        deliverInvitationOnce: vi.fn(async () => "DELIVERED" as const),
      },
      now: () => NOW,
    }).deliverAfterCommit({
      invitation: original,
      rawToken: "raw-token",
    });
    expect(skipped.invitation).toBe(original);
    expect(skippedUpdate).not.toHaveBeenCalled();
  });
});
