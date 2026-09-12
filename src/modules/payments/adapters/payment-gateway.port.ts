/**
 * Payment gateway port for deposit session creation and webhook verification.
 * @access Payments module
 */

export type PaymentGatewayMethodKind = "CARD" | "WALLET";

export interface CreateDepositSessionInput {
  readonly attemptId: string;
  readonly paymentId: string;
  readonly amountMinorUnits: string;
  readonly currencyCode: string;
  readonly customerReference: string;
  readonly returnUrl: string;
  readonly methodKind: PaymentGatewayMethodKind;
}

export interface CreateDepositSessionResult {
  readonly sessionRef: string;
  readonly redirectUrl: string;
}

export interface ParsedWebhookEvent {
  readonly idempotencyKey: string;
  readonly eventType: string;
  readonly success: boolean;
  readonly sessionRef?: string;
  readonly amountMinorUnits?: string;
  readonly currencyCode?: string;
  readonly failureCode?: string;
}

/**
 * Gateway adapter boundary. Only adapters may talk to Paymob (or fakes).
 */
export interface PaymentGatewayPort {
  readonly provider: "PAYMOB";
  createDepositSession(
    input: CreateDepositSessionInput,
  ): Promise<CreateDepositSessionResult>;
  verifyWebhookSignature(input: {
    readonly rawBody: Buffer;
    readonly signatureHeader: string | undefined;
  }): boolean;
  parseWebhookEvent(input: {
    readonly rawBody: Buffer;
  }): ParsedWebhookEvent;
}
