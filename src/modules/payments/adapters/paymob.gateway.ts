import { createHmac, timingSafeEqual } from "node:crypto";

import { paymentsError } from "../payments.errors.js";
import type {
  CreateDepositSessionInput,
  CreateDepositSessionResult,
  ParsedWebhookEvent,
  PaymentGatewayPort,
} from "./payment-gateway.port.js";

export interface PaymobGatewayConfig {
  readonly apiKey: string;
  readonly hmacSecret: string;
  readonly integrationIdCard: string;
  readonly integrationIdWallet: string;
  readonly iframeBaseUrl?: string;
  readonly fetchImpl?: typeof fetch;
}

/**
 * @desc Paymob adapter. Fail-closed when secrets/integration ids are incomplete.
 * @access Payments adapters
 */
export class PaymobPaymentGateway implements PaymentGatewayPort {
  public readonly provider = "PAYMOB" as const;
  private readonly config: PaymobGatewayConfig;
  private readonly fetchImpl: typeof fetch;

  public constructor(config: PaymobGatewayConfig) {
    this.config = config;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  /**
   * @desc Construct from environment; returns null when incomplete (caller fail-closes).
   */
  public static fromEnv(
    env: NodeJS.ProcessEnv = process.env,
  ): PaymobPaymentGateway | null {
    const apiKey = env["PAYMOB_API_KEY"]?.trim() ?? "";
    const hmacSecret = env["PAYMOB_HMAC_SECRET"]?.trim() ?? "";
    const integrationIdCard = env["PAYMOB_INTEGRATION_ID_CARD"]?.trim() ?? "";
    const integrationIdWallet = env["PAYMOB_INTEGRATION_ID_WALLET"]?.trim() ?? "";
    if (
      apiKey.length === 0 ||
      hmacSecret.length === 0 ||
      integrationIdCard.length === 0 ||
      integrationIdWallet.length === 0
    ) {
      return null;
    }
    return new PaymobPaymentGateway({
      apiKey,
      hmacSecret,
      integrationIdCard,
      integrationIdWallet,
      ...(env["PAYMOB_IFRAME_BASE_URL"] === undefined
        ? {}
        : { iframeBaseUrl: env["PAYMOB_IFRAME_BASE_URL"] }),
    });
  }

  public async createDepositSession(
    input: CreateDepositSessionInput,
  ): Promise<CreateDepositSessionResult> {
    this.assertConfigured();
    const integrationId =
      input.methodKind === "CARD"
        ? this.config.integrationIdCard
        : this.config.integrationIdWallet;
    const authResponse = await this.fetchImpl(
      "https://accept.paymob.com/api/auth/tokens",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: this.config.apiKey }),
      },
    );
    if (!authResponse.ok) {
      throw paymentsError("DEPENDENCY_FAILURE", { stage: "PAYMOB_AUTH" });
    }
    const authJson = (await authResponse.json()) as { readonly token?: string };
    if (typeof authJson.token !== "string" || authJson.token.length === 0) {
      throw paymentsError("DEPENDENCY_FAILURE", { stage: "PAYMOB_AUTH_TOKEN" });
    }
    const amountCents = Number.parseInt(input.amountMinorUnits, 10);
    if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
      throw paymentsError("VALIDATION_FAILED", { reason: "AMOUNT" });
    }
    const orderResponse = await this.fetchImpl(
      "https://accept.paymob.com/api/ecommerce/orders",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          auth_token: authJson.token,
          delivery_needed: false,
          amount_cents: amountCents,
          currency: input.currencyCode,
          merchant_order_id: input.attemptId,
          items: [],
        }),
      },
    );
    if (!orderResponse.ok) {
      throw paymentsError("DEPENDENCY_FAILURE", { stage: "PAYMOB_ORDER" });
    }
    const orderJson = (await orderResponse.json()) as { readonly id?: number };
    if (typeof orderJson.id !== "number") {
      throw paymentsError("DEPENDENCY_FAILURE", { stage: "PAYMOB_ORDER_ID" });
    }
    const paymentKeyResponse = await this.fetchImpl(
      "https://accept.paymob.com/api/acceptance/payment_keys",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          auth_token: authJson.token,
          amount_cents: amountCents,
          expiration: 3600,
          order_id: orderJson.id,
          billing_data: {
            apartment: "NA",
            email: "customer@cleanora.local",
            floor: "NA",
            first_name: "Customer",
            street: "NA",
            building: "NA",
            phone_number: "+201000000000",
            shipping_method: "NA",
            postal_code: "NA",
            city: "Cairo",
            country: "EG",
            last_name: "Cleanora",
            state: "NA",
          },
          currency: input.currencyCode,
          integration_id: Number.parseInt(integrationId, 10),
          lock_order_when_paid: true,
        }),
      },
    );
    if (!paymentKeyResponse.ok) {
      throw paymentsError("DEPENDENCY_FAILURE", { stage: "PAYMOB_PAYMENT_KEY" });
    }
    const paymentKeyJson = (await paymentKeyResponse.json()) as {
      readonly token?: string;
    };
    if (
      typeof paymentKeyJson.token !== "string" ||
      paymentKeyJson.token.length === 0
    ) {
      throw paymentsError("DEPENDENCY_FAILURE", {
        stage: "PAYMOB_PAYMENT_KEY_TOKEN",
      });
    }
    const iframeBase =
      this.config.iframeBaseUrl ?? "https://accept.paymob.com/api/acceptance/iframes";
    return {
      sessionRef: String(orderJson.id),
      redirectUrl: `${iframeBase}?payment_token=${encodeURIComponent(paymentKeyJson.token)}`,
    };
  }

  public verifyWebhookSignature(input: {
    readonly rawBody: Buffer;
    readonly signatureHeader: string | undefined;
  }): boolean {
    if (
      this.config.hmacSecret.trim().length === 0 ||
      input.signatureHeader === undefined ||
      input.signatureHeader.length === 0
    ) {
      return false;
    }
    try {
      const parsed = JSON.parse(input.rawBody.toString("utf8")) as {
        readonly obj?: Record<string, unknown>;
        readonly hmac?: string;
      };
      // Prefer concatenated obj fields when Paymob processed callback shape is present.
      if (parsed.obj !== undefined && typeof parsed.obj === "object") {
        const concatenated = concatenatePaymobObj(parsed.obj);
        const expected = createHmac("sha512", this.config.hmacSecret)
          .update(concatenated)
          .digest("hex");
        return safe.equalHex(expected, input.signatureHeader);
      }
      const expectedBody = createHmac("sha512", this.config.hmacSecret)
        .update(input.rawBody)
        .digest("hex");
      return safe.equalHex(expectedBody, input.signatureHeader);
    } catch {
      return false;
    }
  }

  public parseWebhookEvent(input: {
    readonly rawBody: Buffer;
  }): ParsedWebhookEvent {
    const parsed = JSON.parse(input.rawBody.toString("utf8")) as {
      readonly type?: string;
      readonly obj?: {
        readonly id?: number | string;
        readonly success?: boolean | string;
        readonly order?: { readonly id?: number | string; readonly merchant_order_id?: string };
        readonly amount_cents?: number | string;
        readonly currency?: string;
        readonly error_occured?: boolean | string;
      };
      readonly idempotencyKey?: string;
      readonly eventType?: string;
      readonly success?: boolean;
      readonly sessionRef?: string;
      readonly amountMinorUnits?: string;
      readonly currencyCode?: string;
    };

    if (parsed.obj !== undefined) {
      const obj = parsed.obj;
      const success =
        obj.success === true ||
        obj.success === "true" ||
        obj.success === "True";
      const sessionRef =
        obj.order?.id === undefined ? undefined : String(obj.order.id);
      const amount =
        obj.amount_cents === undefined ? undefined : String(obj.amount_cents);
      const idempotencyKey =
        obj.id === undefined
          ? `paymob-${sessionRef ?? "unknown"}-${parsed.type ?? "txn"}`
          : `paymob-txn-${String(obj.id)}`;
      return {
        idempotencyKey,
        eventType: typeof parsed.type === "string" ? parsed.type : "TRANSACTION",
        success,
        ...(sessionRef === undefined ? {} : { sessionRef }),
        ...(amount === undefined ? {} : { amountMinorUnits: amount }),
        ...(typeof obj.currency === "string"
          ? { currencyCode: obj.currency }
          : {}),
        ...(success
          ? {}
          : {
              failureCode:
                obj.error_occured === true || obj.error_occured === "true"
                  ? "GATEWAY_ERROR"
                  : "GATEWAY_DECLINED",
            }),
      };
    }

    if (
      typeof parsed.idempotencyKey !== "string" ||
      typeof parsed.eventType !== "string" ||
      typeof parsed.success !== "boolean"
    ) {
      throw paymentsError("VALIDATION_FAILED", { reason: "WEBHOOK_BODY" });
    }
    return {
      idempotencyKey: parsed.idempotencyKey,
      eventType: parsed.eventType,
      success: parsed.success,
      ...(parsed.sessionRef === undefined ? {} : { sessionRef: parsed.sessionRef }),
      ...(parsed.amountMinorUnits === undefined
        ? {}
        : { amountMinorUnits: parsed.amountMinorUnits }),
      ...(parsed.currencyCode === undefined
        ? {}
        : { currencyCode: parsed.currencyCode }),
    };
  }

  private assertConfigured(): void {
    if (
      this.config.apiKey.trim().length === 0 ||
      this.config.hmacSecret.trim().length === 0 ||
      this.config.integrationIdCard.trim().length === 0 ||
      this.config.integrationIdWallet.trim().length === 0
    ) {
      throw paymentsError("GATEWAY_MISCONFIGURED");
    }
  }
}

function concatenatePaymobObj(obj: Record<string, unknown>): string {
  const keys = [
    "amount_cents",
    "created_at",
    "currency",
    "error_occured",
    "has_parent_transaction",
    "id",
    "integration_id",
    "is_3d_secure",
    "is_auth",
    "is_capture",
    "is_refunded",
    "is_standalone_payment",
    "is_voided",
    "order",
    "owner",
    "pending",
    "source_data_pan",
    "source_data_sub_type",
    "source_data_type",
    "success",
  ];
  return keys
    .map((key) => {
      if (key === "order") {
        const order = obj["order"];
        if (order !== null && typeof order === "object" && "id" in order) {
          return String((order as { id: unknown }).id);
        }
        return "";
      }
      if (key.startsWith("source_data_")) {
        const source = obj["source_data"];
        if (source !== null && typeof source === "object") {
          const field = key.replace("source_data_", "");
          const value = (source as Record<string, unknown>)[field];
          return value === undefined || value === null ? "" : String(value);
        }
        return "";
      }
      const value = obj[key];
      return value === undefined || value === null ? "" : String(value);
    })
    .join("");
}

const safe = {
  equalHex(expected: string, provided: string): boolean {
    try {
      const left = Buffer.from(expected, "utf8");
      const right = Buffer.from(provided, "utf8");
      return left.length === right.length && timingSafeEqual(left, right);
    } catch {
      return false;
    }
  },
};
