import type { EmailMessage, EmailPort } from "#core/email/email.port";

export interface NodemailerTransport {
  sendMail(message: {
    readonly to: string;
    readonly subject: string;
    readonly html: string;
    readonly text: string;
    readonly headers: Readonly<Record<string, string>>;
  }): Promise<unknown>;
}

export class NodemailerEmailAdapter implements EmailPort {
  constructor(private readonly transport: NodemailerTransport) {}

  /**
   * @desc Send one prepared email through an injected Nodemailer transport.
   * @access Internal adapter only
   * @explanation This adapter sends approved content without owning templates,
   * credentials, or business eligibility rules.
   */
  async send(message: EmailMessage): Promise<void> {
    await this.transport.sendMail({
      to: message.to.join(","),
      subject: message.subject,
      html: message.html,
      text: message.text,
      headers: { "x-cleanora-idempotency-key": message.idempotencyKey }
    });
  }
}
