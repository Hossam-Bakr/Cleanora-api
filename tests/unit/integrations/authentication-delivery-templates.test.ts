import type {
  EmailMessage,
  EmailPort,
} from "../../../src/core/email/index.js";
import { AuthenticationEmailAdapter } from "../../../src/integrations/email/authentication-email.adapter.js";
import { renderCleanoraAuthenticationEmail } from "../../../src/integrations/email/cleanora-authentication-email.template.js";
import { DevelopmentSmsToEmailAdapter } from "../../../src/integrations/sms/development-sms-to-email.adapter.js";

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

describe("authentication delivery templates", () => {
  it("labels verification OTPs separately from password-reset credentials in email", async () => {
    const inbox = captureEmail();
    const adapter = new AuthenticationEmailAdapter(inbox.port);
    const expiresAt = new Date("2026-07-26T12:00:00.000Z");

    await adapter.send({
      idempotencyKey: "challenge-1",
      destination: "person@example.test",
      value: "123456",
      accountCategory: "COMPANY",
      purpose: "CATEGORY_VERIFICATION",
      expiresAt,
    });
    await adapter.send({
      idempotencyKey: "reset-1",
      destination: "person@example.test",
      value: "reset-1.opaque-secret",
      accountCategory: "COMPANY",
      purpose: "PASSWORD_RESET",
      expiresAt,
    });

    expect(inbox.messages).toHaveLength(2);
    const verification = inbox.messages[0]!;
    const reset = inbox.messages[1]!;
    expect(verification.subject).toBe("Your Cleanora verification code");
    expect(verification.text).toContain("Verification code: 123456");
    expect(verification.text).toContain("Challenge ID: challenge-1");
    expect(verification.text).not.toContain("Password reset");
    expect(verification.html).toContain("<!doctype html>");
    expect(verification.html).toContain('role="presentation"');
    expect(verification.html).toContain("#074C43");
    expect(verification.html).toContain("#F5C84C");
    expect(verification.html).toContain("#E8F5F0");
    expect(verification.html).toContain("Security notice");
    expect(verification.html).not.toContain("<script");
    expect(reset.subject).toBe("Reset your Cleanora password");
    expect(reset.text).toContain(
      "Password reset credential: reset-1.opaque-secret",
    );
    expect(reset.text).not.toContain("Verification code");
    expect(reset.text).not.toContain("Challenge ID");
    expect(reset.text).not.toContain("OTP");
  });

  it("uses distinct development SMS-to-email templates for OTP and password reset", async () => {
    const inbox = captureEmail();
    const adapter = new DevelopmentSmsToEmailAdapter(
      "development",
      inbox.port,
    );
    const expiresAt = new Date("2026-07-26T12:00:00.000Z");

    await adapter.send({
      idempotencyKey: "challenge-2",
      destination: "+201012345678",
      value: "654321",
      accountCategory: "INDIVIDUAL",
      purpose: "CATEGORY_VERIFICATION",
      expiresAt,
      temporaryEmailDeliveryAddress: "first@example.test",
    });
    await adapter.send({
      idempotencyKey: "reset-2",
      destination: "+201012345678",
      value: "reset-2.composite-secret",
      accountCategory: "INDIVIDUAL",
      purpose: "PASSWORD_RESET",
      expiresAt,
      temporaryEmailDeliveryAddress: "first@example.test",
    });

    expect(inbox.messages).toHaveLength(2);
    const verification = inbox.messages[0]!;
    const reset = inbox.messages[1]!;
    expect(verification.subject).toBe(
      "[Development] Temporary Cleanora phone verification code",
    );
    expect(verification.to).toEqual(["first@example.test"]);
    expect(verification.text).toContain("Verification code: 654321");
    expect(verification.text).toContain("Challenge ID: challenge-2");
    expect(verification.text).not.toContain("One-time code");
    expect(verification.text).not.toContain("OTP purpose");
    expect(reset.subject).toBe("[Development] Reset your Cleanora password");
    expect(reset.text).toContain(
      "Password reset credential: reset-2.composite-secret",
    );
    expect(reset.text).toContain(
      "This development fallback does not prove ownership",
    );
    expect(reset.text).not.toContain("Challenge ID");
    expect(reset.text).not.toContain("Verification code");
    expect(reset.text).not.toContain("OTP purpose");
    expect(reset.text).toContain("DEVELOPMENT ONLY");
    expect(reset.html).toContain("Development only");
    expect(reset.html).toContain("#074C43");
    expect(reset.html).toContain("#F5C84C");
  });

  it("delivers two signup OTPs to their own server-resolved email addresses", async () => {
    const inbox = captureEmail();
    const adapter = new DevelopmentSmsToEmailAdapter(
      "development",
      inbox.port,
    );
    const base = {
      accountCategory: "INDIVIDUAL" as const,
      purpose: "CATEGORY_VERIFICATION" as const,
      expiresAt: new Date("2026-07-26T12:00:00.000Z"),
    };

    await adapter.send({
      ...base,
      idempotencyKey: "signup-first",
      destination: "+201011111111",
      value: "111111",
      temporaryEmailDeliveryAddress: "first.user@example.test",
    });
    await adapter.send({
      ...base,
      idempotencyKey: "signup-second",
      destination: "+201022222222",
      value: "222222",
      temporaryEmailDeliveryAddress: "second.user@example.test",
    });

    expect(inbox.messages.map((message) => message.to)).toEqual([
      ["first.user@example.test"],
      ["second.user@example.test"],
    ]);
    expect(
      inbox.messages.flatMap((message) => message.to),
    ).not.toContain("cleanora305@gmail.com");
  });

  it("emails temporary Google phone OTPs to the verified Google address, not a fixed inbox", async () => {
    const inbox = captureEmail();
    const adapter = new DevelopmentSmsToEmailAdapter(
      "development",
      inbox.port,
    );
    const expiresAt = new Date("2026-07-26T12:00:00.000Z");

    await adapter.send({
      idempotencyKey: "google-phone-1",
      destination: "+201012345678",
      value: "987654",
      accountCategory: "INDIVIDUAL",
      purpose: "CATEGORY_VERIFICATION",
      expiresAt,
      temporaryEmailDeliveryAddress: "hossam.b2kr@gmail.com",
    });

    expect(inbox.messages).toHaveLength(1);
    const message = inbox.messages[0]!;
    expect(message.to).toEqual(["hossam.b2kr@gmail.com"]);
    expect(message.to).not.toContain("dev@example.test");
    expect(message.subject).toBe(
      "[Development] Temporary Cleanora phone verification code",
    );
    expect(message.text).toContain("Temporary phone verification");
    expect(message.text).toContain("Verification code: 987654");
    expect(message.text).toContain("+20");
    expect(message.text).toContain("does not prove ownership");
    expect(message.text).toContain("Ignore this email if you did not request");
    expect(message.text).toContain("DEVELOPMENT ONLY");
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
