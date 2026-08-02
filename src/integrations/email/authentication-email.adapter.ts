import type { EmailPort } from "#integrations/email/email.types";
import type {
  AuthenticationDelivery,
  EmailAuthenticationDeliveryPort,
} from "../../modules/authentication/domain/authentication.ports.js";
import {
  formatDeliveryExpiry,
  maskEmailDestination,
} from "../../modules/authentication/domain/auth.policy.js";
import { renderCleanoraAuthenticationEmail } from "./cleanora-authentication-email.template.js";

/** Translate authentication delivery intents into provider-neutral email messages. */
export class AuthenticationEmailAdapter
  implements EmailAuthenticationDeliveryPort
{
  constructor(private readonly email: EmailPort) {}

  async send(message: AuthenticationDelivery): Promise<void> {
    const category = message.accountCategory ?? "ACCOUNT";
    const expiry =
      message.expiresAt === undefined
        ? "the configured expiry time"
        : formatDeliveryExpiry(message.expiresAt);

    const maskedDestination = maskEmailDestination(message.destination);

    if (message.purpose === "PASSWORD_RESET") {
      const subject = "Reset your Cleanora password";
      const { text, html } = renderCleanoraAuthenticationEmail({
        preheader:
          "Use this four-digit, single-use code to reset your Cleanora password.",
        eyebrow: "Account security",
        heading: "Reset your password",
        introduction:
          "We received a request to reset the password for your Cleanora account.",
        credentialLabel: "Password reset code",
        credentialValue: message.value,
        accountCategory: category,
        purpose: "Password reset",
        destinationLabel: "Delivered to",
        destination: maskedDestination,
        expiresAt: expiry,
        instruction:
          "Return to Cleanora and enter this four-digit code before it expires.",
        securityNotice:
          "This code is single-use, attempt-limited, and expires at the time shown above.",
      });
      await this.email.send({
        to: [message.destination],
        subject,
        text,
        html,
        idempotencyKey: message.idempotencyKey,
      });
      return;
    }

    const purpose =
      message.purpose === "OPTIONAL_INDIVIDUAL_EMAIL_VERIFICATION"
        ? "optional email verification"
        : "account verification";
    const subject = "Your Cleanora verification code";
    const { text, html } = renderCleanoraAuthenticationEmail({
      preheader: "Your Cleanora verification code is ready.",
      eyebrow: "Secure verification",
      heading:
        message.purpose === "OPTIONAL_INDIVIDUAL_EMAIL_VERIFICATION"
          ? "Verify your email address"
          : "Verify your Cleanora account",
      introduction:
        "Enter the code below to complete your secure verification. The code can be used only once.",
      credentialLabel: "Verification code",
      credentialValue: message.value,
      accountCategory: category,
      purpose,
      destinationLabel: "Destination",
      destination: maskedDestination,
      expiresAt: expiry,
      referenceId: message.idempotencyKey,
      instruction:
        "Return to Cleanora and enter this six-digit code before it expires.",
      securityNotice:
        "This verification code is single-use. Keep it private, even from Cleanora support.",
    });

    await this.email.send({
      to: [message.destination],
      subject,
      text,
      html,
      idempotencyKey: message.idempotencyKey,
    });
  }

}
