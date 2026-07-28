import type { EmailMessage, EmailPort } from "#core/email/email.port";

export type EmailDeliveryErrorName =
  | "EMAIL_AUTHENTICATION_FAILED"
  | "EMAIL_CONNECTION_FAILED"
  | "EMAIL_TIMEOUT"
  | "EMAIL_RECIPIENT_REJECTED"
  | "EMAIL_PROVIDER_UNAVAILABLE";

export interface SmtpEmailConfiguration {
  readonly host: string;
  readonly port: number;
  readonly secure: boolean;
  readonly requireTls: boolean;
  readonly user: string;
  readonly password: string;
  readonly fromName: string;
  readonly fromEmail: string;
  readonly connectionTimeoutMilliseconds: number;
  readonly socketTimeoutMilliseconds: number;
}

export interface NodemailerTransport {
  sendMail(message: {
    readonly from?: { readonly name: string; readonly address: string };
    readonly to: string;
    readonly subject: string;
    readonly html: string;
    readonly text: string;
    readonly headers: Readonly<Record<string, string>>;
  }): Promise<unknown>;
  verify?(): Promise<unknown>;
}

interface NodemailerModule {
  createTransport(options: {
    readonly host: string;
    readonly port: number;
    readonly secure: boolean;
    readonly requireTLS: boolean;
    readonly auth: { readonly user: string; readonly pass: string };
    readonly connectionTimeout: number;
    readonly socketTimeout: number;
  }): NodemailerTransport;
}

function loadNodemailer(): NodemailerModule {
  try {
    return require("nodemailer") as NodemailerModule;
  } catch {
    throw new EmailDeliveryError("EMAIL_PROVIDER_UNAVAILABLE");
  }
}

export class EmailDeliveryError extends Error {
  override readonly name: EmailDeliveryErrorName;

  constructor(name: EmailDeliveryErrorName) {
    super(name);
    this.name = name;
  }
}

function errorField(error: unknown, field: string): unknown {
  return typeof error === "object" && error !== null
    ? (error as Record<string, unknown>)[field]
    : undefined;
}

/** Convert provider failures into stable names without retaining provider payloads. */
export function mapEmailDeliveryError(error: unknown): EmailDeliveryError {
  const code = errorField(error, "code");
  const responseCode = errorField(error, "responseCode");

  if (code === "EAUTH") return new EmailDeliveryError("EMAIL_AUTHENTICATION_FAILED");
  if (code === "ETIMEDOUT") return new EmailDeliveryError("EMAIL_TIMEOUT");
  if (code === "EENVELOPE" || (typeof responseCode === "number" && responseCode >= 550 && responseCode < 560)) {
    return new EmailDeliveryError("EMAIL_RECIPIENT_REJECTED");
  }
  if (["ECONNECTION", "ECONNREFUSED", "ENOTFOUND", "ETLS", "ESOCKET"].includes(String(code))) {
    return new EmailDeliveryError("EMAIL_CONNECTION_FAILED");
  }
  return new EmailDeliveryError("EMAIL_PROVIDER_UNAVAILABLE");
}

export class NodemailerEmailAdapter implements EmailPort {
  constructor(
    private readonly transport: NodemailerTransport,
    private readonly from?: { readonly name: string; readonly address: string },
  ) {}

  /** Send one prepared message without logging content, recipients, or provider responses. */
  async send(message: EmailMessage): Promise<void> {
    try {
      const result = await this.transport.sendMail({
        ...(this.from === undefined ? {} : { from: this.from }),
        to: message.to.join(","),
        subject: message.subject,
        html: message.html,
        text: message.text,
        headers: { "x-cleanora-idempotency-key": message.idempotencyKey },
      });
      const rejected = errorField(result, "rejected");
      if (Array.isArray(rejected) && rejected.length > 0) {
        throw new EmailDeliveryError("EMAIL_RECIPIENT_REJECTED");
      }
    } catch (error) {
      if (error instanceof EmailDeliveryError) throw error;
      throw mapEmailDeliveryError(error);
    }
  }

  /** Verify SMTP connectivity without sending a message. */
  async verify(): Promise<void> {
    if (this.transport.verify === undefined) {
      throw new EmailDeliveryError("EMAIL_PROVIDER_UNAVAILABLE");
    }
    try {
      await this.transport.verify();
    } catch (error) {
      throw mapEmailDeliveryError(error);
    }
  }
}

/** Build the approved SMTP transport at the composition root. */
export function createNodemailerEmailAdapter(
  configuration: SmtpEmailConfiguration,
): NodemailerEmailAdapter {
  const password = normalizeSmtpPassword(
    configuration.host,
    configuration.password,
  );
  const transport = loadNodemailer().createTransport({
    host: configuration.host,
    port: configuration.port,
    secure: configuration.secure,
    requireTLS: configuration.requireTls,
    auth: {
      user: configuration.user,
      pass: password,
    },
    connectionTimeout: configuration.connectionTimeoutMilliseconds,
    socketTimeout: configuration.socketTimeoutMilliseconds,
  });

  return new NodemailerEmailAdapter(transport, {
    name: configuration.fromName,
    address: configuration.fromEmail,
  });
}

/**
 * Gmail displays app passwords in four-character groups. Accept that copied
 * presentation safely while leaving every non-Gmail SMTP password unchanged.
 */
export function normalizeSmtpPassword(host: string, password: string): string {
  if (host.trim().toLowerCase() !== "smtp.gmail.com") {
    return password;
  }

  const compact = password.replace(/\s/gu, "");
  return compact.length === 16 ? compact : password;
}
