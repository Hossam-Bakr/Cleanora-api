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
});
