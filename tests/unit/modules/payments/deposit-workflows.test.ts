import { MisconfiguredPaymentGateway } from "#modules/payments/adapters/misconfigured.payment-gateway";
import { PaymobPaymentGateway } from "#modules/payments/adapters/paymob.gateway";
import { PaymentsError } from "#modules/payments/payments.errors";
import {
  FakePaymentGateway,
  PAYMENTS_PUBLIC_CONTRACT,
  createPaymentsApplicationService,
} from "#modules/payments/payments.public";
import { PaymentsIdempotencyCollision } from "#modules/payments/payments.repository";
import type { BookingFinancialSnapshot } from "#modules/bookings/bookings.public";

import { createInMemoryPaymentsUnitOfWork } from "../../../helpers/r1-p14-in-memory-payments.js";

function bookingSnapshot(
  overrides: Partial<BookingFinancialSnapshot> = {},
): BookingFinancialSnapshot {
  return {
    bookingId: "booking-1",
    customerUserId: "customer-1",
    status: "AWAITING_DEPOSIT",
    countryId: "country-eg",
    currencyCode: "EGP",
    currencyDecimalPlaces: 2,
    providerId: "provider-1",
    grossMinorUnits: "10000",
    depositMinorUnits: "2500",
    remainderMinorUnits: "7500",
    ...overrides,
  };
}

describe("R1-P15 gateway adapters", () => {
  it("fails closed when Paymob env is incomplete", () => {
    expect(PaymobPaymentGateway.fromEnv({})).toBeNull();
    const gateway = new MisconfiguredPaymentGateway();
    expect(gateway.verifyWebhookSignature({ rawBody: Buffer.from("{}"), signatureHeader: "x" })).toBe(
      false,
    );
    return expect(gateway.createDepositSession({} as never)).rejects.toMatchObject({
      code: "GATEWAY_MISCONFIGURED",
    });
  });

  it("rejects invalid FakePaymentGateway signatures", () => {
    const gateway = new FakePaymentGateway({ hmacSecret: "secret" });
    const { rawBody } = gateway.sign({
      idempotencyKey: "evt-1",
      eventType: "TRANSACTION",
      success: true,
    });
    expect(
      gateway.verifyWebhookSignature({
        rawBody,
        signatureHeader: "deadbeef",
      }),
    ).toBe(false);
  });
});

describe("R1-P15 deposit workflows", () => {
  function setup(options?: {
    readonly booking?: BookingFinancialSnapshot | null;
    readonly confirm?: (input: unknown) => Promise<{ bookingId: string; status: "CONFIRMED" }>;
    readonly gateway?: FakePaymentGateway | MisconfiguredPaymentGateway;
  }) {
    const memory = createInMemoryPaymentsUnitOfWork();
    memory.repository.seedEgypt();
    const booking =
      options?.booking === undefined ? bookingSnapshot() : options.booking;
    const confirms: unknown[] = [];
    const gateway = options?.gateway ?? new FakePaymentGateway({ hmacSecret: "secret" });
    const service = createPaymentsApplicationService({
      unitOfWork: memory.unitOfWork,
      bookingReader: { readById: async () => booking },
      gateway,
      confirmDepositPayment: async (input) => {
        confirms.push(input);
        if (options?.confirm !== undefined) {
          return options.confirm(input);
        }
        return { bookingId: input.bookingId, status: "CONFIRMED" };
      },
      returnTokenSecret: "return-secret",
      isStaffAdmin: async (userId) => userId === "staff-1",
    });
    return { service, memory, gateway, confirms, booking };
  }

  it("SC-001 initiate is idempotent and does not mark paid/confirm", async () => {
    const { service, memory, confirms } = setup();
    const first = await service.initiateBookingDeposit({
      actorUserId: "customer-1",
      bookingId: "booking-1",
      paymentMethodId: "method-card",
      idempotencyKey: "idem-1",
    });
    const second = await service.initiateBookingDeposit({
      actorUserId: "customer-1",
      bookingId: "booking-1",
      paymentMethodId: "method-card",
      idempotencyKey: "idem-1",
    });
    expect(first.paymentId).toBe(second.paymentId);
    expect(first.attemptId).toBe(second.attemptId);
    expect(memory.repository.payments[0]?.status).toBe("PENDING");
    expect(confirms).toHaveLength(0);
    await expect(
      service.initiateBookingDeposit({
        actorUserId: "customer-1",
        bookingId: "booking-1",
        paymentMethodId: "method-wallet",
        idempotencyKey: "idem-1",
      }),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
  });

  it("SC-002 browser return never mutates paid/confirm", async () => {
    const { service, memory, confirms } = setup();
    const initiated = await service.initiateBookingDeposit({
      actorUserId: "customer-1",
      bookingId: "booking-1",
      paymentMethodId: "method-card",
      idempotencyKey: "idem-return",
    });
    const status = await service.getBrowserReturnStatus({
      actorUserId: "customer-1",
      paymentId: initiated.paymentId,
      attemptId: initiated.attemptId,
      returnToken: initiated.returnToken,
    });
    expect(status.paymentStatus).toBe("PENDING");
    expect(status.bookingStatus).toBe("AWAITING_DEPOSIT");
    expect(memory.repository.payments[0]?.status).toBe("PENDING");
    expect(confirms).toHaveLength(0);
  });

  it("SC-003 verified webhook success posts deposit, receipt, and confirm", async () => {
    const { service, memory, gateway, confirms } = setup();
    const initiated = await service.initiateBookingDeposit({
      actorUserId: "customer-1",
      bookingId: "booking-1",
      paymentMethodId: "method-card",
      idempotencyKey: "idem-ok",
    });
    const sessionRef = initiated.gateway.sessionRef!;
    const signed = (gateway as FakePaymentGateway).sign({
      idempotencyKey: "evt-success-1",
      eventType: "TRANSACTION",
      success: true,
      sessionRef,
      amountMinorUnits: "2500",
      currencyCode: "EGP",
    });
    const result = await service.processPaymobWebhook({
      rawBody: signed.rawBody,
      signatureHeader: signed.signature,
    });
    expect(result.replayed).toBe(false);
    expect(memory.repository.payments[0]?.status).toBe("SUCCEEDED");
    expect(memory.repository.receipts).toHaveLength(1);
    expect(memory.repository.entries.filter((e) => e.entryType === "DEPOSIT")).toHaveLength(2);
    expect(confirms).toHaveLength(1);
  });

  it("SC-004 invalid signature has no side effects", async () => {
    const { service, memory, confirms } = setup();
    await service.initiateBookingDeposit({
      actorUserId: "customer-1",
      bookingId: "booking-1",
      paymentMethodId: "method-card",
      idempotencyKey: "idem-sig",
    });
    await expect(
      service.processPaymobWebhook({
        rawBody: Buffer.from("{}"),
        signatureHeader: "nope",
      }),
    ).rejects.toMatchObject({ code: "WEBHOOK_SIGNATURE_INVALID" });
    expect(memory.repository.gatewayEvents).toHaveLength(0);
    expect(memory.repository.payments[0]?.status).toBe("PENDING");
    expect(confirms).toHaveLength(0);
  });

  it("SC-005 duplicate webhook is a harmless replay", async () => {
    const { service, memory, gateway, confirms } = setup();
    const initiated = await service.initiateBookingDeposit({
      actorUserId: "customer-1",
      bookingId: "booking-1",
      paymentMethodId: "method-card",
      idempotencyKey: "idem-dup",
    });
    const signed = (gateway as FakePaymentGateway).sign({
      idempotencyKey: "evt-dup",
      eventType: "TRANSACTION",
      success: true,
      sessionRef: initiated.gateway.sessionRef,
      amountMinorUnits: "2500",
      currencyCode: "EGP",
    });
    await service.processPaymobWebhook({
      rawBody: signed.rawBody,
      signatureHeader: signed.signature,
    });
    const replay = await service.processPaymobWebhook({
      rawBody: signed.rawBody,
      signatureHeader: signed.signature,
    });
    expect(replay.replayed).toBe(true);
    expect(memory.repository.payments.filter((p) => p.status === "SUCCEEDED")).toHaveLength(1);
    expect(memory.repository.receipts).toHaveLength(1);
    expect(confirms).toHaveLength(1);
  });

  it("SC-006 fail then retry then succeed yields one SUCCEEDED", async () => {
    const { service, memory, gateway } = setup();
    const first = await service.initiateBookingDeposit({
      actorUserId: "customer-1",
      bookingId: "booking-1",
      paymentMethodId: "method-card",
      idempotencyKey: "idem-fail",
    });
    const failSigned = (gateway as FakePaymentGateway).sign({
      idempotencyKey: "evt-fail",
      eventType: "TRANSACTION",
      success: false,
      sessionRef: first.gateway.sessionRef,
      failureCode: "DECLINED",
    });
    await service.processPaymobWebhook({
      rawBody: failSigned.rawBody,
      signatureHeader: failSigned.signature,
    });
    expect(memory.repository.attempts[0]?.status).toBe("FAILED");

    const second = await service.initiateBookingDeposit({
      actorUserId: "customer-1",
      bookingId: "booking-1",
      paymentMethodId: "method-card",
      idempotencyKey: "idem-retry",
    });
    const okSigned = (gateway as FakePaymentGateway).sign({
      idempotencyKey: "evt-ok",
      eventType: "TRANSACTION",
      success: true,
      sessionRef: second.gateway.sessionRef,
      amountMinorUnits: "2500",
      currencyCode: "EGP",
    });
    await service.processPaymobWebhook({
      rawBody: okSigned.rawBody,
      signatureHeader: okSigned.signature,
    });
    expect(
      memory.repository.payments.filter((payment) => payment.status === "SUCCEEDED"),
    ).toHaveLength(1);
  });

  it("SC-007 rails toggle affects customer list", async () => {
    const { service } = setup();
    const before = await service.listEnabledMethodsForCountry({
      countryId: "country-eg",
    });
    expect(before.map((m) => m.code).sort()).toEqual([
      "PAYMOB_CARD",
      "PAYMOB_WALLET",
    ]);
    await service.setPaymentMethodEnabled({
      staffUserId: "staff-1",
      methodId: "method-wallet",
      enabled: false,
    });
    const after = await service.listEnabledMethodsForCountry({
      countryId: "country-eg",
    });
    expect(after.map((m) => m.code)).toEqual(["PAYMOB_CARD"]);
  });

  it("SC-008 refund foundation creates REQUESTED only", async () => {
    const { service, memory, gateway } = setup();
    const initiated = await service.initiateBookingDeposit({
      actorUserId: "customer-1",
      bookingId: "booking-1",
      paymentMethodId: "method-card",
      idempotencyKey: "idem-refund",
    });
    const signed = (gateway as FakePaymentGateway).sign({
      idempotencyKey: "evt-refund-base",
      eventType: "TRANSACTION",
      success: true,
      sessionRef: initiated.gateway.sessionRef,
      amountMinorUnits: "2500",
      currencyCode: "EGP",
    });
    await service.processPaymobWebhook({
      rawBody: signed.rawBody,
      signatureHeader: signed.signature,
    });
    const refund = await service.createRefundRequest({
      paymentId: initiated.paymentId,
      actorKind: "CUSTOMER",
      actorId: "customer-1",
      reason: "changed mind",
    });
    expect(refund.status).toBe("REQUESTED");
    expect(memory.repository.refundRequests).toHaveLength(1);
    expect(
      memory.repository.entries.some((entry) => entry.entryType === "REFUND"),
    ).toBe(false);
  });

  it("initiate fails closed when gateway is misconfigured", async () => {
    const { service } = setup({ gateway: new MisconfiguredPaymentGateway() });
    await expect(
      service.initiateBookingDeposit({
        actorUserId: "customer-1",
        bookingId: "booking-1",
        paymentMethodId: "method-card",
        idempotencyKey: "idem-misconfig",
      }),
    ).rejects.toBeInstanceOf(PaymentsError);
  });

  it("rejects initiate for wrong owner, status, and already-succeeded deposit", async () => {
    await expect(
      setup({
        booking: bookingSnapshot({ customerUserId: "other" }),
      }).service.initiateBookingDeposit({
        actorUserId: "customer-1",
        bookingId: "booking-1",
        paymentMethodId: "method-card",
        idempotencyKey: "idem-owner",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    await expect(
      setup({
        booking: bookingSnapshot({ status: "DRAFT" }),
      }).service.initiateBookingDeposit({
        actorUserId: "customer-1",
        bookingId: "booking-1",
        paymentMethodId: "method-card",
        idempotencyKey: "idem-status",
      }),
    ).rejects.toMatchObject({ code: "TRANSITION_NOT_AVAILABLE" });

    const { service, memory, gateway } = setup();
    const initiated = await service.initiateBookingDeposit({
      actorUserId: "customer-1",
      bookingId: "booking-1",
      paymentMethodId: "method-card",
      idempotencyKey: "idem-pre",
    });
    const signed = (gateway as FakePaymentGateway).sign({
      idempotencyKey: "evt-pre",
      eventType: "TRANSACTION",
      success: true,
      sessionRef: initiated.gateway.sessionRef,
      amountMinorUnits: "2500",
      currencyCode: "EGP",
    });
    await service.processPaymobWebhook({
      rawBody: signed.rawBody,
      signatureHeader: signed.signature,
    });
    expect(memory.repository.payments[0]?.status).toBe("SUCCEEDED");
    await expect(
      service.initiateBookingDeposit({
        actorUserId: "customer-1",
        bookingId: "booking-1",
        paymentMethodId: "method-card",
        idempotencyKey: "idem-again",
      }),
    ).rejects.toMatchObject({ code: "PAYMENT_ALREADY_SUCCEEDED" });
  });

  it("enforces receipt authz, staff toggle, and refund foundation guards", async () => {
    const { service, gateway } = setup();
    expect(PAYMENTS_PUBLIC_CONTRACT.module).toBe("payments");
    expect(new PaymentsIdempotencyCollision().name).toBe(
      "PaymentsIdempotencyCollision",
    );

    await expect(
      service.setPaymentMethodEnabled({
        staffUserId: "customer-1",
        methodId: "method-wallet",
        enabled: false,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await expect(
      service.createRefundRequest({
        paymentId: "missing",
        actorKind: "CUSTOMER",
        actorId: "customer-1",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    const initiated = await service.initiateBookingDeposit({
      actorUserId: "customer-1",
      bookingId: "booking-1",
      paymentMethodId: "method-card",
      idempotencyKey: "idem-authz",
    });
    await expect(
      service.createRefundRequest({
        paymentId: initiated.paymentId,
        actorKind: "CUSTOMER",
        actorId: "customer-1",
      }),
    ).rejects.toMatchObject({ code: "TRANSITION_NOT_AVAILABLE" });

    const signed = (gateway as FakePaymentGateway).sign({
      idempotencyKey: "evt-authz",
      eventType: "TRANSACTION",
      success: true,
      sessionRef: initiated.gateway.sessionRef,
      amountMinorUnits: "2500",
      currencyCode: "EGP",
    });
    await service.processPaymobWebhook({
      rawBody: signed.rawBody,
      signatureHeader: signed.signature,
    });

    const ownerView = await service.getPaymentForReader({
      paymentId: initiated.paymentId,
      reader: { kind: "CUSTOMER", userId: "customer-1" },
    });
    expect(ownerView.receipt?.receiptId).toBeTruthy();

    await expect(
      service.getPaymentForReader({
        paymentId: initiated.paymentId,
        reader: { kind: "CUSTOMER", userId: "other" },
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    const staffView = await service.getPaymentForReader({
      paymentId: initiated.paymentId,
      reader: { kind: "STAFF_ADMIN", userId: "staff-1" },
    });
    expect(staffView.status).toBe("SUCCEEDED");

    await expect(
      service.getPaymentForReader({
        paymentId: initiated.paymentId,
        reader: { kind: "STAFF_ADMIN", userId: "customer-1" },
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await expect(
      service.createRefundRequest({
        paymentId: initiated.paymentId,
        actorKind: "CUSTOMER",
        actorId: "customer-1",
        amountMinorUnits: "99999",
      }),
    ).rejects.toMatchObject({ code: "AMOUNT_MISMATCH" });
  });

  it("browser return requires token or ownership and webhook ignores unknown sessions", async () => {
    const { service, gateway } = setup();
    const initiated = await service.initiateBookingDeposit({
      actorUserId: "customer-1",
      bookingId: "booking-1",
      paymentMethodId: "method-card",
      idempotencyKey: "idem-return-edge",
    });

    await expect(
      service.getBrowserReturnStatus({ paymentId: initiated.paymentId }),
    ).rejects.toMatchObject({ code: "AUTHENTICATION_REQUIRED" });

    await expect(
      service.getBrowserReturnStatus({
        paymentId: initiated.paymentId,
        actorUserId: "other",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    await expect(
      service.getBrowserReturnStatus({
        attemptId: initiated.attemptId,
        returnToken: "wrong-token",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const ignored = (gateway as FakePaymentGateway).sign({
      idempotencyKey: "evt-ignore",
      eventType: "TRANSACTION",
      success: true,
      sessionRef: "unknown-session",
      amountMinorUnits: "2500",
      currencyCode: "EGP",
    });
    const result = await service.processPaymobWebhook({
      rawBody: ignored.rawBody,
      signatureHeader: ignored.signature,
    });
    expect(result.replayed).toBe(false);
    expect(result.paymentId).toBeUndefined();

    const amountMismatch = (gateway as FakePaymentGateway).sign({
      idempotencyKey: "evt-amt",
      eventType: "TRANSACTION",
      success: true,
      sessionRef: initiated.gateway.sessionRef,
      amountMinorUnits: "1",
      currencyCode: "EGP",
    });
    await expect(
      service.processPaymobWebhook({
        rawBody: amountMismatch.rawBody,
        signatureHeader: amountMismatch.signature,
      }),
    ).rejects.toMatchObject({ code: "AMOUNT_MISMATCH" });
  });

  it("rejects unknown country when activeCountryExists is provided", async () => {
    const memory = createInMemoryPaymentsUnitOfWork();
    memory.repository.seedEgypt();
    const service = createPaymentsApplicationService({
      unitOfWork: memory.unitOfWork,
      bookingReader: { readById: async () => bookingSnapshot() },
      gateway: new FakePaymentGateway({ hmacSecret: "secret" }),
      confirmDepositPayment: async () => ({
        bookingId: "booking-1",
        status: "CONFIRMED",
      }),
      returnTokenSecret: "return-secret",
      activeCountryExists: async () => false,
    });
    await expect(
      service.listEnabledMethodsForCountry({ countryId: "missing" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("treats duplicate success webhook for already-SUCCEEDED payment as processed", async () => {
    const { service, gateway } = setup();
    const initiated = await service.initiateBookingDeposit({
      actorUserId: "customer-1",
      bookingId: "booking-1",
      paymentMethodId: "method-card",
      idempotencyKey: "idem-dup-success",
    });
    const first = (gateway as FakePaymentGateway).sign({
      idempotencyKey: "evt-first-ok",
      eventType: "TRANSACTION",
      success: true,
      sessionRef: initiated.gateway.sessionRef,
      amountMinorUnits: "2500",
      currencyCode: "EGP",
    });
    await service.processPaymobWebhook({
      rawBody: first.rawBody,
      signatureHeader: first.signature,
    });
    const second = (gateway as FakePaymentGateway).sign({
      idempotencyKey: "evt-second-ok",
      eventType: "TRANSACTION",
      success: true,
      sessionRef: initiated.gateway.sessionRef,
      amountMinorUnits: "2500",
      currencyCode: "EGP",
    });
    const result = await service.processPaymobWebhook({
      rawBody: second.rawBody,
      signatureHeader: second.signature,
    });
    expect(result.replayed).toBe(false);
    expect(result.paymentId).toBe(initiated.paymentId);
  });
});
