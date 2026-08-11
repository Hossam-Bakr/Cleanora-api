import type { EmailPort } from "#integrations/email/email.types";

import type { ProviderEmailDeliveryPort } from "../domain/providers.ports.js";

/** Thin template adapter; durable retry/idempotency stays in the Provider outbox. */
export class ProviderEmailDeliveryAdapter implements ProviderEmailDeliveryPort {
  public constructor(private readonly email: EmailPort) {}

  public async sendTemplate(
    input: Parameters<ProviderEmailDeliveryPort["sendTemplate"]>[0],
  ): Promise<void> {
    const subject = input.variables["subject"] ?? "Cleanora Provider update";
    const providerId = input.variables["providerId"] ?? "";
    await this.email.send({
      to: [input.to],
      subject,
      text: `${subject}\nProvider: ${providerId}`,
      html: `<p>${subject}</p><p>Provider: ${providerId}</p>`,
      idempotencyKey: input.idempotencyKey,
    });
  }
}
