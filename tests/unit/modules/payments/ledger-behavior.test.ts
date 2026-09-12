import { PaymentsError } from "#modules/payments/payments.errors";
import { createPaymentsApplicationService } from "#modules/payments/payments.service";
import { FakePaymentGateway } from "#modules/payments/adapters/fake.payment-gateway";
import { rejectWalletAccount } from "#modules/payments/payments.journal";
import {
  addMinorUnits,
  compareMinorUnits,
  requirePositiveMinorUnits,
  signedBalanceMinorUnits,
} from "#modules/payments/payments.money";
import type { BookingFinancialSnapshot } from "#modules/bookings/bookings.public";
import type { JournalLineInput } from "#modules/payments/payments.public";

import { createInMemoryPaymentsUnitOfWork } from "../../../helpers/r1-p14-in-memory-payments.js";
import { isPaymentsError } from "#modules/payments/payments.errors";

const DEPOSIT_LINES: readonly JournalLineInput[] = [
  {
    accountType: "PLATFORM_CLEARING",
    entryType: "DEPOSIT",
    side: "DEBIT",
    amountMinorUnits: "2500",
  },
  {
    accountType: "CUSTOMER_DEPOSIT_LIABILITY",
    entryType: "DEPOSIT",
    side: "CREDIT",
    amountMinorUnits: "2500",
  },
];

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

function createService(options?: {
  readonly booking?: BookingFinancialSnapshot | null;
}) {
  const memory = createInMemoryPaymentsUnitOfWork();
  memory.repository.seedEgypt();
  const booking = options?.booking === undefined ? bookingSnapshot() : options.booking;
  const service = createPaymentsApplicationService({
    unitOfWork: memory.unitOfWork,
    bookingReader: {
      readById: async () => booking,
    },
    gateway: new FakePaymentGateway(),
    confirmDepositPayment: async () => ({
      bookingId: booking?.bookingId ?? "booking-1",
      status: "CONFIRMED",
    }),
    returnTokenSecret: "test-return-secret",
  });
  return { service, memory };
}

describe("R1-P14 ledger money helpers", () => {
  it("rejects non-digit and zero amounts and signs debit-minus-credit", () => {
    expect(() => requirePositiveMinorUnits("12.5")).toThrow(PaymentsError);
    expect(() => requirePositiveMinorUnits("0")).toThrow(PaymentsError);
    expect(() => requirePositiveMinorUnits(" 1")).toThrow(PaymentsError);
    expect(() => requirePositiveMinorUnits("1".repeat(66))).toThrow(PaymentsError);
    expect(addMinorUnits("10", "5")).toBe("15");
    expect(compareMinorUnits("10", "10")).toBe(0);
    expect(compareMinorUnits("11", "10")).toBe(1);
    expect(compareMinorUnits("9", "10")).toBe(-1);
    expect(signedBalanceMinorUnits("10", "25")).toBe("-15");
    expect(isPaymentsError(new PaymentsError("WALLET_PROHIBITED"))).toBe(true);
    expect(isPaymentsError(new Error("no"))).toBe(false);
  });
});

describe("R1-P14 postJournal", () => {
  it("persists a balanced deposit journal and booking link", async () => {
    const { service, memory } = createService();
    const posted = await service.postJournal({
      actorKind: "TEST",
      actorId: "tester",
      idempotencyKey: "k1",
      countryId: "country-eg",
      currencyCode: "EGP",
      bookingId: "booking-1",
      lines: DEPOSIT_LINES,
    });
    expect(posted.journalId).toBeTruthy();
    expect(memory.repository.entries).toHaveLength(2);
    expect(memory.repository.entries[0]?.bookingId).toBe("booking-1");
  });

  it("writes nothing when the journal is unbalanced", async () => {
    const { service, memory } = createService();
    await expect(
      service.postJournal({
        actorKind: "TEST",
        actorId: "tester",
        idempotencyKey: "k2",
        countryId: "country-eg",
        currencyCode: "EGP",
        lines: [
          DEPOSIT_LINES[0]!,
          { ...DEPOSIT_LINES[1]!, amountMinorUnits: "1" },
        ],
      }),
    ).rejects.toMatchObject({ code: "JOURNAL_UNBALANCED" });
    expect(memory.repository.entries).toHaveLength(0);
  });

  it("replays the same idempotency payload and conflicts on a different body", async () => {
    const { service, memory } = createService();
    const first = await service.postJournal({
      actorKind: "TEST",
      actorId: "tester",
      idempotencyKey: "same",
      countryId: "country-eg",
      currencyCode: "EGP",
      lines: DEPOSIT_LINES,
    });
    const replay = await service.postJournal({
      actorKind: "TEST",
      actorId: "tester",
      idempotencyKey: "same",
      countryId: "country-eg",
      currencyCode: "EGP",
      lines: DEPOSIT_LINES,
    });
    expect(replay.journalId).toBe(first.journalId);
    expect(memory.repository.entries).toHaveLength(2);
    await expect(
      service.postJournal({
        actorKind: "TEST",
        actorId: "tester",
        idempotencyKey: "same",
        countryId: "country-eg",
        currencyCode: "EGP",
        lines: [
          { ...DEPOSIT_LINES[0]!, amountMinorUnits: "1000" },
          { ...DEPOSIT_LINES[1]!, amountMinorUnits: "1000" },
        ],
      }),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
  });

  it.each([
    {
      name: "marketer commission",
      lines: [
        { ...DEPOSIT_LINES[0]!, entryType: "MARKETER_COMMISSION" as const },
        { ...DEPOSIT_LINES[1]!, entryType: "MARKETER_COMMISSION" as const },
      ],
      code: "ENTRY_TYPE_NOT_POSTABLE",
    },
    {
      name: "order link",
      lines: DEPOSIT_LINES,
      linkKind: "ORDER" as const,
      code: "LINK_KIND_NOT_AVAILABLE",
    },
  ])("rejects $name", async ({ lines, linkKind, code }) => {
    const { service, memory } = createService();
    await expect(
      service.postJournal({
        actorKind: "TEST",
        actorId: "tester",
        idempotencyKey: "bad",
        countryId: "country-eg",
        currencyCode: "EGP",
        lines,
        ...(linkKind === undefined ? {} : { linkKind }),
      }),
    ).rejects.toMatchObject({ code });
    expect(memory.repository.entries).toHaveLength(0);
  });
});

describe("R1-P14 derived balance and reconcile", () => {
  it("sums signed entries for a system account", async () => {
    const { service } = createService();
    await service.postJournal({
      actorKind: "TEST",
      actorId: "tester",
      idempotencyKey: "bal",
      countryId: "country-eg",
      currencyCode: "EGP",
      lines: DEPOSIT_LINES,
    });
    const balance = await service.getDerivedBalance({
      countryId: "country-eg",
      currencyCode: "EGP",
      accountType: "CUSTOMER_DEPOSIT_LIABILITY",
    });
    expect(balance.creditMinorUnits).toBe("2500");
    expect(balance.balanceMinorUnits).toBe("-2500");
  });

  it("reconciles balanced, missing, and draft-not-ready without changing status", async () => {
    const awaiting = createService();
    await expect(
      awaiting.service.reconcileBooking({ bookingId: "booking-1" }),
    ).resolves.toMatchObject({ status: "MISSING", bookingStatus: "AWAITING_DEPOSIT" });
    await awaiting.service.postJournal({
      actorKind: "TEST",
      actorId: "tester",
      idempotencyKey: "dep",
      countryId: "country-eg",
      currencyCode: "EGP",
      bookingId: "booking-1",
      lines: DEPOSIT_LINES,
    });
    await expect(
      awaiting.service.reconcileBooking({ bookingId: "booking-1" }),
    ).resolves.toMatchObject({
      status: "BALANCED",
      postedDepositMinorUnits: "2500",
      bookingStatus: "AWAITING_DEPOSIT",
    });

    const draft = createService({
      booking: bookingSnapshot({ status: "DRAFT", depositMinorUnits: null }),
    });
    await expect(
      draft.service.reconcileBooking({ bookingId: "booking-1" }),
    ).resolves.toMatchObject({ status: "NOT_READY" });
  });

  it("sums multi-line DEBIT DEPOSIT amounts when reconciling", async () => {
    const { service } = createService({
      booking: bookingSnapshot({ depositMinorUnits: "100" }),
    });
    await service.postJournal({
      actorKind: "TEST",
      actorId: "tester",
      idempotencyKey: "multi-dep",
      countryId: "country-eg",
      currencyCode: "EGP",
      bookingId: "booking-1",
      lines: [
        {
          accountType: "PLATFORM_CLEARING",
          entryType: "DEPOSIT",
          side: "DEBIT",
          amountMinorUnits: "40",
        },
        {
          accountType: "PLATFORM_CLEARING",
          entryType: "DEPOSIT",
          side: "DEBIT",
          amountMinorUnits: "60",
        },
        {
          accountType: "CUSTOMER_DEPOSIT_LIABILITY",
          entryType: "DEPOSIT",
          side: "CREDIT",
          amountMinorUnits: "100",
        },
      ],
    });
    await expect(
      service.reconcileBooking({ bookingId: "booking-1" }),
    ).resolves.toMatchObject({
      status: "BALANCED",
      postedDepositMinorUnits: "100",
    });
  });
});

describe("R1-P14 adjustments, snapshots, and wallet ban", () => {
  it("posts compensating adjustment lines and keeps the original journal", async () => {
    const { service, memory } = createService();
    const original = await service.postJournal({
      actorKind: "TEST",
      actorId: "tester",
      idempotencyKey: "orig",
      countryId: "country-eg",
      currencyCode: "EGP",
      bookingId: "booking-1",
      lines: DEPOSIT_LINES,
    });
    const originalBytes = JSON.stringify(memory.repository.entries);
    const adjusted = await service.postAdjustment({
      actorKind: "STAFF_FINANCE",
      actorId: "finance-1",
      idempotencyKey: "adj",
      reason: "Correct deposit posting",
      originalJournalId: original.journalId,
      lines: [
        {
          accountType: "CUSTOMER_DEPOSIT_LIABILITY",
          entryType: "ADJUSTMENT",
          side: "DEBIT",
          amountMinorUnits: "2500",
        },
        {
          accountType: "PLATFORM_CLEARING",
          entryType: "ADJUSTMENT",
          side: "CREDIT",
          amountMinorUnits: "2500",
        },
      ],
    });
    expect(adjusted.adjustmentId).toBeTruthy();
    expect(JSON.stringify(memory.repository.entries.slice(0, 2))).toBe(originalBytes);
    expect(
      memory.repository.entries.filter((entry) => entry.entryType === "ADJUSTMENT"),
    ).toHaveLength(2);
    const reversing = await service.listEntries({ journalId: adjusted.journalId });
    expect(reversing.every((entry) => entry.bookingId === "booking-1")).toBe(true);
    await expect(
      service.postAdjustment({
        actorKind: "STAFF_FINANCE",
        actorId: "finance-1",
        idempotencyKey: "adj-empty",
        reason: "   ",
        originalJournalId: original.journalId,
        lines: DEPOSIT_LINES,
      }),
    ).rejects.toMatchObject({ code: "ADJUSTMENT_REASON_REQUIRED" });
  });

  it("freezes a snapshot hash so later posts do not rewrite it", async () => {
    const { service, memory } = createService();
    await service.postJournal({
      actorKind: "TEST",
      actorId: "tester",
      idempotencyKey: "s1",
      countryId: "country-eg",
      currencyCode: "EGP",
      bookingId: "booking-1",
      lines: DEPOSIT_LINES,
    });
    const first = await service.createSnapshot({
      actorKind: "TEST",
      actorId: "tester",
      idempotencyKey: "snap",
      countryId: "country-eg",
      currencyCode: "EGP",
      bookingId: "booking-1",
    });
    const hash = memory.repository.snapshots[0]?.entryIdHash;
    await service.postJournal({
      actorKind: "TEST",
      actorId: "tester",
      idempotencyKey: "s2",
      countryId: "country-eg",
      currencyCode: "EGP",
      bookingId: "booking-1",
      lines: DEPOSIT_LINES,
    });
    expect(memory.repository.snapshots[0]?.entryIdHash).toBe(hash);
    expect(first.snapshotId).toBe(memory.repository.snapshots[0]?.id);
  });

  it("persists provider-share type journals without a wallet API", async () => {
    const { service, memory } = createService();
    await service.postJournal({
      actorKind: "TEST",
      actorId: "tester",
      idempotencyKey: "share",
      countryId: "country-eg",
      currencyCode: "EGP",
      lines: [
        {
          accountType: "PLATFORM_CLEARING",
          entryType: "PROVIDER_SHARE",
          side: "DEBIT",
          amountMinorUnits: "7500",
        },
        {
          accountType: "PROVIDER_PAYABLE",
          entryType: "PROVIDER_SHARE",
          side: "CREDIT",
          amountMinorUnits: "7500",
        },
      ],
    });
    expect(memory.repository.entries[0]?.entryType).toBe("PROVIDER_SHARE");
    expect(service.createAccount).toBeTypeOf("function");
    await expect(service.createAccount({ userId: "user-1" })).rejects.toMatchObject({
      code: "WALLET_PROHIBITED",
    });
    expect(() => rejectWalletAccount({ userId: "user-1" })).toThrow(PaymentsError);
    expect(JSON.stringify(service)).not.toMatch(/topUp|transfer|withdraw/u);
  });

  it.each([
    {
      name: "COD remaining",
      entryType: "COD_REMAINING" as const,
      debit: "COD_CLEARING" as const,
      credit: "PLATFORM_CLEARING" as const,
    },
    {
      name: "payout",
      entryType: "PAYOUT" as const,
      debit: "PROVIDER_PAYABLE" as const,
      credit: "PAYOUT_CLEARING" as const,
    },
    {
      name: "refund",
      entryType: "REFUND" as const,
      debit: "REFUND_CLEARING" as const,
      credit: "PLATFORM_CLEARING" as const,
    },
  ])("persists $name journals without a wallet or gateway", async ({
    entryType,
    debit,
    credit,
  }) => {
    const { service, memory } = createService();
    await service.postJournal({
      actorKind: "TEST",
      actorId: "tester",
      idempotencyKey: entryType,
      countryId: "country-eg",
      currencyCode: "EGP",
      lines: [
        {
          accountType: debit,
          entryType,
          side: "DEBIT",
          amountMinorUnits: "1000",
        },
        {
          accountType: credit,
          entryType,
          side: "CREDIT",
          amountMinorUnits: "1000",
        },
      ],
    });
    expect(memory.repository.entries[0]?.entryType).toBe(entryType);
  });
});

describe("R1-P14 reads, snapshots, and fail-closed paths", () => {
  it("lists journal and booking entries and rejects an empty filter", async () => {
    const { service } = createService();
    const posted = await service.postJournal({
      actorKind: "TEST",
      actorId: "tester",
      idempotencyKey: "list",
      countryId: "country-eg",
      currencyCode: "EGP",
      bookingId: "booking-1",
      lines: DEPOSIT_LINES,
    });
    const byJournal = await service.listEntries({ journalId: posted.journalId });
    const byBooking = await service.listEntries({ bookingId: "booking-1" });
    expect(byJournal).toHaveLength(2);
    expect(byBooking).toHaveLength(2);
    await expect(service.listEntries({})).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
    });
  });

  it("replays snapshots and reports mismatched deposit totals", async () => {
    const { service } = createService();
    await service.postJournal({
      actorKind: "TEST",
      actorId: "tester",
      idempotencyKey: "mis",
      countryId: "country-eg",
      currencyCode: "EGP",
      bookingId: "booking-1",
      lines: [
        { ...DEPOSIT_LINES[0]!, amountMinorUnits: "1000" },
        { ...DEPOSIT_LINES[1]!, amountMinorUnits: "1000" },
      ],
    });
    await expect(
      service.reconcileBooking({ bookingId: "booking-1" }),
    ).resolves.toMatchObject({ status: "MISMATCHED" });
    const first = await service.createSnapshot({
      actorKind: "TEST",
      actorId: "tester",
      idempotencyKey: "acc-snap",
      countryId: "country-eg",
      currencyCode: "EGP",
      accountType: "PLATFORM_CLEARING",
    });
    const replay = await service.createSnapshot({
      actorKind: "TEST",
      actorId: "tester",
      idempotencyKey: "acc-snap",
      countryId: "country-eg",
      currencyCode: "EGP",
      accountType: "PLATFORM_CLEARING",
    });
    expect(replay.snapshotId).toBe(first.snapshotId);
    await expect(
      service.createSnapshot({
        actorKind: "TEST",
        actorId: "tester",
        idempotencyKey: "no-subject",
        countryId: "country-eg",
        currencyCode: "EGP",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(
      service.createSnapshot({
        actorKind: "TEST",
        actorId: "tester",
        idempotencyKey: "both-subject",
        countryId: "country-eg",
        currencyCode: "EGP",
        bookingId: "booking-1",
        accountType: "PLATFORM_CLEARING",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  });

  it("rejects unseeded accounts, missing bookings, and non-staff adjustments", async () => {
    const unseeded = createInMemoryPaymentsUnitOfWork();
    const bare = createPaymentsApplicationService({
      unitOfWork: unseeded.unitOfWork,
      bookingReader: { readById: async () => null },
      gateway: new FakePaymentGateway(),
      confirmDepositPayment: async () => ({
        bookingId: "booking-1",
        status: "CONFIRMED",
      }),
      returnTokenSecret: "test-return-secret",
    });
    await expect(
      bare.postJournal({
        actorKind: "TEST",
        actorId: "tester",
        idempotencyKey: "none",
        countryId: "country-eg",
        currencyCode: "EGP",
        lines: DEPOSIT_LINES,
      }),
    ).rejects.toMatchObject({ code: "ACCOUNT_NOT_SEEDED" });
    await expect(
      bare.reconcileBooking({ bookingId: "missing" }),
    ).rejects.toMatchObject({ code: "DEPENDENCY_FAILURE" });

    const { service } = createService();
    await expect(
      service.postAdjustment({
        actorKind: "TEST" as never,
        actorId: "tester",
        idempotencyKey: "adj-actor",
        reason: "fix",
        originalJournalId: "missing",
        lines: DEPOSIT_LINES,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(
      service.postAdjustment({
        actorKind: "STAFF_FINANCE",
        actorId: "finance",
        idempotencyKey: "adj-missing",
        reason: "Correct unknown journal",
        originalJournalId: "missing-journal",
        lines: [
          {
            accountType: "PLATFORM_CLEARING",
            entryType: "ADJUSTMENT",
            side: "DEBIT",
            amountMinorUnits: "1",
          },
          {
            accountType: "ADJUSTMENT_CLEARING",
            entryType: "ADJUSTMENT",
            side: "CREDIT",
            amountMinorUnits: "1",
          },
        ],
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(
      service.postJournal({
        actorKind: "TEST",
        actorId: "",
        idempotencyKey: "bad-schema",
        countryId: "country-eg",
        currencyCode: "EGP",
        lines: DEPOSIT_LINES,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });

    const mismatched = createInMemoryPaymentsUnitOfWork();
    mismatched.repository.findAccounts = async () => [
      {
        id: "acc-usd",
        countryId: "country-eg",
        currencyCode: "USD",
        currencyDecimalPlaces: 2,
        accountType: "PLATFORM_CLEARING",
      },
    ];
    const currencyService = createPaymentsApplicationService({
      unitOfWork: mismatched.unitOfWork,
      bookingReader: { readById: async () => bookingSnapshot() },
      gateway: new FakePaymentGateway(),
      confirmDepositPayment: async () => ({
        bookingId: "booking-1",
        status: "CONFIRMED",
      }),
      returnTokenSecret: "test-return-secret",
    });
    await expect(
      currencyService.postJournal({
        actorKind: "TEST",
        actorId: "tester",
        idempotencyKey: "fx",
        countryId: "country-eg",
        currencyCode: "EGP",
        lines: DEPOSIT_LINES,
      }),
    ).rejects.toMatchObject({ code: "CURRENCY_MISMATCH" });
  });

  it("replays a staff adjustment with the same payload", async () => {
    const { service } = createService();
    const original = await service.postJournal({
      actorKind: "TEST",
      actorId: "tester",
      idempotencyKey: "adj-orig",
      countryId: "country-eg",
      currencyCode: "EGP",
      bookingId: "booking-1",
      lines: DEPOSIT_LINES,
    });
    const lines = [
      {
        accountType: "CUSTOMER_DEPOSIT_LIABILITY" as const,
        entryType: "ADJUSTMENT" as const,
        side: "DEBIT" as const,
        amountMinorUnits: "2500",
      },
      {
        accountType: "PLATFORM_CLEARING" as const,
        entryType: "ADJUSTMENT" as const,
        side: "CREDIT" as const,
        amountMinorUnits: "2500",
      },
    ];
    const first = await service.postAdjustment({
      actorKind: "STAFF_FINANCE",
      actorId: "finance-1",
      idempotencyKey: "adj-replay",
      reason: "Correct deposit posting",
      originalJournalId: original.journalId,
      lines,
    });
    const replay = await service.postAdjustment({
      actorKind: "STAFF_FINANCE",
      actorId: "finance-1",
      idempotencyKey: "adj-replay",
      reason: "Correct deposit posting",
      originalJournalId: original.journalId,
      lines,
    });
    expect(replay).toEqual(first);
  });
});
