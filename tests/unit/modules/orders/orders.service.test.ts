import { createOrdersService } from "#modules/orders/orders.service";
import { AppError } from "#shared/errors/app-error";
import {
  hashCompletionCode,
  issueCompletionCode,
} from "#modules/orders/domain/completion-code";

type Row = Record<string, any>;

function createMemoryStore() {
  const orders: Row[] = [];
  const history: Row[] = [];
  const codes: Row[] = [];
  const attempts: Row[] = [];
  const media: Row[] = [];
  const notes: Row[] = [];
  const events: Row[] = [];
  const intents: Row[] = [];
  const commands: Row[] = [];

  function matchWhere(row: Row, where: any): boolean {
    if (where === undefined) {
      return true;
    }
    for (const [key, value] of Object.entries(where)) {
      if (key === "AND") {
        if (!(value as any[]).every((part) => matchWhere(row, part))) {
          return false;
        }
        continue;
      }
      if (value !== null && typeof value === "object" && "in" in (value as object)) {
        if (!(value as { in: unknown[] }).in.includes(row[key])) {
          return false;
        }
        continue;
      }
      if (row[key] !== value) {
        return false;
      }
    }
    return true;
  }

  function delegate(table: Row[]) {
    return {
      findUnique: async ({ where }: any) => {
        if (where.orderId_actorUserId_commandType_idempotencyKey !== undefined) {
          const key = where.orderId_actorUserId_commandType_idempotencyKey;
          return (
            table.find(
              (row) =>
                row["orderId"] === key.orderId &&
                row["actorUserId"] === key.actorUserId &&
                row["commandType"] === key.commandType &&
                row["idempotencyKey"] === key.idempotencyKey,
            ) ?? null
          );
        }
        if (where.bookingId !== undefined) {
          return table.find((row) => row["bookingId"] === where.bookingId) ?? null;
        }
        if (where.id !== undefined) {
          return table.find((row) => row["id"] === where.id) ?? null;
        }
        return table.find((row) => matchWhere(row, where)) ?? null;
      },
      findFirst: async ({ where, orderBy }: any) => {
        let rows = table.filter((row) => matchWhere(row, where));
        if (orderBy?.createdAt === "asc") {
          rows = [...rows].sort(
            (a, b) => a["createdAt"].getTime() - b["createdAt"].getTime(),
          );
        }
        return rows[0] ?? null;
      },
      findMany: async ({ where, orderBy }: any) => {
        let rows = table.filter((row) => matchWhere(row, where));
        if (orderBy?.createdAt === "asc") {
          rows = [...rows].sort(
            (a, b) => a["createdAt"].getTime() - b["createdAt"].getTime(),
          );
        }
        return rows;
      },
      create: async ({ data }: any) => {
        const row = {
          ...data,
          createdAt: data["createdAt"] ?? new Date("2026-09-14T12:00:00.000Z"),
          updatedAt: data.updatedAt ?? new Date("2026-09-14T12:00:00.000Z"),
        };
        table.push(row);
        return row;
      },
      update: async ({ where, data }: any) => {
        const row = table.find((item) => item["id"] === where.id);
        if (row === undefined) {
          throw new Error("missing");
        }
        Object.assign(row, data);
        return row;
      },
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        for (const row of table) {
          if (matchWhere(row, where)) {
            Object.assign(row, data);
            count += 1;
          }
        }
        return { count };
      },
      upsert: async () => {
        throw new Error("unused");
      },
    };
  }

  const tx = {
    order: delegate(orders),
    orderStatusHistory: delegate(history),
    completionCode: delegate(codes),
    completionCodeAttempt: delegate(attempts),
    orderMedia: delegate(media),
    orderNote: delegate(notes),
    orderEvent: delegate(events),
    orderNotificationIntent: delegate(intents),
    orderActorCommand: delegate(commands),
  };

  return {
    ...tx,
    $transaction: async <T>(work: (inner: typeof tx) => Promise<T>) => work(tx),
    _tables: { orders, history, codes, attempts, media, notes, events, intents, commands },
  };
}

describe("R1-P18 orders service", () => {
  const now = new Date("2026-09-14T12:00:00.000Z");
  let clock = now;

  function setup(options?: {
    readonly bookingStatus?: string;
    readonly hasAssignment?: boolean;
    readonly workerUserId?: string | null;
    readonly managerUsers?: readonly string[];
    readonly staffUsers?: readonly string[];
  }) {
    clock = now;
    const store = createMemoryStore();
    const activation = {
      bookingId: "bk-1",
      status: options?.bookingStatus ?? "ASSIGNED",
      providerId: "prov-1",
      customerUserId: "cust-1",
      activeAssignment:
        options?.hasAssignment === false
          ? null
          : {
              assignmentId: "asg-1",
              members: [
                {
                  workerId: "w-1",
                  workerUserId:
                    options?.workerUserId === undefined
                      ? "worker-1"
                      : options.workerUserId,
                },
              ],
            },
    };
    const managers = new Set(options?.managerUsers ?? ["mgr-1"]);
    const staff = new Set(options?.staffUsers ?? ["staff-1"]);
    const service = createOrdersService({
      client: store,
      now: () => clock,
      completionCodePepper: "pepper",
      completionCodeTtlSeconds: 1800,
      completionCodeMaxAttempts: 2,
      readBookingActivation: async (bookingId) =>
        bookingId === "bk-1" ? activation : null,
      assertActiveProviderManager: async (providerId, userId) => {
        if (providerId !== "prov-1" || !managers.has(userId)) {
          throw new AppError({
            code: "FORBIDDEN",
            message: "forbidden",
            statusCode: 403,
          });
        }
        return { providerId, userId, level: "OWNER" as const };
      },
      isStaffAdmin: async (userId) => staff.has(userId),
    });
    return { service, store, activation };
  }

  async function seedAssigned(service: ReturnType<typeof createOrdersService>) {
    return service.ensureOrderForAssignedBooking({
      bookingId: "bk-1",
      actorUserId: "mgr-1",
    });
  }

  it("ensure-order creates ASSIGNED once and rejects missing assignment", async () => {
    const ok = setup();
    const first = await seedAssigned(ok.service);
    const second = await ok.service.ensureOrderForAssignedBooking({
      bookingId: "bk-1",
      actorUserId: "mgr-1",
    });
    expect(first.orderId).toBe(second.orderId);
    expect(first.status).toBe("ASSIGNED");
    expect(ok.store._tables.orders).toHaveLength(1);

    const bad = setup({ hasAssignment: false });
    await expect(
      bad.service.ensureOrderForAssignedBooking({
        bookingId: "bk-1",
        actorUserId: "mgr-1",
      }),
    ).rejects.toMatchObject({ code: "ORDER_ENSURE_REJECTED" });

    const notAssigned = setup({ bookingStatus: "ACCEPTED" });
    await expect(
      notAssigned.service.ensureOrderForAssignedBooking({
        bookingId: "bk-1",
        actorUserId: "mgr-1",
      }),
    ).rejects.toMatchObject({ code: "ORDER_ENSURE_REJECTED" });
  });

  it("allows legal transitions and rejects illegal jumps + unauthorized writers", async () => {
    const { service } = setup();
    const order = await seedAssigned(service);
    await expect(
      service.transitionInProgress({
        orderId: order.orderId,
        actorUserId: "worker-1",
        idempotencyKey: "bad-jump",
      }),
    ).rejects.toMatchObject({ code: "ORDER_TRANSITION_ILLEGAL" });

    await expect(
      service.transitionOnTheWay({
        orderId: order.orderId,
        actorUserId: "cust-1",
        idempotencyKey: "cust-write",
      }),
    ).rejects.toMatchObject({ code: "ORDER_FORBIDDEN" });

    const onWay = await service.transitionOnTheWay({
      orderId: order.orderId,
      actorUserId: "worker-1",
      idempotencyKey: "otw-1",
    });
    expect(onWay.status).toBe("ON_THE_WAY");
    const again = await service.transitionOnTheWay({
      orderId: order.orderId,
      actorUserId: "worker-1",
      idempotencyKey: "otw-1",
    });
    expect(again.status).toBe("ON_THE_WAY");

    await service.transitionInProgress({
      orderId: order.orderId,
      actorUserId: "mgr-1",
      idempotencyKey: "ip-1",
    });
    const ready = await service.transitionReadyToComplete({
      orderId: order.orderId,
      actorUserId: "mgr-1",
      idempotencyKey: "rtc-1",
    });
    expect(ready.status).toBe("READY_TO_COMPLETE");
    expect(ready.activeCompletionCode).not.toBeNull();
    expect(JSON.stringify(ready)).not.toMatch(/"completionCode"|plain/u);
  });

  it("completes with valid code; wrong/expired/locked fail; supervisor same proof; resend supersedes", async () => {
    const { service, store } = setup({
      completionMax: undefined,
    } as never);
    const patched = setup({ managerUsers: ["mgr-1"], workerUserId: "worker-1" });
    const order = await seedAssigned(patched.service);
    await patched.service.transitionOnTheWay({
      orderId: order.orderId,
      actorUserId: "worker-1",
      idempotencyKey: "a",
    });
    await patched.service.transitionInProgress({
      orderId: order.orderId,
      actorUserId: "worker-1",
      idempotencyKey: "b",
    });
    await patched.service.transitionReadyToComplete({
      orderId: order.orderId,
      actorUserId: "worker-1",
      idempotencyKey: "c",
    });
    const intent = patched.store._tables.intents.find(
      (row) => row["templateKey"] === "ORDER_READY_TO_COMPLETE",
    );
    const code = (intent!["payload"] as { completionCode: string }).completionCode;

    await expect(
      patched.service.complete({
        orderId: order.orderId,
        actorUserId: "mgr-1",
        code: "000000",
        idempotencyKey: "wrong-1",
      }),
    ).rejects.toMatchObject({ code: "ORDER_CODE_INVALID" });
    await expect(
      patched.service.complete({
        orderId: order.orderId,
        actorUserId: "mgr-1",
        code: "000001",
        idempotencyKey: "wrong-2",
      }),
    ).rejects.toMatchObject({ code: "ORDER_CODE_LOCKED" });

    await patched.service.resendCompletionCode({
      orderId: order.orderId,
      actorUserId: "mgr-1",
      idempotencyKey: "resend-1",
    });
    const resent = patched.store._tables.intents
      .filter((row) => row["templateKey"] === "ORDER_READY_TO_COMPLETE")
      .at(-1);
    const newCode = (resent!["payload"] as { completionCode: string }).completionCode;
    expect(newCode).not.toBe(code);
    await expect(
      patched.service.complete({
        orderId: order.orderId,
        actorUserId: "mgr-1",
        code,
        idempotencyKey: "old-code",
      }),
    ).rejects.toMatchObject({ code: "ORDER_CODE_INVALID" });

    const completed = await patched.service.complete({
      orderId: order.orderId,
      actorUserId: "mgr-1",
      code: newCode,
      idempotencyKey: "ok-complete",
    });
    expect(completed.status).toBe("COMPLETED");
    const idempotent = await patched.service.complete({
      orderId: order.orderId,
      actorUserId: "mgr-1",
      code: newCode,
      idempotencyKey: "ok-complete",
    });
    expect(idempotent.status).toBe("COMPLETED");
    await expect(
      patched.service.complete({
        orderId: order.orderId,
        actorUserId: "mgr-1",
        code: "999999",
        idempotencyKey: "ok-complete",
      }),
    ).rejects.toMatchObject({ code: "ORDER_IDEMPOTENCY_CONFLICT" });
    void service;
    void store;
    void issueCompletionCode;
    void hashCompletionCode;
  });

  it("expires code without completing", async () => {
    const { service, store } = setup();
    const order = await seedAssigned(service);
    await service.transitionOnTheWay({
      orderId: order.orderId,
      actorUserId: "worker-1",
      idempotencyKey: "e1",
    });
    await service.transitionInProgress({
      orderId: order.orderId,
      actorUserId: "worker-1",
      idempotencyKey: "e2",
    });
    await service.transitionReadyToComplete({
      orderId: order.orderId,
      actorUserId: "worker-1",
      idempotencyKey: "e3",
    });
    const code = (
      store._tables.intents.at(-1)!["payload"] as { completionCode: string }
    ).completionCode;
    clock = new Date(now.getTime() + 2_000_000);
    await expect(
      service.complete({
        orderId: order.orderId,
        actorUserId: "worker-1",
        code,
        idempotencyKey: "expired",
      }),
    ).rejects.toMatchObject({ code: "ORDER_CODE_EXPIRED" });
  });

  it("hides COMPLETION media from customer until COMPLETED; timeline redacts code", async () => {
    const { service, store } = setup();
    const order = await seedAssigned(service);
    await service.transitionOnTheWay({
      orderId: order.orderId,
      actorUserId: "worker-1",
      idempotencyKey: "m1",
    });
    await service.transitionInProgress({
      orderId: order.orderId,
      actorUserId: "worker-1",
      idempotencyKey: "m2",
    });
    await service.attachMedia({
      orderId: order.orderId,
      actorUserId: "worker-1",
      mediaFileId: "media-1",
      kind: "COMPLETION",
      idempotencyKey: "media",
    });
    const before = await service.listMedia({
      orderId: order.orderId,
      actorUserId: "cust-1",
    });
    expect(before).toHaveLength(0);
    await service.transitionReadyToComplete({
      orderId: order.orderId,
      actorUserId: "worker-1",
      idempotencyKey: "m3",
    });
    const code = (
      store._tables.intents.at(-1)!["payload"] as { completionCode: string }
    ).completionCode;
    await service.complete({
      orderId: order.orderId,
      actorUserId: "worker-1",
      code,
      idempotencyKey: "m4",
    });
    const after = await service.listMedia({
      orderId: order.orderId,
      actorUserId: "cust-1",
    });
    expect(after).toHaveLength(1);
    const timeline = await service.getTimeline({
      orderId: order.orderId,
      actorUserId: "cust-1",
    });
    expect(timeline.length).toBeGreaterThan(0);
    expect(JSON.stringify(timeline)).not.toContain(code);
    const staffTimeline = await service.getTimeline({
      orderId: order.orderId,
      actorUserId: "staff-1",
    });
    expect(staffTimeline.map((item) => item.type)).toEqual(
      timeline.map((item) => item.type),
    );
  });

  it("cancels non-terminal order on booking cancel and leaves COMPLETED alone", async () => {
    const { service } = setup();
    const order = await seedAssigned(service);
    const cancelled = await service.cancelOrderForBooking({
      bookingId: "bk-1",
      actorUserId: "cust-1",
    });
    expect(cancelled.cancelled).toBe(true);
    const dossier = await service.getOrder({
      orderId: order.orderId,
      actorUserId: "mgr-1",
    });
    expect(dossier.status).toBe("CANCELLED");

    const done = setup();
    const live = await seedAssigned(done.service);
    await done.service.transitionOnTheWay({
      orderId: live.orderId,
      actorUserId: "worker-1",
      idempotencyKey: "c1",
    });
    await done.service.transitionInProgress({
      orderId: live.orderId,
      actorUserId: "worker-1",
      idempotencyKey: "c2",
    });
    await done.service.transitionReadyToComplete({
      orderId: live.orderId,
      actorUserId: "worker-1",
      idempotencyKey: "c3",
    });
    const code = (
      done.store._tables.intents.at(-1)!["payload"] as { completionCode: string }
    ).completionCode;
    await done.service.complete({
      orderId: live.orderId,
      actorUserId: "worker-1",
      code,
      idempotencyKey: "c4",
    });
    const late = await done.service.cancelOrderForBooking({
      bookingId: "bk-1",
      actorUserId: "cust-1",
    });
    expect(late.cancelled).toBe(false);
    const still = await done.service.getOrder({
      orderId: live.orderId,
      actorUserId: "mgr-1",
    });
    expect(still.status).toBe("COMPLETED");
  });

  it("ensures by booking for entitled readers and rejects strangers", async () => {
    const { service, store } = setup();
    await expect(
      service.getOrEnsureByBooking({
        bookingId: "bk-1",
        actorUserId: "stranger",
      }),
    ).rejects.toMatchObject({ code: "ORDER_FORBIDDEN" });
    expect(store._tables.orders).toHaveLength(0);

    const ensured = await service.getOrEnsureByBooking({
      bookingId: "bk-1",
      actorUserId: "worker-1",
    });
    expect(ensured.status).toBe("ASSIGNED");
    const again = await service.getOrEnsureByBooking({
      bookingId: "bk-1",
      actorUserId: "cust-1",
    });
    expect(again.orderId).toBe(ensured.orderId);
    await expect(
      service.getOrEnsureByBooking({
        bookingId: "bk-1",
        actorUserId: "stranger",
      }),
    ).rejects.toMatchObject({ code: "ORDER_FORBIDDEN" });
    await service.addNote({
      orderId: ensured.orderId,
      actorUserId: "worker-1",
      body: "arrived",
      idempotencyKey: "note-1",
    });
    const noOrder = await service.cancelOrderForBooking({
      bookingId: "missing",
    });
    expect(noOrder.cancelled).toBe(false);
  });

  it("loses concurrent forward transition via status CAS", async () => {
    const { service, store } = setup();
    const live = await service.ensureOrderForAssignedBooking({
      bookingId: "bk-1",
      actorUserId: "worker-1",
    });
    await service.transitionOnTheWay({
      orderId: live.orderId,
      actorUserId: "worker-1",
      idempotencyKey: "cas-1",
    });
    const originalUpdateMany = store.order.updateMany.bind(store.order);
    store.order.updateMany = async (args: any) => {
      if (args.where?.status === "ON_THE_WAY") {
        // Concurrent writer already advanced the order.
        store._tables.orders[0]!["status"] = "IN_PROGRESS";
      }
      return originalUpdateMany(args);
    };
    await expect(
      service.transitionInProgress({
        orderId: live.orderId,
        actorUserId: "worker-1",
        idempotencyKey: "cas-2",
      }),
    ).rejects.toMatchObject({ code: "ORDER_TRANSITION_ILLEGAL" });
  });

  it("classifies actors when booking activation facts disappear", async () => {
    const { service, store } = setup();
    const live = await service.ensureOrderForAssignedBooking({
      bookingId: "bk-1",
      actorUserId: "worker-1",
    });
    const orphaned = createOrdersService({
      client: store,
      now: () => new Date("2026-09-14T12:00:00.000Z"),
      completionCodePepper: "pepper",
      readBookingActivation: async () => null,
      assertActiveProviderManager: async () => {
        throw new AppError({
          code: "FORBIDDEN",
          message: "forbidden",
          statusCode: 403,
        });
      },
      isStaffAdmin: async () => false,
    });
    await expect(
      orphaned.getOrder({
        orderId: live.orderId,
        actorUserId: "cust-1",
      }),
    ).resolves.toMatchObject({ orderId: live.orderId });
    await expect(
      orphaned.getOrder({
        orderId: live.orderId,
        actorUserId: "stranger",
      }),
    ).rejects.toMatchObject({ code: "ORDER_FORBIDDEN" });
  });
});
