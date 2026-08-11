import type { EmailMessage } from "../../../../src/integrations/email/email.types.js";
import { ProviderInvitationEmailAdapter } from "../../../../src/modules/providers/infrastructure/provider-invitation-email.adapter.js";

describe("ProviderInvitationEmailAdapter", () => {
  it("keeps the raw invitation token in the message body and out of URL/metadata", async () => {
    const sent: EmailMessage[] = [];
    const adapter = new ProviderInvitationEmailAdapter(
      { send: async (message) => void sent.push(message) },
      "https://app.cleanora.example/provider-admin-invitations",
    );
    const rawToken = "secret-invitation-token";

    await expect(
      adapter.deliverInvitationOnce({
        invitationId: "invitation-1",
        recipientEmailNormalized: "admin@example.com",
        rawToken,
      }),
    ).resolves.toBe("DELIVERED");

    expect(sent).toHaveLength(1);
    const message = sent[0]!;
    expect(message.text).toContain(rawToken);
    expect(message.html).toContain(rawToken);
    expect(message.subject).not.toContain(rawToken);
    expect(message.idempotencyKey).not.toContain(rawToken);
    expect(message.text).not.toContain(`?invitation=${rawToken}`);
    expect(message.html).not.toMatch(new RegExp(`href="[^"]*${rawToken}`));
  });
});
