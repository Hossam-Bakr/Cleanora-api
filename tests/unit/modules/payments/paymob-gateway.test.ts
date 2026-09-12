import { createHmac } from "node:crypto";

import { PaymobPaymentGateway } from "#modules/payments/adapters/paymob.gateway";
import { PaymentsError } from "#modules/payments/payments.errors";

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

function configuredGateway(fetchImpl?: typeof fetch) {
  return new PaymobPaymentGateway({
    apiKey: "api-key",
    hmacSecret: "hmac-secret",
    integrationIdCard: "111",
    integrationIdWallet: "222",
    iframeBaseUrl: "https://paymob.test/iframes",
    ...(fetchImpl === undefined ? {} : { fetchImpl }),
  });
}

describe("R1-P15 PaymobPaymentGateway", () => {
  it("fromEnv fails closed unless all required secrets are present", () => {
    expect(PaymobPaymentGateway.fromEnv({})).toBeNull();
    expect(
      PaymobPaymentGateway.fromEnv({
        PAYMOB_API_KEY: "k",
        PAYMOB_HMAC_SECRET: "h",
        PAYMOB_INTEGRATION_ID_CARD: "1",
        PAYMOB_INTEGRATION_ID_WALLET: "2",
        PAYMOB_IFRAME_BASE_URL: "https://custom.iframe",
      }),
    ).toBeInstanceOf(PaymobPaymentGateway);
  });

  it("createDepositSession succeeds for CARD and WALLET via mocked fetch", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: "auth-token" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 9001 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: "payment-key" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: "auth-token-2" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 9002 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: "payment-key-2" }),
      });
    const gateway = configuredGateway(fetchImpl as unknown as typeof fetch);
    const card = await gateway.createDepositSession({
      attemptId: "att-1",
      paymentId: "pay-1",
      amountMinorUnits: "2500",
      currencyCode: "EGP",
      customerReference: "customer-1",
      returnUrl: "https://app.test/return",
      methodKind: "CARD",
    });
    expect(card.sessionRef).toBe("9001");
    expect(card.redirectUrl).toContain("payment_token=payment-key");

    const wallet = await gateway.createDepositSession({
      attemptId: "att-2",
      paymentId: "pay-2",
      amountMinorUnits: "2500",
      currencyCode: "EGP",
      customerReference: "customer-1",
      returnUrl: "https://app.test/return",
      methodKind: "WALLET",
    });
    expect(wallet.sessionRef).toBe("9002");
  });

  it.each([
    ["PAYMOB_AUTH", [{ ok: false, json: async () => ({}) }]],
    [
      "PAYMOB_AUTH_TOKEN",
      [{ ok: true, json: async () => ({ token: "" }) }],
    ],
    [
      "PAYMOB_ORDER",
      [
        { ok: true, json: async () => ({ token: "auth" }) },
        { ok: false, json: async () => ({}) },
      ],
    ],
    [
      "PAYMOB_ORDER_ID",
      [
        { ok: true, json: async () => ({ token: "auth" }) },
        { ok: true, json: async () => ({}) },
      ],
    ],
    [
      "PAYMOB_PAYMENT_KEY",
      [
        { ok: true, json: async () => ({ token: "auth" }) },
        { ok: true, json: async () => ({ id: 1 }) },
        { ok: false, json: async () => ({}) },
      ],
    ],
    [
      "PAYMOB_PAYMENT_KEY_TOKEN",
      [
        { ok: true, json: async () => ({ token: "auth" }) },
        { ok: true, json: async () => ({ id: 1 }) },
        { ok: true, json: async () => ({ token: "" }) },
      ],
    ],
  ] as const)(
    "createDepositSession fails closed at %s",
    async (stage, responses) => {
      const fetchImpl = vi.fn();
      for (const response of responses) {
        fetchImpl.mockResolvedValueOnce(response);
      }
      const gateway = configuredGateway(fetchImpl as unknown as typeof fetch);
      await expect(
        gateway.createDepositSession({
          attemptId: "att-1",
          paymentId: "pay-1",
          amountMinorUnits: "2500",
          currencyCode: "EGP",
          customerReference: "customer-1",
          returnUrl: "https://app.test/return",
          methodKind: "CARD",
        }),
      ).rejects.toMatchObject({
        code: "DEPENDENCY_FAILURE",
        details: { stage },
      });
    },
  );

  it("rejects non-positive amounts and incomplete config", async () => {
    const gateway = configuredGateway(
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ token: "auth" }),
      }) as unknown as typeof fetch,
    );
    await expect(
      gateway.createDepositSession({
        attemptId: "att-1",
        paymentId: "pay-1",
        amountMinorUnits: "0",
        currencyCode: "EGP",
        customerReference: "customer-1",
        returnUrl: "https://app.test/return",
        methodKind: "CARD",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });

    const blank = new PaymobPaymentGateway({
      apiKey: "",
      hmacSecret: "h",
      integrationIdCard: "1",
      integrationIdWallet: "2",
    });
    await expect(
      blank.createDepositSession({} as never),
    ).rejects.toBeInstanceOf(PaymentsError);
  });

  it("verifies HMAC for obj callback shape and raw body fallback", () => {
    const gateway = configuredGateway();
    const obj = {
      amount_cents: 2500,
      created_at: "2026-01-01T00:00:00.000Z",
      currency: "EGP",
      error_occured: false,
      has_parent_transaction: false,
      id: 55,
      integration_id: 111,
      is_3d_secure: false,
      is_auth: false,
      is_capture: false,
      is_refunded: false,
      is_standalone_payment: true,
      is_voided: false,
      order: { id: 9001 },
      owner: 1,
      pending: false,
      source_data: { pan: "2346", sub_type: "MasterCard", type: "card" },
      success: true,
    };
    const expected = createHmac("sha512", "hmac-secret")
      .update(concatenatePaymobObj(obj))
      .digest("hex");
    const rawBody = Buffer.from(JSON.stringify({ type: "TRANSACTION", obj }));
    expect(
      gateway.verifyWebhookSignature({
        rawBody,
        signatureHeader: expected,
      }),
    ).toBe(true);
    expect(
      gateway.verifyWebhookSignature({
        rawBody,
        signatureHeader: "deadbeef",
      }),
    ).toBe(false);

    const simpleBody = Buffer.from(
      JSON.stringify({
        idempotencyKey: "evt-1",
        eventType: "TRANSACTION",
        success: true,
      }),
    );
    const bodyHmac = createHmac("sha512", "hmac-secret")
      .update(simpleBody)
      .digest("hex");
    expect(
      gateway.verifyWebhookSignature({
        rawBody: simpleBody,
        signatureHeader: bodyHmac,
      }),
    ).toBe(true);
    expect(
      gateway.verifyWebhookSignature({
        rawBody: Buffer.from("not-json"),
        signatureHeader: "x",
      }),
    ).toBe(false);
    expect(
      gateway.verifyWebhookSignature({
        rawBody: simpleBody,
        signatureHeader: undefined,
      }),
    ).toBe(false);
  });

  it("parses success and failure Paymob obj events", () => {
    const gateway = configuredGateway();
    const success = gateway.parseWebhookEvent({
      rawBody: Buffer.from(
        JSON.stringify({
          type: "TRANSACTION",
          obj: {
            id: 77,
            success: "true",
            amount_cents: 2500,
            currency: "EGP",
            order: { id: 9001 },
          },
        }),
      ),
    });
    expect(success).toMatchObject({
      idempotencyKey: "paymob-txn-77",
      success: true,
      sessionRef: "9001",
      amountMinorUnits: "2500",
      currencyCode: "EGP",
    });

    const declined = gateway.parseWebhookEvent({
      rawBody: Buffer.from(
        JSON.stringify({
          type: "TRANSACTION",
          obj: {
            id: 78,
            success: false,
            error_occured: false,
            order: { id: 9002 },
          },
        }),
      ),
    });
    expect(declined.failureCode).toBe("GATEWAY_DECLINED");

    const gatewayError = gateway.parseWebhookEvent({
      rawBody: Buffer.from(
        JSON.stringify({
          obj: {
            success: false,
            error_occured: "true",
          },
        }),
      ),
    });
    expect(gatewayError.failureCode).toBe("GATEWAY_ERROR");
    expect(gatewayError.idempotencyKey).toContain("paymob-");

    const simple = gateway.parseWebhookEvent({
      rawBody: Buffer.from(
        JSON.stringify({
          idempotencyKey: "evt-simple",
          eventType: "TRANSACTION",
          success: true,
          sessionRef: "s1",
        }),
      ),
    });
    expect(simple.sessionRef).toBe("s1");

    expect(() =>
      gateway.parseWebhookEvent({
        rawBody: Buffer.from(JSON.stringify({ success: true })),
      }),
    ).toThrow(PaymentsError);
  });
});
