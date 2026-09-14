/**
 * R1-P17 booking assignment application service.
 * Owns assign/replace/current/history/worker-visibility; intents only (EX-02).
 */

import { createHash } from "node:crypto";

import type {
  BookingAssignmentWorkerFact,
  BookingSafeTeamFacts,
  ProviderWorkforcePublicReader,
} from "#modules/providers/providers.public";

import {
  assertTeamMatchesBooking,
  evaluateAssignmentMembers,
  type AssignmentCrewPreference,
  type AssignmentMemberInput,
} from "./bookings.assignment.policy.js";
import { bookingAssignmentError } from "./bookings.errors.js";
import type { BookingManagerLevel } from "./bookings.response.service.js";

type StoreDelegate = {
  findUnique: (args: unknown) => Promise<any>;
  findFirst: (args: unknown) => Promise<any>;
  findMany: (args: unknown) => Promise<any[]>;
  create: (args: unknown) => Promise<any>;
  update: (args: unknown) => Promise<any>;
  updateMany: (args: unknown) => Promise<{ count: number }>;
  upsert: (args: unknown) => Promise<any>;
};

type BookingTx = {
  booking: StoreDelegate;
  bookingAssignment: StoreDelegate;
  bookingAssignmentMember: StoreDelegate;
  bookingAssignmentHistory: StoreDelegate;
  bookingStatusHistory: StoreDelegate;
  bookingNotificationIntent: StoreDelegate;
  bookingActorCommand: StoreDelegate;
  statusTransitionRule: StoreDelegate;
};

type BookingStore = BookingTx & {
  $transaction: <T>(work: (tx: BookingTx) => Promise<T>) => Promise<T>;
};

export interface BookingAssignmentServiceDependencies {
  readonly client?: unknown;
  readonly now: () => Date;
  readonly assertActiveProviderManager: (
    providerId: string,
    userId: string,
  ) => Promise<{
    readonly providerId: string;
    readonly userId: string;
    readonly level: BookingManagerLevel;
  }>;
  readonly workforce: Pick<
    ProviderWorkforcePublicReader,
    "getBookingSafeTeamFacts" | "getAssignmentWorkerFacts" | "coversWorkerBookingWindow"
  >;
}

export interface AssignmentMemberSummary {
  readonly workerId: string;
  readonly workerUserId: string | null;
  readonly workerType: string;
  readonly gender: string;
  readonly cleans: boolean;
  readonly displayNameEn: string;
  readonly displayNameAr: string;
  readonly sortOrder: number;
}

export interface AssignmentSummary {
  readonly assignmentId: string;
  readonly bookingId: string;
  readonly providerId: string;
  readonly status: "ACTIVE" | "SUPERSEDED";
  readonly source: "TEAM" | "WORKERS";
  readonly teamId: string | null;
  readonly teamVersion: number | null;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly version: number;
  readonly members: readonly AssignmentMemberSummary[];
}

export interface AssignmentMutationResult {
  readonly bookingId: string;
  readonly status: "ASSIGNED";
  readonly version: number;
  readonly assignment: AssignmentSummary;
}

export interface WorkerAssignmentItem {
  readonly bookingId: string;
  readonly status: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly providerId: string;
  readonly assignmentId: string;
  readonly serviceLabel: string | null;
  readonly addressCity: string | null;
  readonly addressDistrict: string | null;
  readonly coMembers: readonly {
    readonly workerId: string;
    readonly displayNameEn: string;
    readonly displayNameAr: string;
    readonly cleans: boolean;
  }[];
}

function clientOf(deps: BookingAssignmentServiceDependencies): BookingStore {
  return deps.client as BookingStore;
}

function failWhen(condition: boolean, error: () => Error): asserts condition is false {
  if (condition) {
    throw error();
  }
}

function requirePresent<T>(value: T | null | undefined, error: () => Error): T {
  if (value === null || value === undefined) {
    throw error();
  }
  return value;
}

function isUniqueCollision(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return false;
  }
  return (error as { code?: string }).code === "P2002";
}

function requestHashOf(request: unknown): string {
  return createHash("sha256").update(JSON.stringify(request)).digest("hex");
}

function shaIdempotency(parts: readonly string[]): string {
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 64);
}

function policyToError(
  code:
    | "BOOKING_ASSIGNMENT_COMPOSITION_INVALID"
    | "BOOKING_ASSIGNMENT_ESCORT_CANNOT_CLEAN"
    | "BOOKING_ASSIGNMENT_CREW_MISMATCH"
    | "BOOKING_ASSIGNMENT_TEAM_MISMATCH"
    | "BOOKING_ASSIGNMENT_DUPLICATE_WORKER"
    | "BOOKING_ASSIGNMENT_INSUFFICIENT_UNITS",
): never {
  throw bookingAssignmentError(code);
}

function mapTeamMembersToPolicy(
  team: BookingSafeTeamFacts,
): AssignmentMemberInput[] {
  return team.members.map((member) => ({
    workerId: member.workerId,
    workerType: member.workerType,
    gender: member.gender === "male" || member.gender === "female"
      ? member.gender
      : "other_or_unspecified",
    cleans: member.cleans,
  }));
}

function mapWorkerFactsToPolicy(
  facts: readonly BookingAssignmentWorkerFact[],
): AssignmentMemberInput[] {
  return facts.map((fact) => ({
    workerId: fact.workerId,
    workerType: fact.workerType,
    gender: fact.gender,
    cleans: fact.cleans,
  }));
}

function summarizeAssignment(row: {
  readonly id: string;
  readonly bookingId: string;
  readonly providerId: string;
  readonly status: "ACTIVE" | "SUPERSEDED";
  readonly source: "TEAM" | "WORKERS";
  readonly teamId: string | null;
  readonly teamVersion: number | null;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly version: number;
  readonly members: readonly {
    readonly workerId: string;
    readonly workerUserId: string | null;
    readonly workerType: string;
    readonly gender: string;
    readonly cleans: boolean;
    readonly displayNameEn: string;
    readonly displayNameAr: string;
    readonly sortOrder: number;
  }[];
}): AssignmentSummary {
  return {
    assignmentId: row.id,
    bookingId: row.bookingId,
    providerId: row.providerId,
    status: row.status,
    source: row.source,
    teamId: row.teamId,
    teamVersion: row.teamVersion,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    version: row.version,
    members: row.members
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((member) => ({
        workerId: member.workerId,
        workerUserId: member.workerUserId,
        workerType: member.workerType,
        gender: member.gender,
        cleans: member.cleans,
        displayNameEn: member.displayNameEn,
        displayNameAr: member.displayNameAr,
        sortOrder: member.sortOrder,
      })),
  };
}

/**
 * @desc Booking assignment commands and reads for R1-P17.
 * @access Bookings application
 */
export class BookingAssignmentService {
  public constructor(private readonly deps: BookingAssignmentServiceDependencies) {}

  public async assignTeam(input: {
    readonly actorUserId: string;
    readonly providerId: string;
    readonly bookingId: string;
    readonly teamId: string;
    readonly expectedBookingVersion: number;
    readonly idempotencyKey: string;
    readonly requestId: string;
  }): Promise<AssignmentMutationResult> {
    await this.deps.assertActiveProviderManager(input.providerId, input.actorUserId);
    return this.withActorIdempotency({
      actorUserId: input.actorUserId,
      commandType: "ASSIGN_TEAM",
      idempotencyKey: input.idempotencyKey,
      bookingId: input.bookingId,
      request: {
        bookingId: input.bookingId,
        providerId: input.providerId,
        teamId: input.teamId,
        expectedBookingVersion: input.expectedBookingVersion,
      },
      run: async (tx) =>
        this.executeAssign(tx, {
          ...input,
          mode: "ASSIGN",
          source: "TEAM",
          workerIds: [],
        }),
    });
  }

  public async assignWorkers(input: {
    readonly actorUserId: string;
    readonly providerId: string;
    readonly bookingId: string;
    readonly workerIds: readonly string[];
    readonly expectedBookingVersion: number;
    readonly idempotencyKey: string;
    readonly requestId: string;
  }): Promise<AssignmentMutationResult> {
    await this.deps.assertActiveProviderManager(input.providerId, input.actorUserId);
    return this.withActorIdempotency({
      actorUserId: input.actorUserId,
      commandType: "ASSIGN_WORKERS",
      idempotencyKey: input.idempotencyKey,
      bookingId: input.bookingId,
      request: {
        bookingId: input.bookingId,
        providerId: input.providerId,
        workerIds: input.workerIds,
        expectedBookingVersion: input.expectedBookingVersion,
      },
      run: async (tx) =>
        this.executeAssign(tx, {
          ...input,
          mode: "ASSIGN",
          source: "WORKERS",
          teamId: null,
        }),
    });
  }

  public async replaceTeam(input: {
    readonly actorUserId: string;
    readonly providerId: string;
    readonly bookingId: string;
    readonly teamId: string;
    readonly expectedBookingVersion: number;
    readonly idempotencyKey: string;
    readonly requestId: string;
  }): Promise<AssignmentMutationResult> {
    await this.deps.assertActiveProviderManager(input.providerId, input.actorUserId);
    return this.withActorIdempotency({
      actorUserId: input.actorUserId,
      commandType: "REPLACE_TEAM",
      idempotencyKey: input.idempotencyKey,
      bookingId: input.bookingId,
      request: {
        bookingId: input.bookingId,
        providerId: input.providerId,
        teamId: input.teamId,
        expectedBookingVersion: input.expectedBookingVersion,
      },
      run: async (tx) =>
        this.executeAssign(tx, {
          ...input,
          mode: "REPLACE",
          source: "TEAM",
          workerIds: [],
        }),
    });
  }

  public async replaceWorkers(input: {
    readonly actorUserId: string;
    readonly providerId: string;
    readonly bookingId: string;
    readonly workerIds: readonly string[];
    readonly expectedBookingVersion: number;
    readonly idempotencyKey: string;
    readonly requestId: string;
  }): Promise<AssignmentMutationResult> {
    await this.deps.assertActiveProviderManager(input.providerId, input.actorUserId);
    return this.withActorIdempotency({
      actorUserId: input.actorUserId,
      commandType: "REPLACE_WORKERS",
      idempotencyKey: input.idempotencyKey,
      bookingId: input.bookingId,
      request: {
        bookingId: input.bookingId,
        providerId: input.providerId,
        workerIds: input.workerIds,
        expectedBookingVersion: input.expectedBookingVersion,
      },
      run: async (tx) =>
        this.executeAssign(tx, {
          ...input,
          mode: "REPLACE",
          source: "WORKERS",
          teamId: null,
        }),
    });
  }

  public async getCurrent(input: {
    readonly actorUserId: string;
    readonly providerId: string;
    readonly bookingId: string;
  }): Promise<AssignmentSummary> {
    await this.deps.assertActiveProviderManager(input.providerId, input.actorUserId);
    const db = clientOf(this.deps);
    await this.requireProviderBooking(db, input.bookingId, input.providerId);
    const row = await db.bookingAssignment.findFirst({
      where: { bookingId: input.bookingId, status: "ACTIVE" },
      include: { members: true },
    });
    failWhen(row === null, () => bookingAssignmentError("BOOKING_ASSIGNMENT_NOT_FOUND"));
    return summarizeAssignment(row);
  }

  public async getHistory(input: {
    readonly actorUserId: string;
    readonly providerId: string;
    readonly bookingId: string;
  }): Promise<
    readonly {
      readonly id: string;
      readonly assignmentId: string;
      readonly event: string;
      readonly actorUserId: string;
      readonly reasonCode: string;
      readonly reasonText: string | null;
      readonly safeBefore: unknown;
      readonly safeAfter: unknown;
      readonly createdAt: string;
    }[]
  > {
    await this.deps.assertActiveProviderManager(input.providerId, input.actorUserId);
    const db = clientOf(this.deps);
    await this.requireProviderBooking(db, input.bookingId, input.providerId);
    const rows = await db.bookingAssignmentHistory.findMany({
      where: { bookingId: input.bookingId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((row) => ({
      id: row.id,
      assignmentId: row.assignmentId,
      event: row.event,
      actorUserId: row.actorUserId,
      reasonCode: row.reasonCode,
      reasonText: row.reasonText,
      safeBefore: row.safeBefore,
      safeAfter: row.safeAfter,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  /**
   * @desc Optional dossier assignment summary (null when none ACTIVE).
   * @access Bookings application
   */
  public async peekCurrentSummary(bookingId: string): Promise<AssignmentSummary | null> {
    const db = clientOf(this.deps);
    const row = await db.bookingAssignment.findFirst({
      where: { bookingId, status: "ACTIVE" },
      include: { members: true },
    });
    if (row === null) {
      return null;
    }
    return summarizeAssignment(row);
  }

  public async listWorkerAssignments(input: {
    readonly workerUserId: string;
  }): Promise<readonly WorkerAssignmentItem[]> {
    const db = clientOf(this.deps);
    const memberships = await db.bookingAssignmentMember.findMany({
      where: {
        workerUserId: input.workerUserId,
        assignment: { status: "ACTIVE" },
      },
      include: {
        assignment: {
          include: {
            members: true,
            booking: {
              include: {
                items: true,
                address: true,
              },
            },
          },
        },
      },
    });
    return memberships
      .filter((row) => row.assignment.booking.status !== "CANCELLED")
      .map((row) => {
        const booking = row.assignment.booking;
        const item = Array.isArray(booking.items) ? booking.items[0] : null;
        return {
          bookingId: booking.id,
          status: booking.status,
          startsAt: booking.startsAt.toISOString(),
          endsAt: booking.endsAt.toISOString(),
          providerId: booking.providerId,
          assignmentId: row.assignment.id,
          serviceLabel:
            item === null || item === undefined
              ? null
              : String(item.catalogServiceCode ?? null),
          addressCity: booking.address?.cityLabel ?? null,
          addressDistrict: booking.address?.districtLabel ?? null,
          coMembers: row.assignment.members.map(
            (member: {
              workerId: string;
              displayNameEn: string;
              displayNameAr: string;
              cleans: boolean;
            }) => ({
              workerId: member.workerId,
              displayNameEn: member.displayNameEn,
              displayNameAr: member.displayNameAr,
              cleans: member.cleans,
            }),
          ),
        };
      });
  }

  private async executeAssign(
    tx: BookingTx,
    input: {
      readonly actorUserId: string;
      readonly providerId: string;
      readonly bookingId: string;
      readonly teamId: string | null;
      readonly workerIds: readonly string[];
      readonly expectedBookingVersion: number;
      readonly requestId: string;
      readonly mode: "ASSIGN" | "REPLACE";
      readonly source: "TEAM" | "WORKERS";
    },
  ): Promise<AssignmentMutationResult> {
    await this.deps.assertActiveProviderManager(input.providerId, input.actorUserId);
    const booking = await this.requireProviderBooking(tx, input.bookingId, input.providerId);
    failWhen(
      booking.version !== input.expectedBookingVersion,
      () => bookingAssignmentError("BOOKING_ASSIGNMENT_VERSION_CONFLICT"),
    );

    const active = await tx.bookingAssignment.findFirst({
      where: { bookingId: input.bookingId, status: "ACTIVE" },
      include: { members: true },
    });

    if (input.mode === "ASSIGN") {
      failWhen(booking.status !== "ACCEPTED", () =>
        bookingAssignmentError("BOOKING_ASSIGNMENT_INVALID_STATE"),
      );
      failWhen(active !== null, () =>
        bookingAssignmentError("BOOKING_ASSIGNMENT_INVALID_STATE"),
      );
    } else {
      failWhen(booking.status !== "ASSIGNED", () =>
        bookingAssignmentError("BOOKING_ASSIGNMENT_INVALID_STATE"),
      );
      failWhen(active === null, () =>
        bookingAssignmentError("BOOKING_ASSIGNMENT_NOT_FOUND"),
      );
    }

    const resolved = await this.resolveMembers(input, booking);
    const policy = evaluateAssignmentMembers({
      members: resolved.policyMembers,
      crewPreference: booking.crewPreference as AssignmentCrewPreference,
      source: input.source,
      requiredTeamUnits: booking.requiredTeamUnits,
    });
    if (!policy.ok) {
      policyToError(policy.code);
    }

    await this.assertSchedulesAndOverlaps(tx, {
      providerId: input.providerId,
      bookingId: input.bookingId,
      startsAt: booking.startsAt,
      endsAt: booking.endsAt,
      workerIds: resolved.snapshots.map((member) => member.workerId),
    });

    const now = this.deps.now();
    let priorSummary: AssignmentSummary | null = null;
    if (active !== null) {
      priorSummary = summarizeAssignment(active);
      await tx.bookingAssignment.update({
        where: { id: active.id },
        data: { status: "SUPERSEDED", supersededAt: now },
      });
      await tx.bookingAssignmentHistory.create({
        data: {
          bookingId: input.bookingId,
          assignmentId: active.id,
          event: "SUPERSEDED",
          actorUserId: input.actorUserId,
          reasonCode: "PROVIDER_REPLACE",
          reasonText: null,
          safeBefore: priorSummary,
          safeAfter: { status: "SUPERSEDED" },
          requestId: input.requestId,
          operationKey: shaIdempotency([
            "SUPERSEDE",
            input.bookingId,
            active.id,
            input.requestId,
          ]),
        },
      });
    }

    if (booking.status === "ACCEPTED") {
      await this.requireRule(tx, "PROVIDER", "ACCEPTED", "ASSIGNED");
      const claimed = await tx.booking.updateMany({
        where: {
          id: input.bookingId,
          status: "ACCEPTED",
          version: input.expectedBookingVersion,
        },
        data: { status: "ASSIGNED", version: { increment: 1 } },
      });
      failWhen(claimed.count !== 1, () =>
        bookingAssignmentError("BOOKING_ASSIGNMENT_VERSION_CONFLICT"),
      );
      await tx.bookingStatusHistory.create({
        data: {
          bookingId: input.bookingId,
          fromStatus: "ACCEPTED",
          toStatus: "ASSIGNED",
          actorUserId: input.actorUserId,
          actorType: "PROVIDER",
          reasonCode: "PROVIDER_ASSIGNED",
        },
      });
    } else {
      const claimed = await tx.booking.updateMany({
        where: {
          id: input.bookingId,
          status: "ASSIGNED",
          version: input.expectedBookingVersion,
        },
        data: { version: { increment: 1 } },
      });
      failWhen(claimed.count !== 1, () =>
        bookingAssignmentError("BOOKING_ASSIGNMENT_VERSION_CONFLICT"),
      );
    }

    const assignment = await tx.bookingAssignment.create({
      data: {
        bookingId: input.bookingId,
        providerId: input.providerId,
        status: "ACTIVE",
        source: input.source,
        teamId: resolved.teamId,
        teamVersion: resolved.teamVersion,
        startsAt: booking.startsAt,
        endsAt: booking.endsAt,
        assignedByUserId: input.actorUserId,
        version: 1,
        members: {
          create: resolved.snapshots.map((member, index) => ({
            workerId: member.workerId,
            workerUserId: member.workerUserId,
            workerType: member.workerType,
            gender: member.gender,
            cleans: member.cleans,
            displayNameEn: member.displayNameEn,
            displayNameAr: member.displayNameAr,
            sortOrder: index,
          })),
        },
      },
      include: { members: true },
    });

    const summary = summarizeAssignment(assignment);
    const historyEvent = input.mode === "REPLACE" ? "REPLACED" : "CREATED";
    await tx.bookingAssignmentHistory.create({
      data: {
        bookingId: input.bookingId,
        assignmentId: assignment.id,
        event: historyEvent,
        actorUserId: input.actorUserId,
        reasonCode: input.mode === "REPLACE" ? "PROVIDER_REPLACE" : "INITIAL_ASSIGN",
        reasonText: null,
        safeBefore: priorSummary,
        safeAfter: summary,
        requestId: input.requestId,
        operationKey: shaIdempotency([
          historyEvent,
          input.bookingId,
          assignment.id,
          input.requestId,
        ]),
      },
    });

    const template =
      input.mode === "REPLACE" ? "BOOKING_ASSIGNMENT_REPLACED" : "BOOKING_ASSIGNED";
    await this.insertIntent(tx, {
      bookingId: input.bookingId,
      template,
      recipientUserId: booking.customerUserId,
      locale: booking.locale,
      idempotencyKey: shaIdempotency([template, input.bookingId, "customer", assignment.id]),
    });
    for (const member of resolved.snapshots) {
      if (member.workerUserId === null) {
        continue;
      }
      await this.insertIntent(tx, {
        bookingId: input.bookingId,
        template,
        recipientUserId: member.workerUserId,
        locale: booking.locale,
        idempotencyKey: shaIdempotency([
          template,
          input.bookingId,
          "worker",
          member.workerUserId,
          assignment.id,
        ]),
      });
    }

    return {
      bookingId: input.bookingId,
      status: "ASSIGNED",
      version: input.expectedBookingVersion + 1,
      assignment: summary,
    };
  }

  private async resolveMembers(
    input: {
      readonly providerId: string;
      readonly teamId: string | null;
      readonly workerIds: readonly string[];
      readonly source: "TEAM" | "WORKERS";
    },
    booking: {
      readonly teamId: string | null;
    },
  ): Promise<{
    readonly policyMembers: AssignmentMemberInput[];
    readonly snapshots: readonly {
      readonly workerId: string;
      readonly workerUserId: string | null;
      readonly workerType: string;
      readonly gender: string;
      readonly cleans: boolean;
      readonly displayNameEn: string;
      readonly displayNameAr: string;
    }[];
    readonly teamId: string | null;
    readonly teamVersion: number | null;
  }> {
    if (input.source === "TEAM") {
      failWhen(input.teamId === null, () =>
        bookingAssignmentError("VALIDATION_FAILED", { field: "teamId" }),
      );
      const teamMatch = assertTeamMatchesBooking(input.teamId!, booking.teamId);
      if (!teamMatch.ok) {
        policyToError(teamMatch.code);
      }
      const team = requirePresent(
        await this.deps.workforce.getBookingSafeTeamFacts({
          providerId: input.providerId,
          teamId: input.teamId!,
        }),
        () => bookingAssignmentError("BOOKING_ASSIGNMENT_COMPOSITION_INVALID"),
      );
      failWhen(!team.active, () =>
        bookingAssignmentError("BOOKING_ASSIGNMENT_COMPOSITION_INVALID"),
      );
      const policyMembers = mapTeamMembersToPolicy(team);
      const enrichment =
        (await this.deps.workforce.getAssignmentWorkerFacts({
          providerId: input.providerId,
          workerIds: team.members.map((member) => member.workerId),
        })) ?? [];
      const byId = new Map(enrichment.map((fact) => [fact.workerId, fact]));
      return {
        policyMembers,
        snapshots: team.members.map((member) => {
          const fact = byId.get(member.workerId);
          return {
            workerId: member.workerId,
            workerUserId: fact?.workerUserId ?? null,
            workerType: member.workerType,
            gender: member.gender,
            cleans: member.cleans,
            displayNameEn: fact?.displayNameEn ?? member.workerId,
            displayNameAr: fact?.displayNameAr ?? member.workerId,
          };
        }),
        teamId: team.teamId,
        teamVersion: team.teamVersion,
      };
    }

    failWhen(input.workerIds.length === 0, () =>
      bookingAssignmentError("VALIDATION_FAILED", { field: "workerIds" }),
    );
    const facts = requirePresent(
      await this.deps.workforce.getAssignmentWorkerFacts({
        providerId: input.providerId,
        workerIds: input.workerIds,
      }),
      () => bookingAssignmentError("BOOKING_ASSIGNMENT_COMPOSITION_INVALID"),
    );
    failWhen(facts.length !== new Set(input.workerIds).size, () =>
      bookingAssignmentError("BOOKING_ASSIGNMENT_COMPOSITION_INVALID"),
    );
    for (const fact of facts) {
      failWhen(fact.status !== "ACTIVE", () =>
        bookingAssignmentError("BOOKING_ASSIGNMENT_COMPOSITION_INVALID"),
      );
      if (fact.cleans) {
        failWhen(!fact.profileComplete, () =>
          bookingAssignmentError("BOOKING_ASSIGNMENT_COMPOSITION_INVALID"),
        );
      }
    }
    const ordered = input.workerIds
      .map((id) => facts.find((fact) => fact.workerId === id))
      .filter((fact): fact is BookingAssignmentWorkerFact => fact !== undefined);
    return {
      policyMembers: mapWorkerFactsToPolicy(ordered),
      snapshots: ordered.map((fact) => ({
        workerId: fact.workerId,
        workerUserId: fact.workerUserId,
        workerType: fact.workerType,
        gender: fact.gender,
        cleans: fact.cleans,
        displayNameEn: fact.displayNameEn,
        displayNameAr: fact.displayNameAr,
      })),
      teamId: null,
      teamVersion: null,
    };
  }

  private async assertSchedulesAndOverlaps(
    tx: BookingTx,
    input: {
      readonly providerId: string;
      readonly bookingId: string;
      readonly startsAt: Date;
      readonly endsAt: Date;
      readonly workerIds: readonly string[];
    },
  ): Promise<void> {
    for (const workerId of input.workerIds) {
      const covered = await this.deps.workforce.coversWorkerBookingWindow({
        providerId: input.providerId,
        workerId,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
      });
      failWhen(!covered, () =>
        bookingAssignmentError("BOOKING_ASSIGNMENT_SCHEDULE_UNAVAILABLE", {
          workerId,
        }),
      );
    }

    const conflicts = await tx.bookingAssignment.findMany({
      where: {
        providerId: input.providerId,
        status: "ACTIVE",
        bookingId: { not: input.bookingId },
        startsAt: { lt: input.endsAt },
        endsAt: { gt: input.startsAt },
        booking: { status: { not: "CANCELLED" } },
        members: { some: { workerId: { in: [...input.workerIds] } } },
      },
      select: { id: true },
    });
    failWhen(conflicts.length > 0, () =>
      bookingAssignmentError("BOOKING_ASSIGNMENT_WORKER_CONFLICT"),
    );
  }

  private async requireProviderBooking(
    store: Pick<BookingTx, "booking">,
    bookingId: string,
    providerId: string,
  ): Promise<any> {
    const booking = await store.booking.findUnique({
      where: { id: bookingId },
    });
    failWhen(booking === null, () => bookingAssignmentError("NOT_FOUND"));
    failWhen(booking.providerId !== providerId, () =>
      bookingAssignmentError("BOOKING_ASSIGNMENT_FORBIDDEN"),
    );
    return booking;
  }

  private async requireRule(
    tx: BookingTx,
    actor: string,
    fromStatus: string,
    toStatus: string,
  ): Promise<void> {
    const rule = await tx.statusTransitionRule.findFirst({
      where: { actor, fromStatus, toStatus, active: true },
    });
    failWhen(rule === null, () =>
      bookingAssignmentError("BOOKING_ASSIGNMENT_INVALID_STATE"),
    );
  }

  private async insertIntent(
    tx: BookingTx,
    input: {
      readonly bookingId: string;
      readonly template: "BOOKING_ASSIGNED" | "BOOKING_ASSIGNMENT_REPLACED";
      readonly recipientUserId: string;
      readonly locale: "AR" | "EN";
      readonly idempotencyKey: string;
    },
  ): Promise<void> {
    await tx.bookingNotificationIntent.upsert({
      where: { idempotencyKey: input.idempotencyKey },
      create: {
        bookingId: input.bookingId,
        template: input.template,
        locale: input.locale,
        recipientUserId: input.recipientUserId,
        idempotencyKey: input.idempotencyKey,
        safeVariables: { bookingId: input.bookingId },
      },
      update: {},
    });
  }

  private async withActorIdempotency<T>(input: {
    readonly actorUserId: string;
    readonly commandType:
      | "ASSIGN_TEAM"
      | "ASSIGN_WORKERS"
      | "REPLACE_TEAM"
      | "REPLACE_WORKERS";
    readonly idempotencyKey: string;
    readonly bookingId: string;
    readonly request: unknown;
    readonly run: (tx: BookingTx) => Promise<T>;
  }): Promise<T> {
    const db = clientOf(this.deps);
    const requestHash = requestHashOf(input.request);
    const existing = await db.bookingActorCommand.findUnique({
      where: {
        actorUserId_commandType_idempotencyKey: {
          actorUserId: input.actorUserId,
          commandType: input.commandType,
          idempotencyKey: input.idempotencyKey,
        },
      },
    });
    if (existing !== null) {
      failWhen(existing.requestHash !== requestHash, () =>
        bookingAssignmentError("BOOKING_ASSIGNMENT_IDEMPOTENCY_CONFLICT"),
      );
      return existing.responseJson as T;
    }
    try {
      return await db.$transaction(async (tx) => {
        const created = await tx.bookingActorCommand.create({
          data: {
            actorUserId: input.actorUserId,
            commandType: input.commandType,
            idempotencyKey: input.idempotencyKey,
            bookingId: input.bookingId,
            requestHash,
            responseJson: {},
          },
        });
        const result = await input.run(tx);
        await tx.bookingActorCommand.update({
          where: { id: created.id },
          data: { responseJson: result },
        });
        return result;
      });
    } catch (error) {
      if (!isUniqueCollision(error)) {
        throw error;
      }
      const raced = await db.bookingActorCommand.findUnique({
        where: {
          actorUserId_commandType_idempotencyKey: {
            actorUserId: input.actorUserId,
            commandType: input.commandType,
            idempotencyKey: input.idempotencyKey,
          },
        },
      });
      failWhen(raced === null, () =>
        bookingAssignmentError("BOOKING_ASSIGNMENT_VERSION_CONFLICT"),
      );
      failWhen(raced.requestHash !== requestHash, () =>
        bookingAssignmentError("BOOKING_ASSIGNMENT_IDEMPOTENCY_CONFLICT"),
      );
      return raced.responseJson as T;
    }
  }
}

/**
 * @desc Factory for booking assignment service.
 * @access Composition
 */
export function createBookingAssignmentService(
  dependencies: BookingAssignmentServiceDependencies,
): BookingAssignmentService {
  return new BookingAssignmentService(dependencies);
}
