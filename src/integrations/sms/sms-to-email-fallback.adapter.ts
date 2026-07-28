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

export type SmsToEmailFallbackMode = "development" | "hosted-preview";

/**
 * Explicit temporary bridge used while a real SMS provider is unavailable.
 * It preserves the SMS intent but redirects delivery to a server-resolved
 * account email and clearly states that phone ownership was not proven.
 */
export class SmsToEmailFallbackAdapter
  implements SmsAuthenticationDeliveryPort
{
  constructor(
    private readonly mode: SmsToEmailFallbackMode,
    private readonly email: EmailPort,
  ) {}

  async send(message: AuthenticationDelivery): Promise<void> {
    if (
      message.accountCategory === undefined ||
      message.purpose === undefined ||
      message.expiresAt === undefined ||
      message.temporaryEmailDeliveryAddress === undefined
    ) {
      throw new Error("SMS_EMAIL_FALLBACK_DELIVERY_INVALID");
    }

    const maskedPhone = maskPhoneDestination(message.destination);
    const expiry = formatDeliveryExpiry(message.expiresAt);
    const deliveryNotice =
      this.mode === "development"
        ? "Development only"
        : "Hosted preview — phone ownership not verified";
    const fallbackContext =
      this.mode === "development"
        ? "The SMS provider is not connected in development"
        : "The hosted preview does not have a real SMS provider connected";
    const rendered =
      message.purpose === "PASSWORD_RESET"
        ? renderCleanoraAuthenticationEmail({
            preheader:
              "Temporary email delivery of your four-digit Cleanora password-reset code.",
            eyebrow: "SMS-to-email fallback",
            heading: "Reset your password",
            introduction:
              `${fallbackContext}, so Cleanora delivered this phone recovery code to the email associated with this account.`,
            credentialLabel: "Password reset code",
            credentialValue: message.value,
            accountCategory: message.accountCategory,
            purpose: "Password reset through SMS",
            destinationLabel: "Intended phone",
            destination: maskedPhone,
            expiresAt: expiry,
            instruction:
              "Return to Cleanora and enter this four-digit code before it expires.",
            securityNotice:
              "This fallback does not prove ownership of the intended phone. The code is single-use and attempt-limited.",
            deliveryNotice,
          })
        : renderCleanoraAuthenticationEmail({
            preheader:
              "Temporary email delivery of your Cleanora phone verification code.",
            eyebrow: "SMS-to-email fallback",
            heading: "Temporary phone verification code",
            introduction:
              `${fallbackContext}, so Cleanora delivered this temporary phone-verification code to the account email. Receiving this email does not prove ownership of the phone number.`,
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
              "This fallback does not prove ownership of the intended phone. The code is single-use.",
            deliveryNotice,
          });

    const subject =
      message.purpose === "PASSWORD_RESET"
        ? "[Cleanora preview] Reset your password"
        : "[Cleanora preview] Temporary phone verification code";

    await this.email.send({
      to: [message.temporaryEmailDeliveryAddress],
      subject,
      text: rendered.text,
      html: rendered.html,
      idempotencyKey: `dev-sms-email:${message.idempotencyKey}`,
    });
  }
}
