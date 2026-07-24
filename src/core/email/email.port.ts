export interface EmailMessage {
  readonly to: readonly string[];
  readonly subject: string;
  readonly html: string;
  readonly text: string;
  readonly idempotencyKey: string;
}

export interface EmailPort {
  send(message: EmailMessage): Promise<void>;
}
