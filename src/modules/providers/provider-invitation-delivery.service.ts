import type {
  ProviderInvitationEmailDeliveryPort,
  ProvidersUnitOfWorkPort,
} from "./domain/providers.ports.js";
import type { ProviderAdminInvitationRecord } from "./domain/providers.types.js";
import type { InvitationDeliveryState } from "./domain/provider-invitation.policy.js";

export interface ProviderInvitationDeliveryServiceDependencies {
  readonly unitOfWork: ProvidersUnitOfWorkPort;
  readonly invitationEmail: ProviderInvitationEmailDeliveryPort;
  readonly now?: () => Date;
}

/**
 * Post-commit one-shot invitation delivery from process memory.
 * Never writes the raw token to outbox, audit, logs, or API responses.
 */
export class ProviderInvitationDeliveryService {
  public constructor(
    private readonly dependencies: ProviderInvitationDeliveryServiceDependencies,
  ) {}

  public async deliverAfterCommit(input: {
    readonly invitation: ProviderAdminInvitationRecord;
    readonly rawToken: string;
  }): Promise<{
    readonly invitation: ProviderAdminInvitationRecord;
    readonly deliveryState: InvitationDeliveryState;
  }> {
    const now = this.dependencies.now?.() ?? new Date();
    const deliveryState = await this.dependencies.invitationEmail.deliverInvitationOnce(
      {
        invitationId: input.invitation.id,
        recipientEmailNormalized: input.invitation.emailNormalized,
        rawToken: input.rawToken,
      },
    );

    const invitation = await this.dependencies.unitOfWork.run(async (context) => {
      const locked = await context.providers.lockInvitationById(
        input.invitation.id,
      );
      if (locked?.status !== "PENDING") {
        return input.invitation;
      }
      if (deliveryState === "DELIVERED") {
        return context.providers.updateInvitation({
          invitationId: locked.id,
          expectedVersion: locked.version,
          sentAt: now,
          deliveryFailedAt: null,
          lastSafeDeliveryErrorCode: null,
        });
      }
      return context.providers.updateInvitation({
        invitationId: locked.id,
        expectedVersion: locked.version,
        deliveryFailedAt: now,
        lastSafeDeliveryErrorCode: "PROVIDER_INVITATION_DELIVERY_FAILED",
      });
    });

    return { invitation, deliveryState };
  }
}
