import type { EmailMessage, EmailPort } from "#integrations/email/email.types";

import type { ProviderInvitationEmailDeliveryPort } from "../domain/providers.ports.js";

/**
 * One-shot invitation email via EmailPort. The raw token appears only in the
 * message body for this send and must never be logged by callers.
 */
export class ProviderInvitationEmailAdapter
  implements ProviderInvitationEmailDeliveryPort
{
  public constructor(
    private readonly email: EmailPort,
    private readonly acceptPathBase: string,
  ) {}

  public async deliverInvitationOnce(input: {
    readonly invitationId: string;
    readonly recipientEmailNormalized: string;
    readonly rawToken: string;
  }): Promise<"DELIVERED" | "RESEND_REQUIRED"> {
    try {
      const message = buildInvitationMessage(input, this.acceptPathBase);
      await this.email.send(message);
      return "DELIVERED";
    } catch {
      return "RESEND_REQUIRED";
    }
  }
}

function buildInvitationMessage(
  input: {
    readonly invitationId: string;
    readonly recipientEmailNormalized: string;
    readonly rawToken: string;
  },
  acceptPathBase: string,
): EmailMessage {
  // The bearer token is deliberately body-only. Never place it in a URL,
  // header, subject, or idempotency key where infrastructure may log it.
  const link = acceptPathBase;
  return {
    to: [input.recipientEmailNormalized],
    subject: "Cleanora Provider Admin invitation",
    text: `You have been invited as a Provider Admin. Open ${link}, then submit this one-time token within 72 hours: ${input.rawToken}`,
    html: `<p>You have been invited as a Provider Admin.</p><p><a href="${link}">Open Cleanora</a>, then paste this one-time token into the invitation form:</p><p>${input.rawToken}</p>`,
    idempotencyKey: `provider-admin-invitation:${input.invitationId}:${Date.now()}`,
  };
}
