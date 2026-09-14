import { BookingResponseService } from "#modules/bookings/bookings.response.service";
import { bookingError } from "#modules/bookings/bookings.errors";
import { hashBookingRequest } from "#modules/bookings/bookings.command.types";

function hoursFrom(now: Date, hours: number): Date {
  return new Date(now.getTime() + hours * 60 * 60 * 1000);
}

describe("R1-P16 booking response service", () => {
  const now = new Date("2026-09-13T12:00:00.000Z");

  function setup(options?: {
    readonly expired?: boolean;
    readonly status?: "CONFIRMED" | "ACCEPTED" | "CANCELLED" | "DRAFT";
    readonly manager?: boolean;
    readonly staff?: boolean;
  }) {
    const booking = {
      id: "bk-1",
      providerId: "prov-1",
      customerUserId: "cust-1",
      serviceId: "service-1",
      status: options?.status ?? "CONFIRMED",
      version: 4,
      locale: "AR" as const,
      startsAt: now,
      endsAt: hoursFrom(now, 3),
      crewPreference: "ANY",
      countryId: "eg",
      items: [
        {
          catalogServiceCode: "HOME_CLEANING",
          catalogServiceVersion: 1,
        },
      ],
      address: { addressText: "Nasr City" },
      priceBreakdown: {
        grossMinorUnits: { toFixed: () => "10000" },
        depositMinorUnits: { toFixed: () => "2500" },
        remainderMinorUnits: { toFixed: () => "7500" },
        currencyCode: "EGP",
      },
    };
    const response = {
      bookingId: "bk-1",
      providerId: "prov-1",
      status: "PENDING" as string,
      expiresAt: options?.expired ? hoursFrom(now, -1) : hoursFrom(now, 24),
      decidedAt: null as Date | null,
      decidedByUserId: null as string | null,
      rejectReasonId: null as string | null,
    };
    const reasons = [
      {
        id: "r-rej",
        code: "PROVIDER_CANNOT_FULFILL",
        actor: "PROVIDER",
        purpose: "REJECT",
        active: true,
        labelAr: "لا يمكن",
        labelEn: "Cannot",
        sortOrder: 10,
      },
      {
        id: "r-exp",
        code: "PROVIDER_RESPONSE_EXPIRED",
        actor: "SYSTEM",
        purpose: "CANCEL",
        active: true,
        labelAr: "انتهت",
        labelEn: "Expired",
        sortOrder: 10,
      },
      {
        id: "r-pc",
        code: "PROVIDER_UNABLE_TO_CONTINUE",
        actor: "PROVIDER",
        purpose: "CANCEL",
        active: true,
        labelAr: "تعذر",
        labelEn: "Unable",
        sortOrder: 10,
      },
      {
        id: "r-staff",
        code: "STAFF_OPS_CANCEL",
        actor: "STAFF_ADMIN",
        purpose: "CANCEL",
        active: true,
        labelAr: "تشغيلي",
        labelEn: "Ops",
        sortOrder: 10,
      },
      {
        id: "r-cust",
        code: "CUSTOMER_CHANGED_MIND",
        actor: "CUSTOMER",
        purpose: "CANCEL",
        active: true,
        labelAr: "رأي",
        labelEn: "Mind",
        sortOrder: 10,
      },
      {
        id: "r-cust-other",
        code: "CUSTOMER_CANCEL_OTHER",
        actor: "CUSTOMER",
        purpose: "CANCEL",
        active: true,
        labelAr: "آخر",
        labelEn: "Other",
        sortOrder: 90,
      },
    ];
    const actorCommands: Array<{
      id?: string;
      actorUserId?: string;
      commandType?: string;
      idempotencyKey?: string;
      requestHash?: string;
      responseJson?: unknown;
    }> = [];
    const customerCommands: Array<{
      id?: string;
      customerUserId?: string;
      commandType?: string;
      idempotencyKey?: string;
      requestHash?: string;
      responseJson?: unknown;
      bookingId?: string;
    }> = [];
    const intents: Array<{ template?: string; idempotencyKey?: string }> = [];
    const history: unknown[] = [];
    let cancellation: {
      id: string;
      actorKind: string;
      reason: { code: string };
      createdAt: Date;
    } | null = null;
    const rules = new Set([
      "PROVIDER:CONFIRMED:ACCEPTED",
      "PROVIDER:CONFIRMED:CANCELLED",
      "PROVIDER:ACCEPTED:CANCELLED",
      "SYSTEM:CONFIRMED:CANCELLED",
      "STAFF_ADMIN:CONFIRMED:CANCELLED",
      "STAFF_ADMIN:ACCEPTED:CANCELLED",
      "CUSTOMER:CONFIRMED:CANCELLED",
      "CUSTOMER:ACCEPTED:CANCELLED",
    ]);

    const tx = {
      booking: {
        findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
          where.id === booking.id
            ? {
                ...booking,
                response,
                cancellation,
                address: booking.address,
                priceBreakdown: booking.priceBreakdown,
                items: booking.items,
              }
            : null,
        ),
        findFirst: vi.fn(async ({ where }: { where: { id: string; customerUserId?: string } }) => {
          if (where.id !== booking.id) return null;
          if (where.customerUserId !== undefined && where.customerUserId !== booking.customerUserId) {
            return null;
          }
          return booking;
        }),
        updateMany: vi.fn(async (args: { where: { id?: string; status?: string; version?: number }; data: { status?: typeof booking.status; version?: unknown } }) => {
          const where = args.where;
          const data = args.data;
          if (where.id !== booking.id) return { count: 0 };
          if (where.status !== undefined && where.status !== booking.status) return { count: 0 };
          if (where.version !== undefined && where.version !== booking.version) return { count: 0 };
          if (data.status !== undefined) booking.status = data.status;
          if (data.version !== undefined) booking.version += 1;
          return { count: 1 };
        }),
      },
      bookingResponse: {
        findMany: vi.fn(async (args?: {
          where?: { status?: string; expiresAt?: { lte?: Date; gt?: Date } };
          take?: number;
        }) => {
          if (args?.where?.status !== undefined && response.status !== args.where.status) {
            return [];
          }
          const lte = args?.where?.expiresAt?.lte;
          const gt = args?.where?.expiresAt?.gt;
          if (lte !== undefined && response.expiresAt.getTime() > lte.getTime()) return [];
          if (gt !== undefined && response.expiresAt.getTime() <= gt.getTime()) return [];
          return [{ ...response, booking, bookingId: booking.id }].slice(0, args?.take);
        }),
        findUnique: vi.fn(async () => ({ ...response, booking })),
        create: vi.fn(async ({ data }: { data: Partial<typeof response> }) => {
          Object.assign(response, data);
          return response;
        }),
        update: vi.fn(async ({ data }: { data: Partial<typeof response> }) => {
          Object.assign(response, data);
          return response;
        }),
        updateMany: vi.fn(async ({ data }: { data: Partial<typeof response> }) => {
          Object.assign(response, data);
          return { count: 1 };
        }),
      },
      cancellationReason: {
        findMany: vi.fn(async ({ where }: { where: { actor?: string; purpose?: string } }) =>
          reasons.filter(
            (row) =>
              row.actor === where.actor &&
              row.purpose === where.purpose &&
              row.active === true,
          ),
        ),
        findFirst: vi.fn(async ({ where }: { where: { code?: string; actor?: string; purpose?: string } }) =>
          reasons.find(
            (row) =>
              row.code === where.code &&
              (where.actor === undefined || row.actor === where.actor) &&
              (where.purpose === undefined || row.purpose === where.purpose) &&
              row.active,
          ) ?? null,
        ),
        findUnique: vi.fn(async ({ where }: { where: { code: string } }) =>
          reasons.find((row) => row.code === where.code) ?? null,
        ),
      },
      statusTransitionRule: {
        findFirst: vi.fn(async ({ where }: { where: { actor: string; fromStatus: string; toStatus: string } }) =>
          rules.has(`${where.actor}:${where.fromStatus}:${where.toStatus}`)
            ? { id: "rule" }
            : null,
        ),
      },
      bookingStatusHistory: {
        create: vi.fn(async ({ data }: { data: unknown }) => {
          history.push(data);
          return data;
        }),
      },
      bookingCancellation: {
        findUnique: vi.fn(async () => cancellation),
        create: vi.fn(async ({ data }: { data: { actorKind: string; reasonId: string } }) => {
          const reason = reasons.find((row) => row.id === data.reasonId);
          cancellation = {
            id: "can-1",
            actorKind: data.actorKind,
            reason: { code: reason?.code ?? "x" },
            createdAt: now,
          };
          return cancellation;
        }),
      },
      bookingNotificationIntent: {
        upsert: vi.fn(async ({
          where,
          create,
        }: {
          where: { idempotencyKey: string };
          create: { template?: string; idempotencyKey?: string };
        }) => {
          const existing = intents.find((row) => row.idempotencyKey === where.idempotencyKey);
          if (existing !== undefined) return existing;
          intents.push(create);
          return create;
        }),
      },
      bookingActorCommand: {
        findUnique: vi.fn(async ({
          where,
        }: {
          where: {
            actorUserId_commandType_idempotencyKey: {
              actorUserId: string;
              commandType: string;
              idempotencyKey: string;
            };
          };
        }) => {
          const key = where.actorUserId_commandType_idempotencyKey;
          return (
            actorCommands.find(
              (row) =>
                row.actorUserId === key.actorUserId &&
                row.commandType === key.commandType &&
                row.idempotencyKey === key.idempotencyKey,
            ) ?? null
          );
        }),
        create: vi.fn(async ({ data }: { data: {
          actorUserId?: string;
          commandType?: string;
          idempotencyKey?: string;
          requestHash?: string;
          responseJson?: unknown;
        } }) => {
          const row = { id: `cmd-${actorCommands.length + 1}`, ...data };
          actorCommands.push(row);
          return row;
        }),
        update: vi.fn(async ({
          where,
          data,
        }: {
          where: { id: string };
          data: { responseJson?: unknown };
        }) => {
          const row = actorCommands.find((entry) => entry.id === where.id);
          if (row !== undefined) Object.assign(row, data);
          return row ?? data;
        }),
      },
      bookingCommand: {
        create: vi.fn(async ({ data }: { data: {
          customerUserId?: string;
          commandType?: string;
          idempotencyKey?: string;
          requestHash?: string;
          responseJson?: unknown;
          bookingId?: string;
        } }) => {
          const row = { id: `cust-cmd-${customerCommands.length + 1}`, ...data };
          customerCommands.push(row);
          return row;
        }),
        update: vi.fn(async ({
          where,
          data,
        }: {
          where: { id: string };
          data: { responseJson?: unknown };
        }) => {
          const row = customerCommands.find((entry) => entry.id === where.id);
          if (row !== undefined) Object.assign(row, data);
          return row ?? data;
        }),
      },
    };

    const client = {
      ...tx,
      $transaction: async (work: (inner: typeof tx) => Promise<unknown>) => {
        const snapshot = {
          status: booking.status,
          version: booking.version,
          responseStatus: response.status,
          decidedAt: response.decidedAt,
          intents: intents.slice(),
          history: history.slice(),
          commands: actorCommands.slice(),
          customerCommands: customerCommands.slice(),
          cancellation,
        };
        try {
          return await work(tx);
        } catch (error) {
          booking.status = snapshot.status;
          booking.version = snapshot.version;
          response.status = snapshot.responseStatus;
          response.decidedAt = snapshot.decidedAt;
          intents.length = 0;
          intents.push(...snapshot.intents);
          history.length = 0;
          history.push(...snapshot.history);
          actorCommands.length = 0;
          actorCommands.push(...snapshot.commands);
          customerCommands.length = 0;
          customerCommands.push(...snapshot.customerCommands);
          cancellation = snapshot.cancellation;
          throw error;
        }
      },
    };

    const service = new BookingResponseService({
      client,
      now: () => now,
      readResponseHours: async () => 24,
      assertActiveProviderManager: async (providerId, userId) => {
        if (options?.manager === false) throw bookingError("FORBIDDEN");
        return { providerId, userId, level: "OWNER" };
      },
      resolveProviderOwnerUserId: async () => "owner-1",
      isStaffAdmin: async () => options?.staff === true,
    });

    return { service, booking, response, intents, history, client, cancellation, customerCommands };
  }

  it("lists only non-expired pending inbox items for the selected provider", async () => {
    const { service } = setup();
    const listed = await service.listInbox({
      actorUserId: "owner-1",
      providerId: "prov-1",
      limit: 20,
    });
    expect(listed.items).toHaveLength(1);
    expect(listed.items[0]?.bookingId).toBe("bk-1");
    expect(listed.items[0]?.serviceLabel).toBe("HOME_CLEANING");
  });

  it("accepts a confirmed pending booking and writes a customer intent", async () => {
    const { service, booking, intents } = setup();
    const result = await service.accept({
      actorUserId: "owner-1",
      providerId: "prov-1",
      bookingId: "bk-1",
      version: 4,
      idempotencyKey: "idem-accept",
    });
    expect(result).toMatchObject({ status: "ACCEPTED", responseStatus: "ACCEPTED" });
    expect(booking.status).toBe("ACCEPTED");
    expect(intents.some((row) => row.template === "BOOKING_ACCEPTED")).toBe(true);
    expect(JSON.stringify(intents)).not.toMatch(/fee/i);
  });

  it("replays an identical accept without a second intent", async () => {
    const { service, intents } = setup();
    const first = await service.accept({
      actorUserId: "owner-1",
      providerId: "prov-1",
      bookingId: "bk-1",
      version: 4,
      idempotencyKey: "idem-accept",
    });
    const replay = await service.accept({
      actorUserId: "owner-1",
      providerId: "prov-1",
      bookingId: "bk-1",
      version: 4,
      idempotencyKey: "idem-accept",
    });
    expect(replay).toEqual(first);
    expect(intents.filter((row) => row.template === "BOOKING_ACCEPTED")).toHaveLength(1);
  });

  it("leaves booking CONFIRMED when notification intent insert fails", async () => {
    const { service, booking, client } = setup();
    client.bookingNotificationIntent.upsert = vi.fn(async () => {
      throw new Error("INTENT_INSERT_FAILED");
    });
    await expect(
      service.accept({
        actorUserId: "owner-1",
        providerId: "prov-1",
        bookingId: "bk-1",
        version: 4,
        idempotencyKey: "idem-intent-fail",
      }),
    ).rejects.toThrow("INTENT_INSERT_FAILED");
    expect(booking.status).toBe("CONFIRMED");
  });

  it("rejects a reused accept key with a different body", async () => {
    const { service } = setup();
    await service.accept({
      actorUserId: "owner-1",
      providerId: "prov-1",
      bookingId: "bk-1",
      version: 4,
      idempotencyKey: "idem-accept",
    });
    await expect(
      service.accept({
        actorUserId: "owner-1",
        providerId: "prov-1",
        bookingId: "bk-1",
        version: 5,
        idempotencyKey: "idem-accept",
      }),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_BODY_MISMATCH" });
  });

  it("rejects with a seeded reason and does not store a fee amount", async () => {
    const { service, booking, intents } = setup();
    const result = await service.reject({
      actorUserId: "owner-1",
      providerId: "prov-1",
      bookingId: "bk-1",
      version: 4,
      reasonCode: "PROVIDER_CANNOT_FULFILL",
      idempotencyKey: "idem-rej",
    });
    expect(result.status).toBe("CANCELLED");
    expect(result.responseStatus).toBe("REJECTED");
    expect(booking.status).toBe("CANCELLED");
    expect(JSON.stringify(result)).not.toMatch(/feeAmount|feeMinor/u);
    expect(intents.some((row) => row.template === "BOOKING_REJECTED")).toBe(true);
  });

  it("expires overdue pending responses and denies accept", async () => {
    const { service, booking, response, intents } = setup({ expired: true });
    await expect(
      service.accept({
        actorUserId: "owner-1",
        providerId: "prov-1",
        bookingId: "bk-1",
        version: 4,
        idempotencyKey: "idem-late",
      }),
    ).rejects.toMatchObject({ code: "RESPONSE_EXPIRED" });
    expect(booking.status).toBe("CANCELLED");
    expect(response.status).toBe("EXPIRED");
    expect(intents.some((row) => row.template === "BOOKING_RESPONSE_EXPIRED")).toBe(true);
  });

  it("returns RESPONSE_EXPIRED when customer cancel lazily expires the booking", async () => {
    const { service, booking } = setup({ expired: true });
    await expect(
      service.customerCancelConfirmed({
        customerUserId: "cust-1",
        bookingId: "bk-1",
        version: 4,
        reason: "CUSTOMER_CHANGED_MIND",
      }),
    ).rejects.toMatchObject({ code: "RESPONSE_EXPIRED" });
    expect(booking.status).toBe("CANCELLED");
  });

  it("returns RESPONSE_EXPIRED when staff cancel lazily expires the booking", async () => {
    const { service, booking } = setup({ expired: true, staff: true });
    await expect(
      service.staffCancel({
        actorUserId: "staff-1",
        bookingId: "bk-1",
        version: 4,
        reasonCode: "STAFF_OPS_CANCEL",
        idempotencyKey: "idem-st-exp",
      }),
    ).rejects.toMatchObject({ code: "RESPONSE_EXPIRED" });
    expect(booking.status).toBe("CANCELLED");
  });

  it("denies a different provider manager", async () => {
    const { service } = setup({ manager: false });
    await expect(
      service.listInbox({
        actorUserId: "other",
        providerId: "prov-1",
        limit: 20,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("leaves CONFIRMED unchanged when a worker or non-manager tries to accept", async () => {
    const { service, booking } = setup({ manager: false });
    await expect(
      service.accept({
        actorUserId: "worker-1",
        providerId: "prov-1",
        bookingId: "bk-1",
        version: 4,
        idempotencyKey: "idem-worker",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(booking.status).toBe("CONFIRMED");
  });

  it("rejects provider cancel from CONFIRMED", async () => {
    const { service } = setup();
    await expect(
      service.providerCancel({
        actorUserId: "owner-1",
        providerId: "prov-1",
        bookingId: "bk-1",
        version: 4,
        reasonCode: "PROVIDER_UNABLE_TO_CONTINUE",
        idempotencyKey: "idem-pc",
      }),
    ).rejects.toMatchObject({ code: "TRANSITION_NOT_AVAILABLE" });
  });

  it("cancels ACCEPTED bookings as the selected provider", async () => {
    const { service, booking, intents } = setup({ status: "ACCEPTED" });
    const result = await service.providerCancel({
      actorUserId: "owner-1",
      providerId: "prov-1",
      bookingId: "bk-1",
      version: 4,
      reasonCode: "PROVIDER_UNABLE_TO_CONTINUE",
      idempotencyKey: "idem-pc2",
    });
    expect(result.status).toBe("CANCELLED");
    expect(booking.status).toBe("CANCELLED");
    expect(intents.some((row) => row.template === "BOOKING_CANCELLED")).toBe(true);
  });

  it("requires staff_admin for the staff cancel hook", async () => {
    const { service } = setup({ staff: false });
    await expect(
      service.staffCancel({
        actorUserId: "not-staff",
        bookingId: "bk-1",
        version: 4,
        reasonCode: "STAFF_OPS_CANCEL",
        idempotencyKey: "idem-st",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("records staff cancel when authorized", async () => {
    const { service, booking, intents } = setup({ staff: true });
    const result = await service.staffCancel({
      actorUserId: "staff-1",
      bookingId: "bk-1",
      version: 4,
      reasonCode: "STAFF_OPS_CANCEL",
      idempotencyKey: "idem-st2",
    });
    expect(result.status).toBe("CANCELLED");
    expect(booking.status).toBe("CANCELLED");
    expect(intents.some((row) => row.template === "BOOKING_CANCELLED")).toBe(true);
  });

  it("records customer cancel from CONFIRMED without a fee field", async () => {
    const { service, booking, intents } = setup();
    const result = await service.customerCancelConfirmed({
      customerUserId: "cust-1",
      bookingId: "bk-1",
      version: 4,
      reason: "CUSTOMER_CHANGED_MIND",
    });
    expect(result.status).toBe("CANCELLED");
    expect(booking.status).toBe("CANCELLED");
    expect(JSON.stringify(result)).not.toMatch(/fee/i);
    expect(intents.some((row) => row.template === "BOOKING_CANCELLED")).toBe(true);
  });

  it("maps P13 OTHER to the seeded customer cancel reason", async () => {
    const { service, booking } = setup();
    await service.customerCancelConfirmed({
      customerUserId: "cust-1",
      bookingId: "bk-1",
      version: 4,
      reason: "OTHER",
    });
    expect(booking.status).toBe("CANCELLED");
  });

  it("writes the customer cancel command in the same transaction as CANCELLED", async () => {
    const { service, booking, customerCommands } = setup();
    await service.customerCancelConfirmed({
      customerUserId: "cust-1",
      bookingId: "bk-1",
      version: 4,
      reason: "CUSTOMER_CHANGED_MIND",
      command: {
        customerUserId: "cust-1",
        commandType: "CANCEL",
        idempotencyKey: "idem-cust-atomic",
        requestHash: "hash-1",
      },
    });
    expect(booking.status).toBe("CANCELLED");
    expect(customerCommands).toHaveLength(1);
    expect(customerCommands[0]).toMatchObject({
      idempotencyKey: "idem-cust-atomic",
      responseJson: { id: "bk-1", status: "CANCELLED", version: 5 },
    });
  });

  it("leaves booking CONFIRMED when the customer command row cannot be reserved", async () => {
    const { service, booking, client } = setup();
    client.bookingCommand.create = vi.fn(async () => {
      throw new Error("COMMAND_INSERT_FAILED");
    });
    await expect(
      service.customerCancelConfirmed({
        customerUserId: "cust-1",
        bookingId: "bk-1",
        version: 4,
        reason: "CUSTOMER_CHANGED_MIND",
        command: {
          customerUserId: "cust-1",
          commandType: "CANCEL",
          idempotencyKey: "idem-cust-fail",
          requestHash: "hash-fail",
        },
      }),
    ).rejects.toThrow("COMMAND_INSERT_FAILED");
    expect(booking.status).toBe("CONFIRMED");
  });

  it("treats a unique customer command collision as an idempotency collision", async () => {
    const { service, booking, client } = setup();
    client.bookingCommand.create = vi.fn(async () => {
      const error = new Error("Unique constraint failed");
      (error as Error & { code: string }).code = "P2002";
      throw error;
    });
    await expect(
      service.customerCancelConfirmed({
        customerUserId: "cust-1",
        bookingId: "bk-1",
        version: 4,
        reason: "CUSTOMER_CHANGED_MIND",
        command: {
          customerUserId: "cust-1",
          commandType: "CANCEL",
          idempotencyKey: "idem-cust-p2002",
          requestHash: "hash-p2002",
        },
      }),
    ).rejects.toMatchObject({ name: "BookingIdempotencyCollision" });
    expect(booking.status).toBe("CONFIRMED");
  });

  it("creates a pending response when hours and owner resolve", async () => {
    const { service, response, intents, client } = setup();
    client.bookingResponse.findUnique = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValue(response);
    await service.ensurePendingResponse(client as never, {
      bookingId: "bk-1",
      providerId: "prov-1",
      countryId: "eg",
      customerUserId: "cust-1",
      locale: "AR",
    });
    expect(response.status).toBe("PENDING");
    expect(intents.some((row) => row.template === "BOOKING_CONFIRMED_FOR_PROVIDER")).toBe(
      true,
    );
    await service.ensurePendingResponse(client as never, {
      bookingId: "bk-1",
      providerId: "prov-1",
      countryId: "eg",
      customerUserId: "cust-1",
      locale: "AR",
    });
    expect(
      intents.filter((row) => row.template === "BOOKING_CONFIRMED_FOR_PROVIDER"),
    ).toHaveLength(1);
  });

  it("fail-closes confirm side-effect when hours are missing", async () => {
    const { client } = setup();
    const service = new BookingResponseService({
      client,
      now: () => now,
      readResponseHours: async () => null,
      assertActiveProviderManager: async (providerId, userId) => ({
        providerId,
        userId,
        level: "OWNER",
      }),
      resolveProviderOwnerUserId: async () => "owner-1",
      isStaffAdmin: async () => false,
    });
    await expect(
      service.ensurePendingResponse(client as never, {
        bookingId: "bk-1",
        providerId: "prov-1",
        countryId: "eg",
        customerUserId: "cust-1",
        locale: "AR",
      }),
    ).rejects.toMatchObject({ code: "DEPENDENCY_FAILURE" });
  });

  it("returns the selected-provider dossier and hides other providers", async () => {
    const { service } = setup();
    const dossier = await service.getProviderDossier({
      actorUserId: "owner-1",
      providerId: "prov-1",
      bookingId: "bk-1",
    });
    expect(dossier.bookingId).toBe("bk-1");
    expect(dossier.serviceId).toBe("service-1");
    expect(dossier.service).toEqual({
      catalogServiceCode: "HOME_CLEANING",
      catalogServiceVersion: 1,
    });
    expect(dossier.quote?.deposit).toBe("2500");
    await expect(
      service.getProviderDossier({
        actorUserId: "owner-1",
        providerId: "other-prov",
        bookingId: "bk-1",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("lists seeded reject reasons and omits system codes from that list", async () => {
    const { service } = setup();
    const items = await service.listReasons({
      actor: "PROVIDER",
      purpose: "REJECT",
    });
    expect(items.map((row) => row.code)).toEqual(["PROVIDER_CANNOT_FULFILL"]);
  });

  it("denies staff dossier without staff_admin", async () => {
    const { service } = setup({ staff: false });
    await expect(
      service.getStaffDossier({ actorUserId: "not-staff", bookingId: "bk-1" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("returns a staff dossier when authorized", async () => {
    const { service } = setup({ staff: true });
    const dossier = await service.getStaffDossier({
      actorUserId: "staff-1",
      bookingId: "bk-1",
    });
    expect(dossier.bookingId).toBe("bk-1");
    expect(await service.peekDossier("bk-1")).toMatchObject({ bookingId: "bk-1" });
  });

  it("lazy-expires overdue inbox rows before listing", async () => {
    const { service, booking } = setup({ expired: true });
    const listed = await service.listInbox({
      actorUserId: "owner-1",
      providerId: "prov-1",
      limit: 20,
    });
    expect(listed.items).toHaveLength(0);
    expect(booking.status).toBe("CANCELLED");
  });

  it("stops inbox listing at the requested limit", async () => {
    const { service, client, booking, response } = setup();
    client.bookingResponse.findMany = vi.fn(async (args?: {
      where?: { expiresAt?: { lte?: Date; gt?: Date } };
      take?: number;
    }) => {
      if (args?.where?.expiresAt?.lte !== undefined) return [];
      return [
        { ...response, booking, bookingId: "bk-1" },
        { ...response, booking: { ...booking, id: "bk-2" }, bookingId: "bk-2" },
      ].slice(0, args?.take);
    });
    const listed = await service.listInbox({
      actorUserId: "owner-1",
      providerId: "prov-1",
      limit: 1,
    });
    expect(listed.items).toHaveLength(1);
  });

  it("still lists live inbox items after expiring an earlier overdue batch", async () => {
    const { service, client, booking, response } = setup({ expired: true });
    const live = {
      ...response,
      bookingId: "bk-live",
      expiresAt: hoursFrom(now, 24),
      booking: { ...booking, id: "bk-live" },
    };
    client.bookingResponse.findMany = vi.fn(async (args?: {
      where?: { expiresAt?: { lte?: Date; gt?: Date } };
    }) => {
      if (args?.where?.expiresAt?.lte !== undefined) {
        return [{ ...response, booking, bookingId: "bk-1" }];
      }
      return [live];
    });
    const listed = await service.listInbox({
      actorUserId: "owner-1",
      providerId: "prov-1",
      limit: 20,
    });
    expect(listed.items.map((item) => item.bookingId)).toEqual(["bk-live"]);
  });

  it("returns cancellation facts after reject", async () => {
    const { service } = setup();
    await service.reject({
      actorUserId: "owner-1",
      providerId: "prov-1",
      bookingId: "bk-1",
      version: 4,
      reasonCode: "PROVIDER_CANNOT_FULFILL",
      idempotencyKey: "idem-rej-doss",
    });
    const dossier = await service.peekDossier("bk-1");
    expect(dossier?.cancellation?.reasonCode).toBe("PROVIDER_CANNOT_FULFILL");
    expect(dossier?.response?.status).toBe("REJECTED");
  });

  it("denies accept when the pending response row is missing", async () => {
    const { service, client } = setup();
    client.bookingResponse.findUnique = vi.fn(async () => null) as never;
    await expect(
      service.accept({
        actorUserId: "owner-1",
        providerId: "prov-1",
        bookingId: "bk-1",
        version: 4,
        idempotencyKey: "idem-missing-resp",
      }),
    ).rejects.toMatchObject({ code: "TRANSITION_NOT_AVAILABLE" });
  });

  it("replays reject with the same idempotency key and denies a second reject", async () => {
    const { service, booking } = setup();
    const first = await service.reject({
      actorUserId: "owner-1",
      providerId: "prov-1",
      bookingId: "bk-1",
      version: 4,
      reasonCode: "PROVIDER_CANNOT_FULFILL",
      idempotencyKey: "idem-rej-1",
    });
    const replay = await service.reject({
      actorUserId: "owner-1",
      providerId: "prov-1",
      bookingId: "bk-1",
      version: 4,
      reasonCode: "PROVIDER_CANNOT_FULFILL",
      idempotencyKey: "idem-rej-1",
    });
    expect(replay).toEqual(first);
    await expect(
      service.reject({
        actorUserId: "owner-1",
        providerId: "prov-1",
        bookingId: "bk-1",
        version: 5,
        reasonCode: "PROVIDER_CANNOT_FULFILL",
        idempotencyKey: "idem-rej-2",
      }),
    ).rejects.toMatchObject({ code: "TRANSITION_NOT_AVAILABLE" });
    expect(booking.status).toBe("CANCELLED");
  });

  it("rejects provider cancel with an unknown reason or stale version", async () => {
    const { service } = setup({ status: "ACCEPTED" });
    await expect(
      service.providerCancel({
        actorUserId: "owner-1",
        providerId: "prov-1",
        bookingId: "bk-1",
        version: 1,
        reasonCode: "PROVIDER_UNABLE_TO_CONTINUE",
        idempotencyKey: "idem-pc-stale",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      service.providerCancel({
        actorUserId: "owner-1",
        providerId: "prov-1",
        bookingId: "bk-1",
        version: 4,
        reasonCode: "NOT_A_REASON",
        idempotencyKey: "idem-pc-reason",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  });

  it("rejects staff cancel with an unknown reason or stale version", async () => {
    const { service } = setup({ staff: true });
    await expect(
      service.staffCancel({
        actorUserId: "staff-1",
        bookingId: "bk-1",
        version: 1,
        reasonCode: "STAFF_OPS_CANCEL",
        idempotencyKey: "idem-st-stale",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      service.staffCancel({
        actorUserId: "staff-1",
        bookingId: "bk-1",
        version: 4,
        reasonCode: "NOT_A_REASON",
        idempotencyKey: "idem-st-reason",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  });

  it("returns null for an unknown dossier", async () => {
    const { service, client } = setup();
    client.booking.findUnique = vi.fn(async () => null) as never;
    await expect(service.peekDossier("missing")).resolves.toBeNull();
  });

  it("projects a dossier without quote, address, or response", async () => {
    const { service, booking, client } = setup();
    (booking as { address: unknown; priceBreakdown: unknown }).address = null;
    (booking as { priceBreakdown: unknown }).priceBreakdown = null;
    client.booking.findUnique = vi.fn(async () => ({
      ...booking,
      address: null,
      priceBreakdown: null,
      response: null,
      cancellation: null,
    })) as never;
    const dossier = await service.peekDossier("bk-1");
    expect(dossier?.quote).toBeNull();
    expect(dossier?.addressText).toBeNull();
    expect(dossier?.response).toBeNull();
    expect(dossier?.cancellation).toBeNull();
  });

  it("fail-closes expiry when the system reason is missing", async () => {
    const { service, client } = setup({ expired: true });
    client.cancellationReason.findUnique = vi.fn(async () => null) as never;
    await expect(
      service.listInbox({
        actorUserId: "owner-1",
        providerId: "prov-1",
        limit: 20,
      }),
    ).rejects.toMatchObject({ code: "DEPENDENCY_FAILURE" });
  });

  it("does not expire a non-confirmed booking", async () => {
    const { service, booking } = setup({ status: "ACCEPTED", expired: true });
    const listed = await service.listInbox({
      actorUserId: "owner-1",
      providerId: "prov-1",
      limit: 20,
    });
    expect(listed.items).toHaveLength(0);
    expect(booking.status).toBe("ACCEPTED");
  });

  it("rejects a second accept or reject after ACCEPTED and keeps status", async () => {
    const { service, booking } = setup();
    await service.accept({
      actorUserId: "owner-1",
      providerId: "prov-1",
      bookingId: "bk-1",
      version: 4,
      idempotencyKey: "idem-a1",
    });
    await expect(
      service.accept({
        actorUserId: "owner-1",
        providerId: "prov-1",
        bookingId: "bk-1",
        version: 5,
        idempotencyKey: "idem-a2",
      }),
    ).rejects.toMatchObject({ code: "TRANSITION_NOT_AVAILABLE" });
    await expect(
      service.reject({
        actorUserId: "owner-1",
        providerId: "prov-1",
        bookingId: "bk-1",
        version: 5,
        reasonCode: "PROVIDER_CANNOT_FULFILL",
        idempotencyKey: "idem-rej-after-accept",
      }),
    ).rejects.toMatchObject({ code: "TRANSITION_NOT_AVAILABLE" });
    expect(booking.status).toBe("ACCEPTED");
  });

  it("rejects a stale accept version", async () => {
    const { service } = setup();
    await expect(
      service.accept({
        actorUserId: "owner-1",
        providerId: "prov-1",
        bookingId: "bk-1",
        version: 1,
        idempotencyKey: "idem-stale",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("rejects an unknown reject reason", async () => {
    const { service } = setup();
    await expect(
      service.reject({
        actorUserId: "owner-1",
        providerId: "prov-1",
        bookingId: "bk-1",
        version: 4,
        reasonCode: "NOT_A_REASON",
        idempotencyKey: "idem-bad-reason",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  });

  it("rejects an inactive provider reject reason without changing status", async () => {
    const { service, client, booking } = setup();
    client.cancellationReason.findFirst = vi.fn(async () => null);
    await expect(
      service.reject({
        actorUserId: "owner-1",
        providerId: "prov-1",
        bookingId: "bk-1",
        version: 4,
        reasonCode: "PROVIDER_CANNOT_FULFILL",
        idempotencyKey: "idem-inactive-reason",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    expect(booking.status).toBe("CONFIRMED");
  });

  it("fail-closes customer cancel when the provider owner is missing", async () => {
    const { client } = setup();
    const resolveProviderOwnerUserId = vi.fn(async () => null);
    const service = new BookingResponseService({
      client,
      now: () => now,
      readResponseHours: async () => 24,
      assertActiveProviderManager: async (providerId, userId) => ({
        providerId,
        userId,
        level: "OWNER",
      }),
      resolveProviderOwnerUserId,
      isStaffAdmin: async () => false,
    });
    await expect(
      service.customerCancelConfirmed({
        customerUserId: "cust-1",
        bookingId: "bk-1",
        version: 4,
        reason: "CUSTOMER_CHANGED_MIND",
      }),
    ).rejects.toMatchObject({ code: "DEPENDENCY_FAILURE" });
    expect(resolveProviderOwnerUserId).toHaveBeenCalled();
  });

  it("does not cancel a draft through the confirmed-cancel hook", async () => {
    const { service } = setup({ status: "DRAFT" });
    await expect(
      service.customerCancelConfirmed({
        customerUserId: "cust-1",
        bookingId: "bk-1",
        version: 4,
        reason: "CUSTOMER_CHANGED_MIND",
      }),
    ).rejects.toMatchObject({ code: "TRANSITION_NOT_AVAILABLE" });
  });

  it("hides another customer's booking", async () => {
    const { service } = setup();
    await expect(
      service.customerCancelConfirmed({
        customerUserId: "other-cust",
        bookingId: "bk-1",
        version: 4,
        reason: "CUSTOMER_CHANGED_MIND",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("cancels an accepted booking as the customer", async () => {
    const { service, booking } = setup({ status: "ACCEPTED" });
    await service.customerCancelConfirmed({
      customerUserId: "cust-1",
      bookingId: "bk-1",
      version: 4,
      reason: "CUSTOMER_CHANGED_MIND",
    });
    expect(booking.status).toBe("CANCELLED");
  });

  it("cancels an accepted booking as staff", async () => {
    const { service, booking } = setup({ status: "ACCEPTED", staff: true });
    await service.staffCancel({
      actorUserId: "staff-1",
      bookingId: "bk-1",
      version: 4,
      reasonCode: "STAFF_OPS_CANCEL",
      idempotencyKey: "idem-st-acc",
    });
    expect(booking.status).toBe("CANCELLED");
  });

  it("fail-closes pending-response creation without a provider owner", async () => {
    const { client } = setup();
    (client.bookingResponse.findUnique as unknown as { mockResolvedValue: (value: null) => void }).mockResolvedValue(null);
    const service = new BookingResponseService({
      client,
      now: () => now,
      readResponseHours: async () => 24,
      assertActiveProviderManager: async (providerId, userId) => ({
        providerId,
        userId,
        level: "OWNER",
      }),
      resolveProviderOwnerUserId: async () => null,
      isStaffAdmin: async () => false,
    });
    await expect(
      service.ensurePendingResponse(client as never, {
        bookingId: "bk-1",
        providerId: "prov-1",
        countryId: "eg",
        customerUserId: "cust-1",
        locale: "AR",
      }),
    ).rejects.toMatchObject({ code: "DEPENDENCY_FAILURE" });
  });

  it("fails closed when the booking store is missing", async () => {
    const service = new BookingResponseService({
      now: () => now,
      readResponseHours: async () => 24,
      assertActiveProviderManager: async (providerId, userId) => ({
        providerId,
        userId,
        level: "OWNER",
      }),
      resolveProviderOwnerUserId: async () => "owner-1",
      isStaffAdmin: async () => false,
    });
    await expect(
      service.listInbox({ actorUserId: "owner-1", providerId: "prov-1", limit: 20 }),
    ).rejects.toMatchObject({ code: "DEPENDENCY_FAILURE" });
  });

  it("hides a booking that belongs to another provider", async () => {
    const { service } = setup();
    await expect(
      service.accept({
        actorUserId: "owner-1",
        providerId: "other-prov",
        bookingId: "bk-1",
        version: 4,
        idempotencyKey: "idem-wrong-prov",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("hides an unknown booking from the selected provider", async () => {
    const { service } = setup();
    await expect(
      service.accept({
        actorUserId: "owner-1",
        providerId: "prov-1",
        bookingId: "missing",
        version: 4,
        idempotencyKey: "idem-missing-bk",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("rejects provider cancel from DRAFT", async () => {
    const { service } = setup({ status: "DRAFT" });
    await expect(
      service.providerCancel({
        actorUserId: "owner-1",
        providerId: "prov-1",
        bookingId: "bk-1",
        version: 4,
        reasonCode: "PROVIDER_UNABLE_TO_CONTINUE",
        idempotencyKey: "idem-draft",
      }),
    ).rejects.toMatchObject({ code: "TRANSITION_NOT_AVAILABLE" });
  });

  it("swallows a concurrent expiry conflict", async () => {
    const { service, client } = setup({ expired: true });
    client.booking.updateMany = vi.fn(async () => ({ count: 0 }));
    await expect(
      service.listInbox({
        actorUserId: "owner-1",
        providerId: "prov-1",
        limit: 20,
      }),
    ).resolves.toMatchObject({ items: [] });
  });

  it("does not hide a non-conflict expiry failure", async () => {
    const { service, client } = setup({ expired: true });
    client.booking.updateMany = vi.fn(async () => {
      throw Object.assign(new Error("writer locked"), { code: "P2034" });
    });
    await expect(
      service.listInbox({
        actorUserId: "owner-1",
        providerId: "prov-1",
        limit: 20,
      }),
    ).rejects.toMatchObject({ code: "P2034" });
  });

  it("does not hide a non-error expiry failure", async () => {
    const { service, client } = setup({ expired: true });
    client.booking.updateMany = vi.fn(async () => {
      throw "writer-down";
    });
    await expect(
      service.listInbox({
        actorUserId: "owner-1",
        providerId: "prov-1",
        limit: 20,
      }),
    ).rejects.toBe("writer-down");
  });

  it("notifies the customer when staff cancel cannot resolve the owner", async () => {
    const { client } = setup({ staff: true });
    const service = new BookingResponseService({
      client,
      now: () => now,
      readResponseHours: async () => 24,
      assertActiveProviderManager: async (providerId, userId) => ({
        providerId,
        userId,
        level: "OWNER",
      }),
      resolveProviderOwnerUserId: async () => null,
      isStaffAdmin: async () => true,
    });
    await expect(
      service.staffCancel({
        actorUserId: "staff-1",
        bookingId: "bk-1",
        version: 4,
        reasonCode: "STAFF_OPS_CANCEL",
        idempotencyKey: "idem-st-ownerless",
      }),
    ).resolves.toMatchObject({ status: "CANCELLED" });
  });

  it("hides an unknown booking from staff cancel and dossier", async () => {
    const { service } = setup({ staff: true });
    await expect(
      service.staffCancel({
        actorUserId: "staff-1",
        bookingId: "missing",
        version: 4,
        reasonCode: "STAFF_OPS_CANCEL",
        idempotencyKey: "idem-st-missing",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      service.getStaffDossier({ actorUserId: "staff-1", bookingId: "missing" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      service.getProviderDossier({
        actorUserId: "owner-1",
        providerId: "prov-1",
        bookingId: "missing",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("rejects accept from a draft", async () => {
    const { service } = setup({ status: "DRAFT" });
    await expect(
      service.accept({
        actorUserId: "owner-1",
        providerId: "prov-1",
        bookingId: "bk-1",
        version: 4,
        idempotencyKey: "idem-draft-accept",
      }),
    ).rejects.toMatchObject({ code: "TRANSITION_NOT_AVAILABLE" });
  });

  it("rejects accept when the confirmed claim loses the race", async () => {
    const { service, client } = setup();
    client.booking.updateMany = vi.fn(async () => ({ count: 0 }));
    await expect(
      service.accept({
        actorUserId: "owner-1",
        providerId: "prov-1",
        bookingId: "bk-1",
        version: 4,
        idempotencyKey: "idem-race",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("rejects a cancelled booking that has no cancellation row", async () => {
    const { service } = setup({ status: "CANCELLED" });
    await expect(
      service.reject({
        actorUserId: "owner-1",
        providerId: "prov-1",
        bookingId: "bk-1",
        version: 4,
        reasonCode: "PROVIDER_CANNOT_FULFILL",
        idempotencyKey: "idem-rej-orphan",
      }),
    ).rejects.toMatchObject({ code: "TRANSITION_NOT_AVAILABLE" });
  });

  it("replays provider cancel with the same idempotency key only", async () => {
    const { service, booking } = setup({ status: "ACCEPTED" });
    const first = await service.providerCancel({
      actorUserId: "owner-1",
      providerId: "prov-1",
      bookingId: "bk-1",
      version: 4,
      reasonCode: "PROVIDER_UNABLE_TO_CONTINUE",
      idempotencyKey: "idem-pc-first",
    });
    const replay = await service.providerCancel({
      actorUserId: "owner-1",
      providerId: "prov-1",
      bookingId: "bk-1",
      version: 4,
      reasonCode: "PROVIDER_UNABLE_TO_CONTINUE",
      idempotencyKey: "idem-pc-first",
    });
    expect(replay).toEqual(first);
    await expect(
      service.providerCancel({
        actorUserId: "owner-1",
        providerId: "prov-1",
        bookingId: "bk-1",
        version: 5,
        reasonCode: "PROVIDER_UNABLE_TO_CONTINUE",
        idempotencyKey: "idem-pc-replay",
      }),
    ).rejects.toMatchObject({ code: "TRANSITION_NOT_AVAILABLE" });
    expect(booking.status).toBe("CANCELLED");
  });

  it("denies provider-cancel replay when the caller is no longer an active manager", async () => {
    const { client } = setup({ status: "ACCEPTED" });
    const allowed = new BookingResponseService({
      client,
      now: () => now,
      readResponseHours: async () => 24,
      assertActiveProviderManager: async (providerId, userId) => ({
        providerId,
        userId,
        level: "OWNER",
      }),
      resolveProviderOwnerUserId: async () => "owner-1",
      isStaffAdmin: async () => false,
    });
    await allowed.providerCancel({
      actorUserId: "owner-1",
      providerId: "prov-1",
      bookingId: "bk-1",
      version: 4,
      reasonCode: "PROVIDER_UNABLE_TO_CONTINUE",
      idempotencyKey: "idem-pc-authz",
    });
    const denied = new BookingResponseService({
      client,
      now: () => now,
      readResponseHours: async () => 24,
      assertActiveProviderManager: async () => {
        throw bookingError("FORBIDDEN");
      },
      resolveProviderOwnerUserId: async () => "owner-1",
      isStaffAdmin: async () => false,
    });
    await expect(
      denied.providerCancel({
        actorUserId: "owner-1",
        providerId: "prov-1",
        bookingId: "bk-1",
        version: 4,
        reasonCode: "PROVIDER_UNABLE_TO_CONTINUE",
        idempotencyKey: "idem-pc-authz",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("replays an accept when actor-command create hits a unique collision", async () => {
    const { service, client } = setup();
    const stored = {
      requestHash: hashBookingRequest({
        bookingId: "bk-1",
        version: 4,
        providerId: "prov-1",
      }),
      responseJson: {
        bookingId: "bk-1",
        status: "ACCEPTED",
        version: 5,
        responseStatus: "ACCEPTED",
      },
    };
    client.bookingActorCommand.findUnique = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValue(stored);
    client.bookingActorCommand.create = vi.fn(async () => {
      const error = new Error("Unique constraint failed");
      (error as Error & { code: string }).code = "P2002";
      throw error;
    });
    await expect(
      service.accept({
        actorUserId: "owner-1",
        providerId: "prov-1",
        bookingId: "bk-1",
        version: 4,
        idempotencyKey: "idem-race",
      }),
    ).resolves.toEqual(stored.responseJson);
  });

  it("rejects customer cancel with a stale version or unknown reason", async () => {
    const { service } = setup();
    await expect(
      service.customerCancelConfirmed({
        customerUserId: "cust-1",
        bookingId: "bk-1",
        version: 1,
        reason: "CUSTOMER_CHANGED_MIND",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      service.customerCancelConfirmed({
        customerUserId: "cust-1",
        bookingId: "bk-1",
        version: 4,
        reason: "NOT_A_REASON",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  });

  it("rejects staff cancel of a draft", async () => {
    const { service } = setup({ status: "DRAFT", staff: true });
    await expect(
      service.staffCancel({
        actorUserId: "staff-1",
        bookingId: "bk-1",
        version: 4,
        reasonCode: "STAFF_OPS_CANCEL",
        idempotencyKey: "idem-st-draft",
      }),
    ).rejects.toMatchObject({ code: "TRANSITION_NOT_AVAILABLE" });
  });

  it("projects decidedAt after the provider accepts", async () => {
    const { service } = setup();
    await service.accept({
      actorUserId: "owner-1",
      providerId: "prov-1",
      bookingId: "bk-1",
      version: 4,
      idempotencyKey: "idem-decided",
    });
    const dossier = await service.peekDossier("bk-1");
    expect(dossier?.response?.decidedAt).toBe(now.toISOString());
  });

  it("fails closed when the accept transition rule is missing", async () => {
    const { service, client } = setup();
    client.statusTransitionRule.findFirst = vi.fn(async () => null);
    await expect(
      service.accept({
        actorUserId: "owner-1",
        providerId: "prov-1",
        bookingId: "bk-1",
        version: 4,
        idempotencyKey: "idem-no-rule",
      }),
    ).rejects.toMatchObject({ code: "TRANSITION_NOT_AVAILABLE" });
  });
});
