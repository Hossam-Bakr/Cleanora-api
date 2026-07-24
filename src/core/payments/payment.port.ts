export interface PaymentAmount {
  readonly amountMinor: bigint;
  readonly currency: string;
}

export interface CreatePaymentRequest {
  readonly orderReference: string;
  readonly amount: PaymentAmount;
  readonly idempotencyKey: string;
  readonly returnUrl: URL;
}

export interface PaymentSession {
  readonly providerReference: string;
  readonly redirectUrl: URL;
}

export interface VerifiedWebhook {
  readonly providerEventId: string;
  readonly providerReference: string;
  readonly eventType: string;
  readonly occurredAt: Date;
  readonly payload: unknown;
}

export interface PaymentGatewayPort {
  createSession(request: CreatePaymentRequest): Promise<PaymentSession>;
}

export interface PaymentWebhookVerifier {
  verify(rawBody: Uint8Array, headers: Headers): Promise<VerifiedWebhook>;
}
