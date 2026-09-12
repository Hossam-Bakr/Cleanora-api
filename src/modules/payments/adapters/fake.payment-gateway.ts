import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import type {
  CreateDepositSessionInput,
  CreateDepositSessionResult,
  ParsedWebhookEvent,
  PaymentGatewayPort,
} from "./payment-gateway.port.js";

export interface FakePaymentGatewayOptions {
  readonly redirectBaseUrl?: string;
  readonly hmacSecret?: string;
  readonly failCreate?: boolean;
}

/**
 * @desc Deterministic in-process gateway for tests and local fail-open demos.
 * @access Payments adapters / tests
 */
export class FakePaymentGateway implements PaymentGatewayPort {
  public readonly provider = "PAYMOB" as const;
  public readonly createdSessions: CreateDepositSessionInput[] = [];
  private readonly redirectBaseUrl: string;
  private readonly hmacSecret: string;
  private readonly failCreate: boolean;

  public constructor(options: FakePaymentGatewayOptions = {}) {
    this.redirectBaseUrl = options.redirectBaseUrl ?? "https://pay.fake.test/checkout";
    this.hmacSecret = options.hmacSecret ?? "fake-hmac-secret";
    this.failCreate = options.failCreate === true;
  }

  public async createDepositSession(
    input: CreateDepositSessionInput,
  ): Promise<CreateDepositSessionResult> {
    if (this.failCreate) {
      throw new Error("FakePaymentGateway createDepositSession failed");
    }
    this.createdSessions.push(input);
    const sessionRef = `fake-session-${input.attemptId}`;
    return {
      sessionRef,
      redirectUrl: `${this.redirectBaseUrl}?session=${encodeURIComponent(sessionRef)}&attempt=${encodeURIComponent(input.attemptId)}`,
    };
  }

  public verifyWebhookSignature(input: {
    readonly rawBody: Buffer;
    readonly signatureHeader: string | undefined;
  }): boolean {
    if (input.signatureHeader === undefined || input.signatureHeader.length === 0) {
      return false;
    }
    const expected = createHmac("sha512", this.hmacSecret)
      .update(input.rawBody)
      .digest("hex");
    try {
      const left = Buffer.from(expected, "utf8");
      const right = Buffer.from(input.signatureHeader, "utf8");
      return left.length === right.length && timingSafeEqual(left, right);
    } catch {
      return false;
    }
  }

  public parseWebhookEvent(input: {
    readonly rawBody: Buffer;
  }): ParsedWebhookEvent {
    const parsed = JSON.parse(input.rawBody.toString("utf8")) as {
      readonly idempotencyKey?: string;
      readonly eventType?: string;
      readonly success?: boolean;
      readonly sessionRef?: string;
      readonly amountMinorUnits?: string;
      readonly currencyCode?: string;
      readonly failureCode?: string;
    };
    if (
      typeof parsed.idempotencyKey !== "string" ||
      parsed.idempotencyKey.length === 0 ||
      typeof parsed.eventType !== "string" ||
      typeof parsed.success !== "boolean"
    ) {
      throw new Error("FakePaymentGateway webhook payload invalid");
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
      ...(parsed.failureCode === undefined
        ? {}
        : { failureCode: parsed.failureCode }),
    };
  }

  /**
   * @desc Helper for tests to build a signed webhook body.
   */
  public sign(body: object): { readonly rawBody: Buffer; readonly signature: string } {
    const rawBody = Buffer.from(JSON.stringify(body), "utf8");
    const signature = createHmac("sha512", this.hmacSecret)
      .update(rawBody)
      .digest("hex");
    return { rawBody, signature };
  }
}

/**
 * @desc Build a unique fake session id when tests need one without create.
 * @access Tests
 */
export function fakeGatewaySessionRef(): string {
  return `fake-session-${randomUUID()}`;
}
