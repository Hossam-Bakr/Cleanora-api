import { PrismaPaymentsRepository } from "#modules/payments/infrastructure/prisma-payments.repository";

function decimal(value: string) {
  return { toFixed: () => value };
}

describe("R1-P14 prisma payments repository mapping", () => {
  it("maps account and entry reads from the persistence boundary", async () => {
    const client = {
      ledgerAccount: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "acc-1",
            countryId: "country-eg",
            currencyCode: "EGP",
            currencyDecimalPlaces: 2,
            accountType: "PLATFORM_CLEARING",
          },
        ]),
      },
      ledgerEntry: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "e1",
            journalId: "j1",
            accountId: "acc-1",
            entryType: "DEPOSIT",
            side: "DEBIT",
            amountMinorUnits: decimal("2500"),
            currencyCode: "EGP",
            account: { countryId: "country-eg", accountType: "PLATFORM_CLEARING" },
            links: [{ bookingId: "booking-1" }],
          },
        ]),
        createMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
      ledgerEntryLink: {
        findMany: vi.fn().mockResolvedValue([{ journalId: "j1" }]),
        create: vi.fn().mockResolvedValue({}),
      },
      financialIdempotencyKey: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({}),
      },
      financialAdjustment: {
        create: vi.fn().mockResolvedValue({}),
      },
      financialSnapshot: {
        create: vi.fn().mockResolvedValue({}),
      },
    };
    const repository = new PrismaPaymentsRepository(client as never);
    await expect(
      repository.findAccounts("country-eg", "EGP"),
    ).resolves.toEqual([
      {
        id: "acc-1",
        countryId: "country-eg",
        currencyCode: "EGP",
        currencyDecimalPlaces: 2,
        accountType: "PLATFORM_CLEARING",
      },
    ]);
    const entries = await repository.listEntriesByBooking("booking-1");
    expect(entries[0]?.amountMinorUnits).toBe("2500");
    expect(entries[0]?.bookingId).toBe("booking-1");
    await repository.insertJournal({
      journalId: "j2",
      bookingId: "booking-1",
      lines: [
        {
          id: "e2",
          accountId: "acc-1",
          entryType: "DEPOSIT",
          side: "DEBIT",
          amountMinorUnits: "2500",
          currencyCode: "EGP",
          currencyDecimalPlaces: 2,
        },
      ],
    });
    expect(client.ledgerEntry.createMany).toHaveBeenCalled();
    expect(client.ledgerEntryLink.create).toHaveBeenCalled();
    await expect(repository.findIdempotency({
      commandType: "POST_JOURNAL",
      actorKind: "TEST",
      actorId: "tester",
      idempotencyKey: "k",
    })).resolves.toBeNull();
    await repository.insertIdempotency({
      commandType: "POST_JOURNAL",
      actorKind: "TEST",
      actorId: "tester",
      idempotencyKey: "k",
      payloadHash: "hash",
      journalId: "j2",
    });
    await repository.insertAdjustment({
      id: "adj-1",
      actorKind: "STAFF_FINANCE",
      actorId: "finance",
      reason: "fix",
      originalJournalId: "j1",
      reversingJournalId: "j2",
    });
    await repository.insertSnapshot({
      id: "snap-1",
      subjectKind: "BOOKING",
      bookingId: "booking-1",
      currencyCode: "EGP",
      currencyDecimalPlaces: 2,
      debitMinorUnits: "2500",
      creditNetMinorUnits: "2500",
      derivedBalanceMinorUnits: "0",
      entryIdHash: "abc",
    });
    await repository.listEntriesByAccount("acc-1");
    await repository.listEntriesByJournal("j1");
    await repository.findJournalEntries("j1");
    expect(client.financialIdempotencyKey.create).toHaveBeenCalled();
    expect(client.financialAdjustment.create).toHaveBeenCalled();
    expect(client.financialSnapshot.create).toHaveBeenCalled();
  });

  it("maps an existing idempotency row and an empty booking journal list", async () => {
    const client = {
      ledgerAccount: { findMany: vi.fn() },
      ledgerEntry: { findMany: vi.fn(), createMany: vi.fn() },
      ledgerEntryLink: {
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn(),
      },
      financialIdempotencyKey: {
        findUnique: vi.fn().mockResolvedValue({
          payloadHash: "hash",
          journalId: "j1",
          snapshotId: null,
          adjustmentId: null,
        }),
        create: vi.fn(),
      },
      financialAdjustment: { create: vi.fn() },
      financialSnapshot: { create: vi.fn() },
    };
    const repository = new PrismaPaymentsRepository(client as never);
    await expect(
      repository.findIdempotency({
        commandType: "POST_JOURNAL",
        actorKind: "TEST",
        actorId: "tester",
        idempotencyKey: "k",
      }),
    ).resolves.toEqual({
      payloadHash: "hash",
      journalId: "j1",
      snapshotId: null,
      adjustmentId: null,
    });
    await expect(repository.listEntriesByBooking("missing")).resolves.toEqual([]);
    await repository.insertJournal({
      journalId: "j3",
      lines: [
        {
          id: "e3",
          accountId: "acc-1",
          entryType: "DEPOSIT",
          side: "DEBIT",
          amountMinorUnits: "1",
          currencyCode: "EGP",
          currencyDecimalPlaces: 2,
        },
      ],
    });
    expect(client.ledgerEntryLink.create).not.toHaveBeenCalled();
  });

  it("resolves journal-level BOOKING links when entry.links is empty", async () => {
    const client = {
      ledgerAccount: { findMany: vi.fn() },
      ledgerEntry: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "e1",
            journalId: "j1",
            accountId: "acc-1",
            entryType: "DEPOSIT",
            side: "DEBIT",
            amountMinorUnits: decimal("2500"),
            currencyCode: "EGP",
            account: { countryId: "country-eg", accountType: "PLATFORM_CLEARING" },
            links: [],
          },
        ]),
        createMany: vi.fn(),
      },
      ledgerEntryLink: {
        findMany: vi.fn().mockResolvedValue([
          { journalId: "j1", bookingId: "booking-1", kind: "BOOKING" },
        ]),
        create: vi.fn(),
      },
      financialIdempotencyKey: { findUnique: vi.fn(), create: vi.fn() },
      financialAdjustment: { create: vi.fn() },
      financialSnapshot: { create: vi.fn() },
    };
    const repository = new PrismaPaymentsRepository(client as never);
    const byJournal = await repository.listEntriesByJournal("j1");
    expect(byJournal[0]?.bookingId).toBe("booking-1");
    expect(client.ledgerEntryLink.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { journalId: { in: ["j1"] }, kind: "BOOKING" },
      }),
    );
    const byAccount = await repository.listEntriesByAccount("acc-1");
    expect(byAccount[0]?.bookingId).toBe("booking-1");
  });

  it("maps deposit payment method and payment lifecycle rows", async () => {
    const { Prisma } = await import("#generated/prisma/client");
    const methodRow = {
      id: "method-card",
      countryId: "country-eg",
      provider: "PAYMOB",
      methodKind: "CARD",
      code: "PAYMOB_CARD",
      displayNameAr: "بطاقة",
      displayNameEn: "Card",
      enabled: true,
      sortOrder: 1,
    };
    const paymentRow = {
      id: "pay-1",
      bookingId: "booking-1",
      customerUserId: "customer-1",
      purpose: "BOOKING_DEPOSIT",
      status: "PENDING",
      amountMinorUnits: decimal("2500"),
      currencyCode: "EGP",
      currencyDecimalPlaces: 2,
      paymentMethodId: "method-card",
      succeededAttemptId: null,
      ledgerJournalId: null,
    };
    const attemptRow = {
      id: "att-1",
      paymentId: "pay-1",
      bookingId: "booking-1",
      customerUserId: "customer-1",
      paymentMethodId: "method-card",
      status: "CREATED",
      amountMinorUnits: decimal("2500"),
      currencyCode: "EGP",
      currencyDecimalPlaces: 2,
      idempotencyKey: "idem-1",
      gatewaySessionRef: "session-1",
      redirectUrl: "https://pay.test",
      failureCode: null,
      failureMessageSafe: null,
      expiresAt: null,
      returnTokenHash: "hash",
    };
    const eventRow = {
      id: "evt-1",
      provider: "PAYMOB",
      idempotencyKey: "evt-1",
      paymentAttemptId: "att-1",
      paymentId: "pay-1",
      eventType: "TRANSACTION",
      signatureValid: true,
      status: "RECEIVED",
      payloadHash: "ph",
      processedAt: null,
    };
    const receiptRow = {
      id: "rcpt-1",
      paymentId: "pay-1",
      bookingId: "booking-1",
      customerUserId: "customer-1",
      amountMinorUnits: decimal("2500"),
      currencyCode: "EGP",
      currencyDecimalPlaces: 2,
      methodCode: "PAYMOB_CARD",
      providerRef: "session-1",
      issuedAt: new Date("2026-09-01T00:00:00.000Z"),
    };
    const refundRow = {
      id: "ref-1",
      paymentId: "pay-1",
      bookingId: "booking-1",
      customerUserId: "customer-1",
      amountMinorUnits: decimal("2500"),
      currencyCode: "EGP",
      currencyDecimalPlaces: 2,
      status: "REQUESTED",
      reason: "changed mind",
    };

    const client = {
      paymentMethod: {
        findMany: vi.fn().mockResolvedValue([methodRow]),
        findUnique: vi.fn().mockResolvedValue(methodRow),
        update: vi.fn().mockResolvedValue({ ...methodRow, enabled: false }),
      },
      payment: {
        findFirst: vi.fn().mockResolvedValue(null),
        findUnique: vi.fn().mockResolvedValue(paymentRow),
        create: vi.fn().mockResolvedValue(paymentRow),
        update: vi.fn().mockResolvedValue(paymentRow),
      },
      paymentAttempt: {
        findUnique: vi.fn().mockResolvedValue(attemptRow),
        findFirst: vi.fn().mockResolvedValue(attemptRow),
        create: vi.fn().mockResolvedValue(attemptRow),
        update: vi.fn().mockResolvedValue(attemptRow),
      },
      paymentGatewayEvent: {
        findUnique: vi.fn().mockResolvedValue(eventRow),
        create: vi.fn().mockResolvedValue(eventRow),
        update: vi.fn().mockResolvedValue(eventRow),
      },
      paymentReceipt: {
        findUnique: vi.fn().mockResolvedValue(receiptRow),
        create: vi.fn().mockResolvedValue(receiptRow),
      },
      refundRequest: {
        create: vi.fn().mockResolvedValue(refundRow),
      },
    };
    const repository = new PrismaPaymentsRepository(client as never);

    await expect(
      repository.listEnabledPaymentMethods("country-eg"),
    ).resolves.toEqual([
      expect.objectContaining({ id: "method-card", enabled: true }),
    ]);
    await expect(repository.findPaymentMethodById("method-card")).resolves.toEqual(
      expect.objectContaining({ code: "PAYMOB_CARD" }),
    );
    await expect(
      repository.setPaymentMethodEnabled("method-card", false),
    ).resolves.toEqual(expect.objectContaining({ enabled: false }));

    client.paymentMethod.update.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("missing", {
        code: "P2025",
        clientVersion: "test",
      }),
    );
    await expect(
      repository.setPaymentMethodEnabled("missing", true),
    ).resolves.toBeNull();

    await expect(
      repository.findSucceededDepositPayment("booking-1"),
    ).resolves.toBeNull();
    await expect(repository.findPaymentById("pay-1")).resolves.toEqual(
      expect.objectContaining({ amountMinorUnits: "2500" }),
    );
    await expect(
      repository.findAttemptByIdempotency({
        customerUserId: "customer-1",
        bookingId: "booking-1",
        idempotencyKey: "idem-1",
      }),
    ).resolves.toEqual(expect.objectContaining({ id: "att-1" }));
    await expect(repository.findAttemptById("att-1")).resolves.toEqual(
      expect.objectContaining({ gatewaySessionRef: "session-1" }),
    );
    await expect(
      repository.findAttemptByGatewaySessionRef("session-1"),
    ).resolves.toEqual(expect.objectContaining({ id: "att-1" }));

    await repository.insertPayment({
      id: "pay-1",
      bookingId: "booking-1",
      customerUserId: "customer-1",
      purpose: "BOOKING_DEPOSIT",
      status: "PENDING",
      amountMinorUnits: "2500",
      currencyCode: "EGP",
      currencyDecimalPlaces: 2,
      paymentMethodId: "method-card",
    });
    await repository.insertAttempt({
      id: "att-1",
      paymentId: "pay-1",
      bookingId: "booking-1",
      customerUserId: "customer-1",
      paymentMethodId: "method-card",
      status: "CREATED",
      amountMinorUnits: "2500",
      currencyCode: "EGP",
      currencyDecimalPlaces: 2,
      idempotencyKey: "idem-1",
    });
    client.paymentAttempt.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("dup", {
        code: "P2002",
        clientVersion: "test",
      }),
    );
    await expect(
      repository.insertAttempt({
        id: "att-2",
        paymentId: "pay-1",
        bookingId: "booking-1",
        customerUserId: "customer-1",
        paymentMethodId: "method-card",
        status: "CREATED",
        amountMinorUnits: "2500",
        currencyCode: "EGP",
        currencyDecimalPlaces: 2,
        idempotencyKey: "idem-1",
      }),
    ).rejects.toMatchObject({ name: "PaymentsIdempotencyCollision" });

    await repository.updateAttemptGateway({
      attemptId: "att-1",
      status: "REDIRECTED",
      gatewaySessionRef: "session-1",
      redirectUrl: "https://pay.test",
      returnTokenHash: "hash",
    });
    await repository.markAttemptTerminal({
      attemptId: "att-1",
      status: "FAILED",
      failureCode: "DECLINED",
      failureMessageSafe: "declined",
    });
    await repository.markPaymentSucceeded({
      paymentId: "pay-1",
      succeededAttemptId: "att-1",
      ledgerJournalId: "j1",
    });
    await repository.markPaymentFailed("pay-1");

    await expect(repository.findGatewayEvent("PAYMOB", "evt-1")).resolves.toEqual(
      expect.objectContaining({ idempotencyKey: "evt-1" }),
    );
    await repository.insertGatewayEvent({
      id: "evt-1",
      provider: "PAYMOB",
      idempotencyKey: "evt-1",
      eventType: "TRANSACTION",
      signatureValid: true,
      status: "RECEIVED",
      payloadHash: "ph",
    });
    client.paymentGatewayEvent.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("dup", {
        code: "P2002",
        clientVersion: "test",
      }),
    );
    await expect(
      repository.insertGatewayEvent({
        id: "evt-2",
        provider: "PAYMOB",
        idempotencyKey: "evt-1",
        eventType: "TRANSACTION",
        signatureValid: true,
        status: "RECEIVED",
        payloadHash: "ph",
      }),
    ).rejects.toMatchObject({ name: "PaymentsIdempotencyCollision" });
    await repository.markGatewayEventProcessed({
      eventId: "evt-1",
      status: "PROCESSED",
      paymentAttemptId: "att-1",
      paymentId: "pay-1",
      processedAt: new Date("2026-09-01T00:00:00.000Z"),
    });

    await expect(repository.findReceiptByPaymentId("pay-1")).resolves.toEqual(
      expect.objectContaining({ methodCode: "PAYMOB_CARD" }),
    );
    await repository.insertReceipt({
      id: "rcpt-1",
      paymentId: "pay-1",
      bookingId: "booking-1",
      customerUserId: "customer-1",
      amountMinorUnits: "2500",
      currencyCode: "EGP",
      currencyDecimalPlaces: 2,
      methodCode: "PAYMOB_CARD",
      providerRef: "session-1",
      issuedAt: new Date("2026-09-01T00:00:00.000Z"),
    });
    await expect(
      repository.insertRefundRequest({
        id: "ref-1",
        paymentId: "pay-1",
        bookingId: "booking-1",
        customerUserId: "customer-1",
        amountMinorUnits: "2500",
        currencyCode: "EGP",
        currencyDecimalPlaces: 2,
        reason: "changed mind",
        requestedByActorKind: "CUSTOMER",
        requestedByActorId: "customer-1",
      }),
    ).resolves.toEqual(expect.objectContaining({ status: "REQUESTED" }));
  });
});
