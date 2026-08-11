/**
 * Deterministic Provider email fake for automated suites.
 * Never connects to SMTP. Captures raw invitation tokens only in-process for
 * journey assertions — never written to outbox/logs/audit/API responses.
 */

export interface FakeProviderEmailMessage {
  readonly template: string;
  readonly recipientUserId: string;
  readonly idempotencyKey: string;
  readonly variables: Readonly<Record<string, string>>;
}

export interface FakeProviderInvitationDelivery {
  readonly invitationId: string;
  readonly recipientEmailNormalized: string;
  /** Present only in-process for assertion; never written to outbox/logs. */
  readonly rawTokenPresentInMemory: boolean;
  readonly delivered: boolean;
  /** Test-only capture so journeys can call inspect/accept. */
  readonly rawToken: string;
}

export class FakeProviderEmailAdapter {
  readonly messages: FakeProviderEmailMessage[] = [];
  readonly invitationDeliveries: FakeProviderInvitationDelivery[] = [];
  failNextDelivery = false;

  async sendTemplate(input: FakeProviderEmailMessage): Promise<void> {
    if (this.failNextDelivery) {
      this.failNextDelivery = false;
      throw new Error("FAKE_PROVIDER_EMAIL_DELIVERY_FAILED");
    }
    this.messages.push(input);
  }

  async deliverInvitationOnce(input: {
    readonly invitationId: string;
    readonly recipientEmailNormalized: string;
    readonly rawToken: string;
  }): Promise<"DELIVERED" | "RESEND_REQUIRED"> {
    const delivered = !this.failNextDelivery;
    if (this.failNextDelivery) {
      this.failNextDelivery = false;
    }
    this.invitationDeliveries.push({
      invitationId: input.invitationId,
      recipientEmailNormalized: input.recipientEmailNormalized,
      rawTokenPresentInMemory: input.rawToken.length > 0,
      delivered,
      rawToken: input.rawToken,
    });
    return delivered ? "DELIVERED" : "RESEND_REQUIRED";
  }

  latestInvitationToken(): string | undefined {
    return this.invitationDeliveries.at(-1)?.rawToken;
  }

  reset(): void {
    this.messages.length = 0;
    this.invitationDeliveries.length = 0;
    this.failNextDelivery = false;
  }
}
