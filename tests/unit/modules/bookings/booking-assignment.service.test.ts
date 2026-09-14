import { BookingAssignmentService, createBookingAssignmentService } from "#modules/bookings/bookings.assignment.service";
import {
  assignTeamBodySchema,
  assignWorkersBodySchema,
  assignmentProviderBookingParamsSchema,
} from "#modules/bookings/bookings.assignment.schema";
import {
  isExecutableCustomerTransition,
  P17_EXECUTABLE_TRANSITIONS,
} from "#modules/bookings/bookings.matrix";

function hoursFrom(now: Date, hours: number): Date {
  return new Date(now.getTime() + hours * 60 * 60 * 1000);
}

describe("R1-P17 booking assignment service", () => {
  const now = new Date("2026-09-14T10:00:00.000Z");

  function setup(options?: {
    readonly status?: "ACCEPTED" | "ASSIGNED" | "CONFIRMED" | "CANCELLED";
    readonly manager?: boolean;
    readonly hasActive?: boolean;
    readonly scheduleOk?: boolean;
    readonly overlap?: boolean;
  }) {
    const booking = {
      id: "bk-1",
      providerId: "prov-1",
      customerUserId: "cust-1",
      status: options?.status ?? "ACCEPTED",
      version: 5,
      locale: "AR" as const,
      startsAt: now,
      endsAt: hoursFrom(now, 3),
      crewPreference: "ANY",
      requiredTeamUnits: 1,
      teamId: "team-1",
    };
    const actorCommands = new Map<string, any>();
    const assignments: any[] = [];
    const members: any[] = [];
    const history: any[] = [];
    const intents: any[] = [];
    const statusHistory: any[] = [];
    let assignmentSeq = 0;

    if (options?.hasActive) {
      assignments.push({
        id: "asg-old",
        bookingId: "bk-1",
        providerId: "prov-1",
        status: "ACTIVE",
        source: "TEAM",
        teamId: "team-1",
        teamVersion: 1,
        startsAt: booking.startsAt,
        endsAt: booking.endsAt,
        assignedByUserId: "mgr-1",
        version: 1,
        members: [
          {
            workerId: "w-old",
            workerUserId: null,
            workerType: "CLEANING_STAFF",
            gender: "male",
            cleans: true,
            displayNameEn: "Old",
            displayNameAr: "Old",
            sortOrder: 0,
          },
        ],
      });
    }

    const tx = {
      booking: {
        findUnique: async () => booking,
        updateMany: async ({ data, where }: any) => {
          if (where.version !== undefined && where.version !== booking.version) {
            return { count: 0 };
          }
          if (where.status !== undefined && where.status !== booking.status) {
            return { count: 0 };
          }
          if (data.status !== undefined) {
            booking.status = data.status;
          }
          booking.version += 1;
          return { count: 1 };
        },
      },
      bookingAssignment: {
        findFirst: async ({ where }: any) => {
          if (where?.status === "ACTIVE") {
            return assignments.find((row) => row.status === "ACTIVE") ?? null;
          }
          return null;
        },
        findMany: async () => (options?.overlap ? [{ id: "conflict" }] : []),
        create: async ({ data, include }: any) => {
          assignmentSeq += 1;
          const created = {
            id: `asg-${assignmentSeq}`,
            ...data,
            members: (data.members?.create ?? []).map((member: any, index: number) => ({
              ...member,
              sortOrder: member.sortOrder ?? index,
            })),
          };
          assignments.push(created);
          if (include?.members) {
            members.push(...created.members);
          }
          return created;
        },
        update: async ({ where, data }: any) => {
          const row = assignments.find((item) => item.id === where.id);
          Object.assign(row, data);
          return row;
        },
      },
      bookingAssignmentHistory: {
        create: async ({ data }: any) => {
          const row = { id: `hist-${history.length + 1}`, createdAt: now, ...data };
          history.push(row);
          return row;
        },
        findMany: async () => history,
      },
      bookingAssignmentMember: {
        findMany: async ({ where }: any) => {
          const workerUserId = where?.workerUserId;
          return assignments
            .filter((row) => row.status === "ACTIVE")
            .flatMap((assignment) =>
              (assignment.members ?? [])
                .filter((member: any) =>
                  workerUserId === undefined
                    ? true
                    : member.workerUserId === workerUserId
                      || `user-${member.workerId}` === workerUserId,
                )
                .map((member: any) => ({
                  ...member,
                  workerUserId: member.workerUserId ?? `user-${member.workerId}`,
                  assignment: {
                    ...assignment,
                    booking: {
                      ...booking,
                      items: [{ catalogServiceCode: "SVC" }],
                      address: {
                        cityLabel: "Cairo",
                        districtLabel: "Maadi",
                      },
                    },
                  },
                })),
            );
        },
      },
      bookingStatusHistory: {
        create: async ({ data }: any) => {
          statusHistory.push(data);
          return data;
        },
      },
      bookingNotificationIntent: {
        upsert: async ({ create }: any) => {
          intents.push(create);
          return create;
        },
      },
      bookingActorCommand: {
        findUnique: async ({ where }: any) => {
          const key = `${where.actorUserId_commandType_idempotencyKey.actorUserId}:${where.actorUserId_commandType_idempotencyKey.commandType}:${where.actorUserId_commandType_idempotencyKey.idempotencyKey}`;
          return actorCommands.get(key) ?? null;
        },
        create: async ({ data }: any) => {
          const key = `${data.actorUserId}:${data.commandType}:${data.idempotencyKey}`;
          const row = { id: `cmd-${actorCommands.size + 1}`, ...data };
          actorCommands.set(key, row);
          return row;
        },
        update: async ({ where, data }: any) => {
          for (const [key, row] of actorCommands.entries()) {
            if (row.id === where.id) {
              Object.assign(row, data);
              actorCommands.set(key, row);
              return row;
            }
          }
          return null;
        },
      },
      statusTransitionRule: {
        findFirst: async () => ({ id: "rule-1" }),
      },
    };

    const client = {
      ...tx,
      $transaction: async (work: (inner: typeof tx) => Promise<unknown>) => work(tx),
      bookingActorCommand: tx.bookingActorCommand,
    };

    const workforce = {
      getBookingSafeTeamFacts: async () => ({
        providerId: "prov-1",
        teamId: "team-1",
        teamVersion: 2,
        active: true,
        members: [
          {
            workerId: "w1",
            gender: "male" as const,
            workerType: "CLEANING_STAFF" as const,
            cleans: true,
          },
        ],
      }),
      getAssignmentWorkerFacts: async ({ workerIds }: { workerIds: readonly string[] }) =>
        workerIds.map((workerId) => ({
          workerId,
          workerUserId: `user-${workerId}`,
          workerType: "CLEANING_STAFF" as const,
          gender: "male" as const,
          cleans: true,
          status: "ACTIVE" as const,
          displayNameEn: workerId,
          displayNameAr: workerId,
          profileComplete: true,
        })),
      coversWorkerBookingWindow: async () => options?.scheduleOk !== false,
    };

    const service = new BookingAssignmentService({
      client,
      now: () => now,
      assertActiveProviderManager: async (providerId, userId) => {
        if (options?.manager === false) {
          throw Object.assign(new Error("FORBIDDEN"), { code: "FORBIDDEN", statusCode: 403 });
        }
        return { providerId, userId, level: "OWNER" as const };
      },
      workforce,
    });

    return { service, booking, assignments, history, intents, statusHistory, actorCommands, client, workforce };
  }

  it("assigns team from ACCEPTED to ASSIGNED with intent", async () => {
    const { service, booking, history, intents, statusHistory } = setup();
    const result = await service.assignTeam({
      actorUserId: "mgr-1",
      providerId: "prov-1",
      bookingId: "bk-1",
      teamId: "team-1",
      expectedBookingVersion: 5,
      idempotencyKey: "idem-1",
      requestId: "req-1",
    });
    expect(result.status).toBe("ASSIGNED");
    expect(result.version).toBe(6);
    expect(booking.status).toBe("ASSIGNED");
    expect(history.some((row) => row.event === "CREATED")).toBe(true);
    expect(statusHistory[0]?.toStatus).toBe("ASSIGNED");
    expect(intents.some((row) => row.template === "BOOKING_ASSIGNED")).toBe(true);
  });

  it("replays identical idempotent assign", async () => {
    const { service } = setup();
    const input = {
      actorUserId: "mgr-1",
      providerId: "prov-1",
      bookingId: "bk-1",
      teamId: "team-1",
      expectedBookingVersion: 5,
      idempotencyKey: "idem-same",
      requestId: "req-1",
    };
    const first = await service.assignTeam(input);
    const second = await service.assignTeam(input);
    expect(second).toEqual(first);
  });

  it("rejects EX-01 team mismatch", async () => {
    const { service } = setup();
    await expect(
      service.assignTeam({
        actorUserId: "mgr-1",
        providerId: "prov-1",
        bookingId: "bk-1",
        teamId: "other-team",
        expectedBookingVersion: 5,
        idempotencyKey: "idem-2",
        requestId: "req-2",
      }),
    ).rejects.toMatchObject({ code: "BOOKING_ASSIGNMENT_TEAM_MISMATCH" });
  });

  it("rejects schedule unavailable", async () => {
    const { service } = setup({ scheduleOk: false });
    await expect(
      service.assignWorkers({
        actorUserId: "mgr-1",
        providerId: "prov-1",
        bookingId: "bk-1",
        workerIds: ["w1"],
        expectedBookingVersion: 5,
        idempotencyKey: "idem-3",
        requestId: "req-3",
      }),
    ).rejects.toMatchObject({ code: "BOOKING_ASSIGNMENT_SCHEDULE_UNAVAILABLE" });
  });

  it("rejects overlap conflicts", async () => {
    const { service } = setup({ overlap: true });
    await expect(
      service.assignWorkers({
        actorUserId: "mgr-1",
        providerId: "prov-1",
        bookingId: "bk-1",
        workerIds: ["w1"],
        expectedBookingVersion: 5,
        idempotencyKey: "idem-4",
        requestId: "req-4",
      }),
    ).rejects.toMatchObject({ code: "BOOKING_ASSIGNMENT_WORKER_CONFLICT" });
  });

  it("replaces ACTIVE assignment while staying ASSIGNED", async () => {
    const { service, booking, history, assignments } = setup({
      status: "ASSIGNED",
      hasActive: true,
    });
    const result = await service.replaceWorkers({
      actorUserId: "mgr-1",
      providerId: "prov-1",
      bookingId: "bk-1",
      workerIds: ["w-new"],
      expectedBookingVersion: 5,
      idempotencyKey: "idem-5",
      requestId: "req-5",
    });
    expect(result.status).toBe("ASSIGNED");
    expect(booking.status).toBe("ASSIGNED");
    expect(assignments.find((row) => row.id === "asg-old")?.status).toBe("SUPERSEDED");
    expect(history.some((row) => row.event === "SUPERSEDED")).toBe(true);
    expect(history.some((row) => row.event === "REPLACED")).toBe(true);
  });

  it("denies assign from CONFIRMED", async () => {
    const { service } = setup({ status: "CONFIRMED" });
    await expect(
      service.assignTeam({
        actorUserId: "mgr-1",
        providerId: "prov-1",
        bookingId: "bk-1",
        teamId: "team-1",
        expectedBookingVersion: 5,
        idempotencyKey: "idem-6",
        requestId: "req-6",
      }),
    ).rejects.toMatchObject({ code: "BOOKING_ASSIGNMENT_INVALID_STATE" });
  });

  it("assigns workers and returns current/history/worker visibility", async () => {
    const { service, booking } = setup();
    const assigned = await service.assignWorkers({
      actorUserId: "mgr-1",
      providerId: "prov-1",
      bookingId: "bk-1",
      workerIds: ["w1"],
      expectedBookingVersion: 5,
      idempotencyKey: "idem-workers-ok",
      requestId: "req-w",
    });
    expect(assigned.status).toBe("ASSIGNED");
    expect(booking.status).toBe("ASSIGNED");

    const current = await service.getCurrent({
      actorUserId: "mgr-1",
      providerId: "prov-1",
      bookingId: "bk-1",
    });
    expect(current.assignmentId).toBe(assigned.assignment.assignmentId);

    const history = await service.getHistory({
      actorUserId: "mgr-1",
      providerId: "prov-1",
      bookingId: "bk-1",
    });
    expect(history.length).toBeGreaterThan(0);

    const mine = await service.listWorkerAssignments({ workerUserId: "user-w1" });
    expect(mine.some((row) => row.bookingId === "bk-1")).toBe(true);
  });

  it("replaces team while ASSIGNED", async () => {
    const { service, booking } = setup({ status: "ASSIGNED", hasActive: true });
    const result = await service.replaceTeam({
      actorUserId: "mgr-1",
      providerId: "prov-1",
      bookingId: "bk-1",
      teamId: "team-1",
      expectedBookingVersion: 5,
      idempotencyKey: "idem-rt",
      requestId: "req-rt",
    });
    expect(result.status).toBe("ASSIGNED");
    expect(booking.status).toBe("ASSIGNED");
  });

  it("denies non-manager actors", async () => {
    const { service } = setup({ manager: false });
    await expect(
      service.assignTeam({
        actorUserId: "stranger",
        providerId: "prov-1",
        bookingId: "bk-1",
        teamId: "team-1",
        expectedBookingVersion: 5,
        idempotencyKey: "idem-forbid",
        requestId: "req-forbid",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects idempotency body mismatch", async () => {
    const { service } = setup();
    await service.assignTeam({
      actorUserId: "mgr-1",
      providerId: "prov-1",
      bookingId: "bk-1",
      teamId: "team-1",
      expectedBookingVersion: 5,
      idempotencyKey: "idem-mismatch",
      requestId: "req-a",
    });
    await expect(
      service.assignTeam({
        actorUserId: "mgr-1",
        providerId: "prov-1",
        bookingId: "bk-1",
        teamId: "team-1",
        expectedBookingVersion: 6,
        idempotencyKey: "idem-mismatch",
        requestId: "req-b",
      }),
    ).rejects.toMatchObject({ code: "BOOKING_ASSIGNMENT_IDEMPOTENCY_CONFLICT" });
  });

  it("covers factory schemas matrix peek and provider mismatch", async () => {
    expect(P17_EXECUTABLE_TRANSITIONS).toHaveLength(4);
    expect(isExecutableCustomerTransition("DRAFT", "AWAITING_DEPOSIT")).toBe(true);
    expect(
      assignmentProviderBookingParamsSchema.parse({
        providerId: "p",
        bookingId: "b",
      }),
    ).toEqual({ providerId: "p", bookingId: "b" });
    expect(
      assignTeamBodySchema.parse({ expectedBookingVersion: 1, teamId: "t" }).teamId,
    ).toBe("t");
    expect(
      assignWorkersBodySchema.parse({
        expectedBookingVersion: 1,
        workerIds: ["w1"],
      }).workerIds,
    ).toEqual(["w1"]);

    const { service, booking, client, workforce } = setup({
      status: "ASSIGNED",
      hasActive: true,
    });

    const rebuilt = createBookingAssignmentService({
      client,
      now: () => now,
      assertActiveProviderManager: async (providerId, userId) => ({
        providerId,
        userId,
        level: "OWNER" as const,
      }),
      workforce,
    });
    expect(rebuilt).toBeInstanceOf(BookingAssignmentService);
    expect(await service.peekCurrentSummary("bk-1")).toMatchObject({ status: "ACTIVE" });

    await expect(
      service.getCurrent({
        actorUserId: "mgr-1",
        providerId: "other-provider",
        bookingId: "bk-1",
      }),
    ).rejects.toMatchObject({ code: "BOOKING_ASSIGNMENT_FORBIDDEN" });

    await expect(
      service.assignWorkers({
        actorUserId: "mgr-1",
        providerId: "prov-1",
        bookingId: "bk-1",
        workerIds: ["w1"],
        expectedBookingVersion: 99,
        idempotencyKey: "idem-version",
        requestId: "req-version",
      }),
    ).rejects.toMatchObject({ code: "BOOKING_ASSIGNMENT_VERSION_CONFLICT" });

    expect(booking.providerId).toBe("prov-1");
  });
});
