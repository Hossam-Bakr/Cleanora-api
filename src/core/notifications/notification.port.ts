export type NotificationChannel = "email" | "push" | "sms";

export interface NotificationMessage {
  readonly recipientId: string;
  readonly channel: NotificationChannel;
  readonly templateKey: string;
  readonly locale: "ar" | "en";
  readonly variables: Readonly<Record<string, string>>;
  readonly idempotencyKey: string;
}

export interface NotificationPort {
  send(message: NotificationMessage): Promise<void>;
}
