import type {
  EmailMessage,
  EmailPort,
} from "../../../src/core/email/index.js";
import { AuthenticationEmailAdapter } from "../../../src/integrations/email/authentication-email.adapter.js";
import { renderCleanoraAuthenticationEmail } from "../../../src/integrations/email/cleanora-authentication-email.template.js";
import { SmsToEmailFallbackAdapter } from "../../../src/integrations/sms/sms-to-email-fallback.adapter.js";

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
      value: "5486",
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
    expect(reset.text).toContain("Password reset code: 5486");
    expect(reset.text).toContain("four-digit code");
    expect(reset.text).not.toContain("Verification code");
    expect(reset.text).not.toContain("Challenge ID");
    expect(reset.text).not.toContain("OTP");
  });

  it("uses distinct development SMS-to-email templates for OTP and password reset", async () => {
    const inbox = captureEmail();
    const adapter = new SmsToEmailFallbackAdapter(
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
      value: "5486",
      accountCategory: "INDIVIDUAL",
      purpose: "PASSWORD_RESET",
      expiresAt,
      temporaryEmailDeliveryAddress: "first@example.test",
    });

    expect(inbox.messages).toHaveLength(2);
    const verification = inbox.messages[0]!;
    const reset = inbox.messages[1]!;
    expect(verification.subject).toBe(
      "[Cleanora preview] Temporary phone verification code",
    );
    expect(verification.to).toEqual(["first@example.test"]);
    expect(verification.text).toContain("Verification code: 654321");
    expect(verification.text).toContain("Challenge ID: challenge-2");
    expect(verification.text).not.toContain("One-time code");
    expect(verification.text).not.toContain("OTP purpose");
    expect(reset.subject).toBe("[Cleanora preview] Reset your password");
    expect(reset.text).toContain("Password reset code: 5486");
    expect(reset.text).toContain("four-digit code");
    expect(reset.text).toContain(
      "This fallback does not prove ownership",
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
    const adapter = new SmsToEmailFallbackAdapter(
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
    const adapter = new SmsToEmailFallbackAdapter(
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
      "[Cleanora preview] Temporary phone verification code",
    );
    expect(message.text).toContain("Temporary phone verification");
    expect(message.text).toContain("Verification code: 987654");
    expect(message.text).toContain("+20");
    expect(message.text).toContain("does not prove ownership");
    expect(message.text).toContain("Ignore this email if you did not request");
    expect(message.text).toContain("DEVELOPMENT ONLY");
  });

  it("labels the hosted fallback as a preview that does not verify phone ownership", async () => {
    const inbox = captureEmail();
    const adapter = new SmsToEmailFallbackAdapter(
      "hosted-preview",
      inbox.port,
    );

    await adapter.send({
      idempotencyKey: "hosted-signup",
      destination: "+201012345678",
      value: "123456",
      accountCategory: "INDIVIDUAL",
      purpose: "CATEGORY_VERIFICATION",
      expiresAt: new Date("2026-07-28T12:00:00.000Z"),
      temporaryEmailDeliveryAddress: "hosted.user@example.test",
    });

    expect(inbox.messages).toHaveLength(1);
    const message = inbox.messages[0]!;
    expect(message.to).toEqual(["hosted.user@example.test"]);
    expect(message.text).toContain(
      "HOSTED PREVIEW — PHONE OWNERSHIP NOT VERIFIED",
    );
    expect(message.text).toContain("does not prove ownership");
    expect(message.html).toContain(
      "Hosted preview — phone ownership not verified",
    );
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
