import type {
  PaymentGatewayPort,
  PaymentWebhookVerifier
} from "./payment.port.js";

export interface PaymobPort
  extends PaymentGatewayPort,
    PaymentWebhookVerifier {}

export const PAYMOB_PROVIDER_NAME = "paymob";
