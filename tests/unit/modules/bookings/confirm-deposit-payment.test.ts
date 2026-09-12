import { createConfirmDepositPayment } from "#modules/bookings/infrastructure/confirm-deposit-payment";
import { bookingError } from "#modules/bookings/bookings.errors";

describe("R1-P15 confirmDepositPayment", () => {
  it("confirms AWAITING_DEPOSIT when amount matches", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const createHistory = vi.fn().mockResolvedValue({});
    const findUnique = vi
      .fn()
      .mockResolvedValueOnce({
        id: "booking-1",
        status: "AWAITING_DEPOSIT",
        currencyCode: "EGP",
        depositMinorUnits: { toFixed: () => "2500" },
        version: 3,
      });
    const findFirst = vi.fn().mockResolvedValue({ id: "rule-1" });
    const confirm = createConfirmDepositPayment({
      $transaction: async (work: (tx: unknown) => Promise<unknown>) =>
        work({
          statusTransitionRule: { findFirst },
          booking: { findUnique, updateMany },
          bookingStatusHistory: { create: createHistory },
        }),
    });
    await expect(
      confirm({
        bookingId: "booking-1",
        paymentId: "pay-1",
        expectedDepositMinorUnits: "2500",
        currencyCode: "EGP",
        actorKind: "SYSTEM",
        actorId: "payments-webhook",
        reason: "verified",
      }),
    ).resolves.toEqual({ bookingId: "booking-1", status: "CONFIRMED" });
    expect(updateMany).toHaveBeenCalled();
    expect(createHistory).toHaveBeenCalled();
  });

  it("rejects illegal status and amount mismatch", async () => {
    const confirmIllegal = createConfirmDepositPayment({
      $transaction: async (work: (tx: unknown) => Promise<unknown>) =>
        work({
          statusTransitionRule: {
            findFirst: vi.fn().mockResolvedValue({ id: "rule-1" }),
          },
          booking: {
            findUnique: vi.fn().mockResolvedValue({
              id: "booking-1",
              status: "DRAFT",
              currencyCode: "EGP",
              depositMinorUnits: { toFixed: () => "2500" },
              version: 1,
            }),
            updateMany: vi.fn(),
          },
          bookingStatusHistory: { create: vi.fn() },
        }),
    });
    await expect(
      confirmIllegal({
        bookingId: "booking-1",
        paymentId: "pay-1",
        expectedDepositMinorUnits: "2500",
        currencyCode: "EGP",
        actorKind: "SYSTEM",
        actorId: "system",
        reason: "verified",
      }),
    ).rejects.toMatchObject({ code: "TRANSITION_NOT_AVAILABLE" });

    const confirmAmount = createConfirmDepositPayment({
      $transaction: async (work: (tx: unknown) => Promise<unknown>) =>
        work({
          statusTransitionRule: {
            findFirst: vi.fn().mockResolvedValue({ id: "rule-1" }),
          },
          booking: {
            findUnique: vi.fn().mockResolvedValue({
              id: "booking-1",
              status: "AWAITING_DEPOSIT",
              currencyCode: "EGP",
              depositMinorUnits: { toFixed: () => "2500" },
              version: 1,
            }),
            updateMany: vi.fn(),
          },
          bookingStatusHistory: { create: vi.fn() },
        }),
    });
    await expect(
      confirmAmount({
        bookingId: "booking-1",
        paymentId: "pay-1",
        expectedDepositMinorUnits: "9999",
        currencyCode: "EGP",
        actorKind: "SYSTEM",
        actorId: "system",
        reason: "verified",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    expect(bookingError("VALIDATION_FAILED").code).toBe("VALIDATION_FAILED");
  });

  it("rejects empty fields and non-system actors", async () => {
    const confirm = createConfirmDepositPayment({
      $transaction: async () => {
        throw new Error("should not run");
      },
    });
    await expect(
      confirm({
        bookingId: "",
        paymentId: "pay-1",
        expectedDepositMinorUnits: "2500",
        currencyCode: "EGP",
        actorKind: "SYSTEM",
        actorId: "system",
        reason: "verified",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(
      confirm({
        bookingId: "booking-1",
        paymentId: "pay-1",
        expectedDepositMinorUnits: "2500",
        currencyCode: "EGP",
        actorKind: "CUSTOMER" as never,
        actorId: "customer-1",
        reason: "verified",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("is idempotent when booking is already CONFIRMED", async () => {
    const confirm = createConfirmDepositPayment({
      $transaction: async (work: (tx: unknown) => Promise<unknown>) =>
        work({
          statusTransitionRule: {
            findFirst: vi.fn().mockResolvedValue({ id: "rule-1" }),
          },
          booking: {
            findUnique: vi.fn().mockResolvedValue({
              id: "booking-1",
              status: "CONFIRMED",
              currencyCode: "EGP",
              depositMinorUnits: { toFixed: () => "2500" },
              version: 4,
            }),
            updateMany: vi.fn(),
          },
          bookingStatusHistory: { create: vi.fn() },
        }),
    });
    await expect(
      confirm({
        bookingId: "booking-1",
        paymentId: "pay-1",
        expectedDepositMinorUnits: "2500",
        currencyCode: "EGP",
        actorKind: "SYSTEM",
        actorId: "system",
        reason: "verified",
      }),
    ).resolves.toEqual({ bookingId: "booking-1", status: "CONFIRMED" });
  });

  it("rejects missing rule, currency mismatch, and claim races", async () => {
    const noRule = createConfirmDepositPayment({
      $transaction: async (work: (tx: unknown) => Promise<unknown>) =>
        work({
          statusTransitionRule: { findFirst: vi.fn().mockResolvedValue(null) },
          booking: { findUnique: vi.fn(), updateMany: vi.fn() },
          bookingStatusHistory: { create: vi.fn() },
        }),
    });
    await expect(
      noRule({
        bookingId: "booking-1",
        paymentId: "pay-1",
        expectedDepositMinorUnits: "2500",
        currencyCode: "EGP",
        actorKind: "SYSTEM",
        actorId: "system",
        reason: "verified",
      }),
    ).rejects.toMatchObject({ code: "TRANSITION_NOT_AVAILABLE" });

    const currency = createConfirmDepositPayment({
      $transaction: async (work: (tx: unknown) => Promise<unknown>) =>
        work({
          statusTransitionRule: {
            findFirst: vi.fn().mockResolvedValue({ id: "rule-1" }),
          },
          booking: {
            findUnique: vi.fn().mockResolvedValue({
              id: "booking-1",
              status: "AWAITING_DEPOSIT",
              currencyCode: "USD",
              depositMinorUnits: { toFixed: () => "2500" },
              version: 1,
            }),
            updateMany: vi.fn(),
          },
          bookingStatusHistory: { create: vi.fn() },
        }),
    });
    await expect(
      currency({
        bookingId: "booking-1",
        paymentId: "pay-1",
        expectedDepositMinorUnits: "2500",
        currencyCode: "EGP",
        actorKind: "SYSTEM",
        actorId: "system",
        reason: "verified",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });

    const raced = createConfirmDepositPayment({
      $transaction: async (work: (tx: unknown) => Promise<unknown>) =>
        work({
          statusTransitionRule: {
            findFirst: vi.fn().mockResolvedValue({ id: "rule-1" }),
          },
          booking: {
            findUnique: vi
              .fn()
              .mockResolvedValueOnce({
                id: "booking-1",
                status: "AWAITING_DEPOSIT",
                currencyCode: "EGP",
                depositMinorUnits: { toFixed: () => "2500" },
                version: 1,
              })
              .mockResolvedValueOnce({ status: "CONFIRMED" }),
            updateMany: vi.fn().mockResolvedValue({ count: 0 }),
          },
          bookingStatusHistory: { create: vi.fn() },
        }),
    });
    await expect(
      raced({
        bookingId: "booking-1",
        paymentId: "pay-1",
        expectedDepositMinorUnits: "2500",
        currencyCode: "EGP",
        actorKind: "SYSTEM",
        actorId: "system",
        reason: "verified",
      }),
    ).resolves.toEqual({ bookingId: "booking-1", status: "CONFIRMED" });

    const conflict = createConfirmDepositPayment({
      $transaction: async (work: (tx: unknown) => Promise<unknown>) =>
        work({
          statusTransitionRule: {
            findFirst: vi.fn().mockResolvedValue({ id: "rule-1" }),
          },
          booking: {
            findUnique: vi
              .fn()
              .mockResolvedValueOnce({
                id: "booking-1",
                status: "AWAITING_DEPOSIT",
                currencyCode: "EGP",
                depositMinorUnits: { toFixed: () => "2500" },
                version: 1,
              })
              .mockResolvedValueOnce({ status: "AWAITING_DEPOSIT" }),
            updateMany: vi.fn().mockResolvedValue({ count: 0 }),
          },
          bookingStatusHistory: { create: vi.fn() },
        }),
    });
    await expect(
      conflict({
        bookingId: "booking-1",
        paymentId: "pay-1",
        expectedDepositMinorUnits: "2500",
        currencyCode: "EGP",
        actorKind: "SYSTEM",
        actorId: "system",
        reason: "verified",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
