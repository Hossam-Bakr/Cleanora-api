import type { EmailPort } from "#core/email/index";
import type {
  AuthenticationDelivery,
  SmsAuthenticationDeliveryPort,
} from "#modules/authentication";
import {
  formatDeliveryExpiry,
  maskPhoneDestination,
} from "#modules/authentication";
import { renderCleanoraAuthenticationEmail } from "../email/cleanora-authentication-email.template.js";

/**
 * Local-only bridge used while the real SMS provider is unavailable. It keeps
 * SMS as the authoritative channel and redirects only the delivery surface.
 */
export class DevelopmentSmsToEmailAdapter
  implements SmsAuthenticationDeliveryPort
{
  constructor(
    nodeEnvironment: "development" | "test" | "production",
    private readonly email: EmailPort,
  ) {
    if (nodeEnvironment !== "development") {
      throw new Error("DEVELOPMENT_SMS_EMAIL_FALLBACK_FORBIDDEN");
    }
  }

  async send(message: AuthenticationDelivery): Promise<void> {
    if (
      message.accountCategory === undefined ||
      message.purpose === undefined ||
      message.expiresAt === undefined ||
      message.temporaryEmailDeliveryAddress === undefined
    ) {
      throw new Error("DEVELOPMENT_SMS_EMAIL_DELIVERY_INVALID");
    }

    const maskedPhone = maskPhoneDestination(message.destination);
    const expiry = formatDeliveryExpiry(message.expiresAt);
    const rendered =
      message.purpose === "PASSWORD_RESET"
        ? renderCleanoraAuthenticationEmail({
            preheader:
              "Development delivery of your Cleanora SMS password-reset credential.",
            eyebrow: "Development SMS fallback",
            heading: "Reset your password",
            introduction:
              "The SMS provider is not connected in development, so Cleanora delivered this phone recovery credential to the email associated with this account.",
            credentialLabel: "Password reset credential",
            credentialValue: message.value,
            accountCategory: message.accountCategory,
            purpose: "Password reset through SMS",
            destinationLabel: "Intended phone",
            destination: maskedPhone,
            expiresAt: expiry,
            instruction:
              "Copy the complete credential into the password-reset form. It is not a six-digit verification code.",
            securityNotice:
              "This development fallback does not prove ownership of the intended phone. The credential is single-use.",
            developmentOnly: true,
          })
        : renderCleanoraAuthenticationEmail({
            preheader:
              "Development delivery of your Cleanora phone verification code.",
            eyebrow: "Development SMS fallback",
            heading: "Temporary phone verification code",
            introduction:
              "SMS delivery is not enabled yet, so Cleanora delivered this temporary phone-verification code to the server-verified email associated with this account. Receiving this email does not prove ownership of the phone number.",
            credentialLabel: "Verification code",
            credentialValue: message.value,
            accountCategory: message.accountCategory,
            purpose: message.purpose,
            destinationLabel: "Intended phone",
            destination: maskedPhone,
            expiresAt: expiry,
            referenceId: message.idempotencyKey,
            instruction:
              "Return to Cleanora and enter this six-digit code before it expires. Ignore this email if you did not request phone verification.",
            securityNotice:
              "This development fallback does not prove ownership of the intended phone. The code is single-use.",
            developmentOnly: true,
          });

    const subject =
      message.purpose === "PASSWORD_RESET"
        ? "[Development] Reset your Cleanora password"
        : "[Development] Temporary Cleanora phone verification code";

    await this.email.send({
      to: [message.temporaryEmailDeliveryAddress],
      subject,
      text: rendered.text,
      html: rendered.html,
      idempotencyKey: `dev-sms-email:${message.idempotencyKey}`,
    });
  }
}
