import { Prisma } from "#generated/prisma/client";

import { quoteBooking } from "#modules/bookings/bookings.quote";
import { createPrismaBookingsCommandRepository } from "#modules/bookings/infrastructure/prisma-bookings.repository";

function money(value: string) {
  return { toFixed: () => value };
}

function command(
  commandType: "CREATE" | "SUBMIT_FOR_DEPOSIT" | "CANCEL" | "ATTACH_MEDIA",
  idempotencyKey: string,
) {
  return {
    customerUserId: "user-1",
    commandType,
    idempotencyKey,
    requestHash: `${idempotencyKey}-hash`,
  } as const;
}

function bookingRow(overrides: Record<string, unknown> = {}) {
  const quote = quoteBooking({
    currencyCode: "EGP",
    decimalPlaces: 2,
    priceAmount: "100.00",
    minimumChargeAmount: "80.00",
    depositPercent: "25",
  });
  return {
    id: "booking-1",
    customerUserId: "user-1",
    countryId: "country-1",
    currencyCode: "EGP",
    currencyDecimalPlaces: 2,
    status: "DRAFT",
    serviceId: "service-1",
    providerId: "provider-1",
    teamId: "team-1",
    cityId: "city-1",
    districtId: "district-1",
    startsAt: new Date("2026-09-10T08:00:00.000Z"),
    endsAt: new Date("2026-09-10T12:00:00.000Z"),
    crewPreference: "ANY",
    requiredTeamUnits: 1,
    locale: "AR",
    notes: null,
    emergencySignaled: false,
    version: 1,
    depositPercent: "25.00",
    eligibilityEvaluationId: "eval-1",
    grossMinorUnits: money(quote.grossMinorUnits),
    depositMinorUnits: money(quote.depositMinorUnits),
    remainderMinorUnits: money(quote.remainderMinorUnits),
    cancelledAt: null,
    submittedAt: null,
    createdAt: new Date("2026-09-10T07:00:00.000Z"),
    items: [
      {
        catalogServiceId: "service-1",
        catalogServiceCode: "HOME_CLEANING",
        catalogServiceVersion: 1,
        providerServiceId: "ps-1",
        providerServiceVersion: 1,
        providerServicePriceId: "psp-1",
        estimatedDurationMinutes: 120,
      },
    ],
    answers: [],
    address: {
      sourceUserAddressId: "addr-1",
      countryCode: "EG",
      cityId: "city-1",
      districtId: "district-1",
      cityLabel: "Cairo",
      districtLabel: "Nasr City",
      addressText: "1 Main",
      building: null,
      floor: null,
      notes: null,
    },
    media: [],
    snapshot: null,
    priceBreakdown: null,
    statusHistory: [
      {
        fromStatus: "NONE",
        toStatus: "DRAFT",
        actorType: "CUSTOMER",
        reasonCode: null,
        createdAt: new Date("2026-09-10T07:00:00.000Z"),
      },
    ],
    ...overrides,
  };
}

describe("prisma bookings command repository", () => {
  it("maps drafts, lists with a cursor, and records idempotent commands", async () => {
    const created = bookingRow();
    const client = {
      statusTransitionRule: {
        findFirst: vi.fn().mockResolvedValue({ id: "rule-1" }),
      },
      bookingCommand: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({}),
        update: vi.fn().mockResolvedValue({}),
      },
      booking: {
        create: vi.fn().mockResolvedValue(created),
        findFirst: vi.fn().mockResolvedValue(created),
        findMany: vi.fn().mockResolvedValue([created]),
        update: vi.fn().mockResolvedValue({ ...created, version: 2 }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findFirstOrThrow: vi.fn().mockResolvedValue(created),
      },
      bookingAnswer: { deleteMany: vi.fn(), createMany: vi.fn() },
      bookingAddress: { deleteMany: vi.fn(), create: vi.fn() },
      bookingMedia: { create: vi.fn() },
      bookingSnapshot: { create: vi.fn() },
      bookingPriceBreakdown: { create: vi.fn() },
      $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(client),
    };
    const repository = createPrismaBookingsCommandRepository(client);
    const quote = quoteBooking({
      currencyCode: "EGP",
      decimalPlaces: 2,
      priceAmount: "100.00",
      minimumChargeAmount: "80.00",
      depositPercent: "25",
    });
    const draft = await repository.createDraft({
      customerUserId: "user-1",
      countryId: "country-1",
      currencyCode: "EGP",
      currencyDecimalPlaces: 2,
      serviceId: "service-1",
      providerId: "provider-1",
      teamId: "team-1",
      cityId: "city-1",
      districtId: "district-1",
      startsAt: new Date("2026-09-10T08:00:00.000Z"),
      endsAt: new Date("2026-09-10T12:00:00.000Z"),
      crewPreference: "ANY",
      requiredTeamUnits: 1,
      locale: "AR",
      notes: null,
      depositPercent: "25.00",
      eligibilityEvaluationId: "eval-1",
      quote,
      item: created.items[0]!,
      address: created.address,
      answers: [],
      command: command("CREATE", "idem-create"),
    });
    expect(draft.status).toBe("DRAFT");
    expect(draft.quote?.deposit).toBe("25.00");
    await expect(
      repository.findOwned({
        bookingId: "booking-1",
        customerUserId: "user-1",
      }),
    ).resolves.toMatchObject({ id: "booking-1" });
    const page = await repository.listOwned({
      customerUserId: "user-1",
      limit: 20,
    });
    expect(page.nextCursor).toBeNull();
    expect(client.bookingCommand.create).toHaveBeenCalled();
    expect(client.bookingCommand.update).toHaveBeenCalled();
    await expect(
      repository.isExecutableTransition({
        actor: "CUSTOMER",
        from: "NONE",
        to: "DRAFT",
      }),
    ).resolves.toBe(true);
  });

  it("mutates drafts, attaches media, freezes snapshots, and cancels", async () => {
    const created = bookingRow();
    const frozen = {
      ...created,
      version: 2,
      status: "AWAITING_DEPOSIT",
      snapshot: {
        catalogSnapshotJson: { serviceId: "service-1", name: "Frozen service" },
        providerSnapshotJson: { providerId: "provider-1", price: "125.00" },
        frozenAt: new Date("2026-09-10T08:30:00.000Z"),
      },
      priceBreakdown: {
        currencyCode: "EGP",
        decimalPlaces: 2,
        grossMinorUnits: money("12500"),
        depositMinorUnits: money("3125"),
        remainderMinorUnits: money("9375"),
        depositPercent: "25",
        formulaVersion: "r1-p13-v1",
        createdAt: new Date("2026-09-10T08:30:00.000Z"),
      },
    };
    const client = {
      statusTransitionRule: {
        findFirst: vi.fn().mockResolvedValue({ id: "rule-1" }),
      },
      booking: {
        findFirst: vi.fn().mockResolvedValue({ ...created, media: [] }),
        update: vi.fn().mockResolvedValue(frozen),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findFirstOrThrow: vi.fn().mockResolvedValue(frozen),
        findMany: vi.fn(),
        create: vi.fn(),
      },
      bookingAnswer: { deleteMany: vi.fn(), createMany: vi.fn() },
      bookingAddress: { deleteMany: vi.fn(), create: vi.fn() },
      bookingMedia: { create: vi.fn() },
      bookingSnapshot: { create: vi.fn() },
      bookingPriceBreakdown: { create: vi.fn() },
      bookingStatusHistory: { create: vi.fn() },
      bookingCommand: {
        create: vi.fn().mockResolvedValue({}),
        update: vi.fn().mockResolvedValue({}),
      },
      $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(client),
    };
    const repository = createPrismaBookingsCommandRepository(client);
    const quote = quoteBooking({
      currencyCode: "EGP",
      decimalPlaces: 2,
      priceAmount: "100.00",
      minimumChargeAmount: "80.00",
      depositPercent: "25",
    });
    await expect(
      repository.replaceDraftContents({
        bookingId: "booking-1",
        customerUserId: "user-1",
        expectedVersion: 1,
        notes: "n",
        address: created.address,
        answers: [
          { fieldId: "f1", fieldCode: "ROOMS", kind: "NUMBER", value: 2 },
        ],
      }),
    ).resolves.toMatchObject({ version: 2 });
    await expect(
      repository.attachMedia({
        bookingId: "booking-1",
        customerUserId: "user-1",
        expectedVersion: 1,
        mediaId: "media-1",
        command: command("ATTACH_MEDIA", "idem-media"),
      }),
    ).resolves.toMatchObject({ id: "booking-1" });
    await expect(
      repository.submitForDeposit({
        bookingId: "booking-1",
        customerUserId: "user-1",
        expectedVersion: 1,
        eligibilityEvaluationId: "eval-1",
        quote,
        catalogSnapshot: {},
        providerSnapshot: {},
        catalogHash: "a",
        providerHash: "b",
        priceInputHash: "c",
        command: command("SUBMIT_FOR_DEPOSIT", "idem-submit"),
      }),
    ).resolves.toMatchObject({
      status: "AWAITING_DEPOSIT",
      quote: { gross: "125.00", deposit: "31.25", remainder: "93.75" },
      snapshot: {
        catalog: { serviceId: "service-1", name: "Frozen service" },
        provider: { providerId: "provider-1", price: "125.00" },
      },
      priceBreakdown: { gross: "125.00", deposit: "31.25", remainder: "93.75" },
    });
    await expect(
      repository.cancel({
        bookingId: "booking-1",
        customerUserId: "user-1",
        expectedVersion: 1,
        reason: "OTHER",
        requestId: "req-1",
        command: command("CANCEL", "idem-cancel"),
      }),
    ).resolves.toMatchObject({ id: "booking-1" });
    client.booking.updateMany = vi.fn().mockResolvedValue({ count: 0 });
    client.booking.findFirst = vi
      .fn()
      .mockResolvedValueOnce({ ...created, media: [] })
      .mockResolvedValueOnce({ ...created, status: "DRAFT" })
      .mockResolvedValueOnce({ ...created, status: "DRAFT", version: 9 });
    await expect(
      repository.replaceDraftContents({
        bookingId: "booking-1",
        customerUserId: "user-1",
        expectedVersion: 1,
        notes: "lost-race",
        address: null,
        answers: null,
      }),
    ).resolves.toBe("CONFLICT");
    await expect(
      repository.replaceDraftContents({
        bookingId: "booking-1",
        customerUserId: "user-1",
        expectedVersion: 99,
        notes: null,
        address: null,
        answers: null,
      }),
    ).resolves.toBe("CONFLICT");
  });

  it("raises an idempotency collision when the transactional reservation races", async () => {
    const client = {
      statusTransitionRule: {
        findFirst: vi.fn().mockResolvedValue({ id: "rule-1" }),
      },
      bookingCommand: {
        create: vi.fn().mockRejectedValue(
          new Prisma.PrismaClientKnownRequestError("conflict", {
            code: "P2002",
            clientVersion: "test",
          }),
        ),
      },
      $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(client),
    };
    const repository = createPrismaBookingsCommandRepository(client);
    await expect(
      repository.createDraft({
        customerUserId: "user-1",
        countryId: "country-1",
        currencyCode: "EGP",
        currencyDecimalPlaces: 2,
        serviceId: "service-1",
        providerId: "provider-1",
        teamId: "team-1",
        cityId: "city-1",
        districtId: "district-1",
        startsAt: new Date("2026-09-10T08:00:00.000Z"),
        endsAt: new Date("2026-09-10T12:00:00.000Z"),
        crewPreference: "ANY",
        requiredTeamUnits: 1,
        locale: "AR",
        notes: null,
        depositPercent: "25",
        eligibilityEvaluationId: "eval-1",
        quote: quoteBooking({
          currencyCode: "EGP",
          decimalPlaces: 2,
          priceAmount: "100.00",
          minimumChargeAmount: "80.00",
          depositPercent: "25",
        }),
        item: bookingRow().items[0]!,
        address: bookingRow().address,
        answers: [],
        command: command("CREATE", "idem-1"),
      }),
    ).rejects.toThrow("BOOKING_IDEMPOTENCY_COLLISION");
  });

  it("maps remaining persistence outcomes and list pagination", async () => {
    const created = bookingRow({
      crewPreference: "ALL_MALE",
      grossMinorUnits: null,
      depositMinorUnits: null,
      remainderMinorUnits: null,
      address: null,
      items: [],
      media: [
        { mediaId: "m2", displayOrder: 2 },
        { mediaId: "m1", displayOrder: 1 },
      ],
    });
    const female = bookingRow({ crewPreference: "ALL_FEMALE" });
    const client = {
      statusTransitionRule: {
        findFirst: vi.fn().mockResolvedValue({ id: "rule-1" }),
      },
      bookingCommand: {
        findUnique: vi.fn().mockResolvedValue({
          requestHash: "abc",
          bookingId: "booking-1",
          responseJson: { id: "booking-1" },
        }),
        create: vi.fn().mockResolvedValue({}),
        update: vi.fn().mockResolvedValue({}),
      },
      booking: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ ...created, status: "CONFIRMED" })
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({
            ...created,
            status: "AWAITING_DEPOSIT",
            media: [],
          })
          .mockResolvedValueOnce({ ...created, version: 9, media: [] })
          .mockResolvedValueOnce({
            ...created,
            media: [
              { mediaId: "media-1", displayOrder: 0 },
              { mediaId: "a", displayOrder: 1 },
              { mediaId: "b", displayOrder: 2 },
              { mediaId: "c", displayOrder: 3 },
              { mediaId: "d", displayOrder: 4 },
            ],
          })
          .mockResolvedValueOnce({
            ...created,
            media: [{ mediaId: "media-1", displayOrder: 0 }],
          })
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ ...created, status: "AWAITING_DEPOSIT" })
          .mockResolvedValueOnce({ ...created, version: 9 })
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ ...created, status: "CONFIRMED" })
          .mockResolvedValueOnce({ ...created, version: 9 }),
        findMany: vi.fn().mockResolvedValue([created, female]),
        findFirstOrThrow: vi.fn().mockResolvedValue(created),
        update: vi.fn().mockResolvedValue(created),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        create: vi.fn(),
      },
      bookingAnswer: { deleteMany: vi.fn(), createMany: vi.fn() },
      bookingAddress: { deleteMany: vi.fn(), create: vi.fn() },
      bookingMedia: { create: vi.fn() },
      bookingSnapshot: { create: vi.fn() },
      bookingPriceBreakdown: { create: vi.fn() },
      bookingStatusHistory: { create: vi.fn() },
      $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(client),
    };
    const repository = createPrismaBookingsCommandRepository(client);
    expect(
      await repository.findCommand({
        customerUserId: "user-1",
        commandType: "CREATE",
        idempotencyKey: "idem-1",
      }),
    ).toMatchObject({ bookingId: "booking-1" });
    const page = await repository.listOwned({
      customerUserId: "user-1",
      limit: 1,
      status: "DRAFT",
      cursor: Buffer.from("booking-9", "utf8").toString("base64url"),
    });
    expect(page.items[0]?.crewPreference).toBe("all_male");
    expect(page.items[0]?.quote).toBeNull();
    expect(page.items[0]?.address).toBeNull();
    expect(page.nextCursor).not.toBeNull();

    await expect(
      repository.replaceDraftContents({
        bookingId: "booking-1",
        customerUserId: "user-1",
        expectedVersion: 1,
        notes: null,
        address: null,
        answers: [],
      }),
    ).resolves.toBe("NOT_FOUND");
    await expect(
      repository.replaceDraftContents({
        bookingId: "booking-1",
        customerUserId: "user-1",
        expectedVersion: 1,
        notes: null,
        address: null,
        answers: null,
      }),
    ).resolves.toBe("NOT_DRAFT");

    await expect(
      repository.attachMedia({
        bookingId: "booking-1",
        customerUserId: "user-1",
        expectedVersion: 1,
        mediaId: "media-1",
        command: command("ATTACH_MEDIA", "idem-media-not-found"),
      }),
    ).resolves.toBe("NOT_FOUND");
    await expect(
      repository.attachMedia({
        bookingId: "booking-1",
        customerUserId: "user-1",
        expectedVersion: 1,
        mediaId: "media-1",
        command: command("ATTACH_MEDIA", "idem-media-not-draft"),
      }),
    ).resolves.toBe("NOT_DRAFT");
    await expect(
      repository.attachMedia({
        bookingId: "booking-1",
        customerUserId: "user-1",
        expectedVersion: 1,
        mediaId: "media-1",
        command: command("ATTACH_MEDIA", "idem-media-conflict"),
      }),
    ).resolves.toBe("CONFLICT");
    await expect(
      repository.attachMedia({
        bookingId: "booking-1",
        customerUserId: "user-1",
        expectedVersion: 1,
        mediaId: "media-x",
        command: command("ATTACH_MEDIA", "idem-media-limit"),
      }),
    ).resolves.toBe("LIMIT");
    await expect(
      repository.attachMedia({
        bookingId: "booking-1",
        customerUserId: "user-1",
        expectedVersion: 1,
        mediaId: "media-1",
        command: command("ATTACH_MEDIA", "idem-media-existing"),
      }),
    ).resolves.toMatchObject({ id: "booking-1" });

    await expect(
      repository.submitForDeposit({
        bookingId: "booking-1",
        customerUserId: "user-1",
        expectedVersion: 1,
        eligibilityEvaluationId: "eval-1",
        quote: quoteBooking({
          currencyCode: "EGP",
          decimalPlaces: 2,
          priceAmount: "100.00",
          minimumChargeAmount: "80.00",
          depositPercent: "25",
        }),
        catalogSnapshot: {},
        providerSnapshot: {},
        catalogHash: "a",
        providerHash: "b",
        priceInputHash: "c",
        command: command("SUBMIT_FOR_DEPOSIT", "idem-submit-not-found"),
      }),
    ).resolves.toBe("NOT_FOUND");
    await expect(
      repository.submitForDeposit({
        bookingId: "booking-1",
        customerUserId: "user-1",
        expectedVersion: 1,
        eligibilityEvaluationId: "eval-1",
        quote: quoteBooking({
          currencyCode: "EGP",
          decimalPlaces: 2,
          priceAmount: "100.00",
          minimumChargeAmount: "80.00",
          depositPercent: "25",
        }),
        catalogSnapshot: {},
        providerSnapshot: {},
        catalogHash: "a",
        providerHash: "b",
        priceInputHash: "c",
        command: command("SUBMIT_FOR_DEPOSIT", "idem-submit-not-draft"),
      }),
    ).resolves.toBe("NOT_DRAFT");
    await expect(
      repository.submitForDeposit({
        bookingId: "booking-1",
        customerUserId: "user-1",
        expectedVersion: 1,
        eligibilityEvaluationId: "eval-1",
        quote: quoteBooking({
          currencyCode: "EGP",
          decimalPlaces: 2,
          priceAmount: "100.00",
          minimumChargeAmount: "80.00",
          depositPercent: "25",
        }),
        catalogSnapshot: {},
        providerSnapshot: {},
        catalogHash: "a",
        providerHash: "b",
        priceInputHash: "c",
        command: command("SUBMIT_FOR_DEPOSIT", "idem-submit-conflict"),
      }),
    ).resolves.toBe("CONFLICT");

    await expect(
      repository.cancel({
        bookingId: "booking-1",
        customerUserId: "user-1",
        expectedVersion: 1,
        reason: "OTHER",
        command: command("CANCEL", "idem-cancel-not-found"),
      }),
    ).resolves.toBe("NOT_FOUND");
    await expect(
      repository.cancel({
        bookingId: "booking-1",
        customerUserId: "user-1",
        expectedVersion: 1,
        reason: "OTHER",
        command: command("CANCEL", "idem-cancel-not-cancellable"),
      }),
    ).resolves.toBe("NOT_CANCELLABLE");
    await expect(
      repository.cancel({
        bookingId: "booking-1",
        customerUserId: "user-1",
        expectedVersion: 1,
        reason: "OTHER",
        command: command("CANCEL", "idem-cancel-conflict"),
      }),
    ).resolves.toBe("CONFLICT");
  });

  it("propagates unexpected PATCH persistence failures instead of relabeling them", async () => {
    const databaseFailure = new Error("database unavailable");
    const client = {
      booking: {
        findFirst: vi.fn().mockResolvedValue({ status: "DRAFT", version: 1 }),
        updateMany: vi.fn().mockRejectedValue(databaseFailure),
      },
      $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(client),
    };
    const repository = createPrismaBookingsCommandRepository(client);

    await expect(
      repository.replaceDraftContents({
        bookingId: "booking-1",
        customerUserId: "user-1",
        expectedVersion: 1,
        notes: "new note",
        address: null,
        answers: null,
      }),
    ).rejects.toBe(databaseFailure);
  });

  it("rolls back a command reservation when an atomic submit claim loses a race", async () => {
    let rolledBack = false;
    const bookingCommand = {
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
    };
    const client = {
      statusTransitionRule: {
        findFirst: vi.fn().mockResolvedValue({ id: "rule-1" }),
      },
      bookingCommand,
      booking: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce({ status: "DRAFT", version: 1 })
          .mockResolvedValueOnce({ status: "DRAFT" }),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
        try {
          return await fn(client);
        } catch (error) {
          rolledBack = true;
          throw error;
        }
      },
    };
    const repository = createPrismaBookingsCommandRepository(client);

    await expect(
      repository.submitForDeposit({
        bookingId: "booking-1",
        customerUserId: "user-1",
        expectedVersion: 1,
        eligibilityEvaluationId: "eval-1",
        quote: quoteBooking({
          currencyCode: "EGP",
          decimalPlaces: 2,
          priceAmount: "100.00",
          minimumChargeAmount: "80.00",
          depositPercent: "25",
        }),
        catalogSnapshot: {},
        providerSnapshot: {},
        catalogHash: "a",
        providerHash: "b",
        priceInputHash: "c",
        command: command("SUBMIT_FOR_DEPOSIT", "idem-lost-claim"),
      }),
    ).resolves.toBe("CONFLICT");
    expect(bookingCommand.create).toHaveBeenCalledOnce();
    expect(bookingCommand.update).not.toHaveBeenCalled();
    expect(rolledBack).toBe(true);
  });

  it("rejects the media limit before reserving the idempotency key", async () => {
    const bookingCommand = {
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
    };
    const client = {
      bookingCommand,
      booking: {
        findFirst: vi.fn().mockResolvedValue({
          status: "DRAFT",
          version: 1,
          media: Array.from({ length: 5 }, (_, index) => ({
            mediaId: `media-${index}`,
          })),
        }),
      },
      $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(client),
    };
    const repository = createPrismaBookingsCommandRepository(client);

    await expect(
      repository.attachMedia({
        bookingId: "booking-1",
        customerUserId: "user-1",
        expectedVersion: 1,
        mediaId: "media-6",
        command: command("ATTACH_MEDIA", "idem-media-limit"),
      }),
    ).resolves.toBe("LIMIT");
    expect(bookingCommand.create).not.toHaveBeenCalled();
  });

  it("replays an already-linked attachment when the draft is at the media limit", async () => {
    const created = bookingRow();
    const fullMedia = Array.from({ length: 5 }, (_, index) => ({
      mediaId: `media-${index}`,
      displayOrder: index,
    }));
    const bookingCommand = {
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
    };
    const client = {
      bookingCommand,
      booking: {
        findFirst: vi.fn().mockResolvedValue({
          ...created,
          media: fullMedia,
        }),
        findFirstOrThrow: vi.fn().mockResolvedValue({
          ...created,
          media: fullMedia,
        }),
      },
      $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(client),
    };
    const repository = createPrismaBookingsCommandRepository(client);

    const attached = await repository.attachMedia({
      bookingId: "booking-1",
      customerUserId: "user-1",
      expectedVersion: 1,
      mediaId: "media-0",
      command: command("ATTACH_MEDIA", "idem-media-existing-at-limit"),
    });
    expect(attached).toMatchObject({ id: "booking-1" });
    expect(attached).not.toBe("LIMIT");
    if (typeof attached !== "object") {
      throw new Error("expected an attached booking aggregate");
    }
    expect(attached.media).toHaveLength(5);
    expect(attached.media[0]).toEqual({
      mediaId: "media-0",
      displayOrder: 0,
    });
    expect(bookingCommand.create).toHaveBeenCalledOnce();
    expect(bookingCommand.update).toHaveBeenCalledOnce();
  });
});
