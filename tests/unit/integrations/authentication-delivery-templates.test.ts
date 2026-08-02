import type {
  EmailMessage,
  EmailPort,
} from "../../../src/integrations/email/email.types.js";
import { AuthenticationEmailAdapter } from "../../../src/integrations/email/authentication-email.adapter.js";
import { renderCleanoraAuthenticationEmail } from "../../../src/integrations/email/cleanora-authentication-email.template.js";

function captureEmail(): { port: EmailPort; messages: EmailMessage[] } {
  const messages: EmailMessage[] = [];
  return {
    messages,
    port: {
      async send(message) {
        messages.push(message);
      },
    },
  };
}

describe("authentication email templates", () => {
  it("labels account-verification and password-reset credentials clearly", async () => {
    const inbox = captureEmail();
    const adapter = new AuthenticationEmailAdapter(inbox.port);
    const expiresAt = new Date("2026-07-26T12:00:00.000Z");

    await adapter.send({
      idempotencyKey: "challenge-1",
      destination: "person@example.test",
      value: "123456",
      accountCategory: "INDIVIDUAL",
      purpose: "CATEGORY_VERIFICATION",
      expiresAt,
    });
    await adapter.send({
      idempotencyKey: "reset-1",
      destination: "person@example.test",
      value: "5486",
      accountCategory: "INDIVIDUAL",
      purpose: "PASSWORD_RESET",
      expiresAt,
    });

    expect(inbox.messages).toHaveLength(2);
    const verification = inbox.messages[0]!;
    const reset = inbox.messages[1]!;
    expect(verification.to).toEqual(["person@example.test"]);
    expect(verification.subject).toBe("Your Cleanora verification code");
    expect(verification.text).toContain("Verification code: 123456");
    expect(verification.text).toContain("Challenge ID: challenge-1");
    expect(verification.html).toContain("#074C43");
    expect(reset.subject).toBe("Reset your Cleanora password");
    expect(reset.text).toContain("Password reset code: 5486");
    expect(reset.text).toContain("four-digit code");
    expect(reset.text).not.toContain("Challenge ID");
  });

  it("escapes dynamic authentication values before rendering HTML", () => {
    const rendered = renderCleanoraAuthenticationEmail({
      preheader: "Safe preview",
      eyebrow: "Secure verification",
      heading: "Verify your account",
      introduction: "Use the credential below.",
      credentialLabel: "Verification code",
      credentialValue: "<unsafe&value>",
      accountCategory: "INDIVIDUAL",
      purpose: "Account verification",
      destinationLabel: "Destination",
      destination: "user+<unsafe>@example.test",
      expiresAt: "soon",
      instruction: "Enter the code.",
      securityNotice: "Keep it private.",
    });

    expect(rendered.html).toContain("&lt;unsafe&amp;value&gt;");
    expect(rendered.html).toContain("user+&lt;unsafe&gt;@example.test");
    expect(rendered.html).not.toContain("<unsafe");
  });
});
