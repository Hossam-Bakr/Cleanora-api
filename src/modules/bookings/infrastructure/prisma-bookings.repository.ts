import type { Prisma } from "#generated/prisma/client";
import { Prisma as PrismaNamespace } from "#generated/prisma/client";

import { getPrismaClient } from "#database/prisma";

import { BOOKING_FORMULA_VERSION } from "../bookings.matrix.js";
import { formatMinorUnitsToCanonicalDecimal } from "../bookings.money.js";
import type {
  BookingAggregate,
  BookingCommandWrite,
  BookingsCommandRepository,
} from "../bookings.command.types.js";
import {
  BookingIdempotencyCollision,
  BookingTransitionUnavailable,
  presentBooking,
} from "../bookings.command.types.js";

type BookingDraftMutationRejection = "NOT_FOUND" | "CONFLICT" | "NOT_DRAFT";

class BookingDraftMutationRejected extends Error {
  public constructor(public readonly result: BookingDraftMutationRejection) {
    super(result);
    this.name = "BookingDraftMutationRejected";
  }
}

type BookingCancelMutationRejection =
  "NOT_FOUND" | "CONFLICT" | "NOT_CANCELLABLE";

class BookingCancelMutationRejected extends Error {
  public constructor(public readonly result: BookingCancelMutationRejection) {
    super(result);
    this.name = "BookingCancelMutationRejected";
  }
}

export type {
  BookingAddressRecord,
  BookingAggregate,
  BookingAnswerRecord,
  BookingCommandRecord,
  BookingHistoryRecord,
  BookingItemRecord,
  BookingMediaRecord,
  BookingsCommandRepository,
  CreateDraftInput,
} from "../bookings.command.types.js";
export { hashBookingRequest } from "../bookings.command.types.js";

async function reserveCommand(
  tx: unknown,
  command: BookingCommandWrite,
): Promise<void> {
  const commands = (
    tx as {
      bookingCommand: {
        create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
      };
    }
  ).bookingCommand;
  try {
    await commands.create({
      data: {
        customerUserId: command.customerUserId,
        commandType: command.commandType,
        idempotencyKey: command.idempotencyKey,
        bookingId: null,
        requestHash: command.requestHash,
        responseJson: { reserved: true },
      },
    });
  } catch (error) {
    if (
      error instanceof PrismaNamespace.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new BookingIdempotencyCollision();
    }
    throw error;
  }
}

async function finalizeCommand(
  tx: unknown,
  command: BookingCommandWrite,
  bookingId: string,
  aggregate: BookingAggregate,
): Promise<void> {
  const commands = (
    tx as {
      bookingCommand: {
        update: (args: { where: object; data: object }) => Promise<unknown>;
      };
    }
  ).bookingCommand;
  await commands.update({
    where: {
      customerUserId_commandType_idempotencyKey: {
        customerUserId: command.customerUserId,
        commandType: command.commandType,
        idempotencyKey: command.idempotencyKey,
      },
    },
    data: {
      bookingId,
      responseJson: presentBooking(aggregate) as Prisma.InputJsonValue,
    },
  });
}

async function requireExecutableCustomerTransition(
  tx: unknown,
  fromStatus: string,
  toStatus: string,
): Promise<void> {
  const rules = (
    tx as {
      statusTransitionRule: {
        findFirst: (args: {
          where: object;
          select: { id: true };
        }) => Promise<{ id: string } | null>;
      };
    }
  ).statusTransitionRule;
  const row = await rules.findFirst({
    where: {
      actor: "CUSTOMER",
      fromStatus,
      toStatus,
      executable: true,
    },
    select: { id: true },
  });
  if (row === null) {
    throw new BookingTransitionUnavailable();
  }
}

async function claimOwnedBooking(
  tx: unknown,
  input: {
    readonly bookingId: string;
    readonly customerUserId: string;
    readonly expectedVersion: number;
    readonly status:
      | BookingAggregate["status"]
      | { readonly in: readonly BookingAggregate["status"][] };
    readonly data: Record<string, unknown>;
  },
): Promise<boolean> {
  const booking = (
    tx as {
      booking: {
        updateMany: (args: {
          where: object;
          data: object;
        }) => Promise<{ count: number }>;
      };
    }
  ).booking;
  const claimed = await booking.updateMany({
    where: {
      id: input.bookingId,
      customerUserId: input.customerUserId,
      version: input.expectedVersion,
      status: input.status,
    },
    data: input.data,
  });
  return claimed.count === 1;
}

async function classifyFailedDraftClaim(
  tx: unknown,
  input: { readonly bookingId: string; readonly customerUserId: string },
): Promise<"NOT_FOUND" | "CONFLICT" | "NOT_DRAFT"> {
  const current = await (
    tx as {
      booking: {
        findFirst: (args: {
          where: object;
          select: { status: true };
        }) => Promise<{ status: BookingAggregate["status"] } | null>;
      };
    }
  ).booking.findFirst({
    where: { id: input.bookingId, customerUserId: input.customerUserId },
    select: { status: true },
  });
  if (current === null) {
    return "NOT_FOUND";
  }
  if (current.status !== "DRAFT") {
    return "NOT_DRAFT";
  }
  return "CONFLICT";
}

async function classifyFailedCancelClaim(
  tx: unknown,
  input: { readonly bookingId: string; readonly customerUserId: string },
): Promise<"NOT_FOUND" | "CONFLICT" | "NOT_CANCELLABLE"> {
  const current = await (
    tx as {
      booking: {
        findFirst: (args: {
          where: object;
          select: { status: true };
        }) => Promise<{ status: BookingAggregate["status"] } | null>;
      };
    }
  ).booking.findFirst({
    where: { id: input.bookingId, customerUserId: input.customerUserId },
    select: { status: true },
  });
  if (current === null) {
    return "NOT_FOUND";
  }
  if (current.status !== "DRAFT" && current.status !== "AWAITING_DEPOSIT") {
    return "NOT_CANCELLABLE";
  }
  return "CONFLICT";
}

function crewFromDb(
  value: "ALL_MALE" | "ALL_FEMALE" | "ANY",
): "all_male" | "all_female" | "any" {
  if (value === "ALL_MALE") return "all_male";
  if (value === "ALL_FEMALE") return "all_female";
  return "any";
}

function toQuote(input: {
  readonly currencyCode: string;
  readonly decimalPlaces: number;
  readonly grossMinorUnits: string;
  readonly depositMinorUnits: string;
  readonly remainderMinorUnits: string;
  readonly depositPercent: string;
  readonly formulaVersion: typeof BOOKING_FORMULA_VERSION;
}): NonNullable<BookingAggregate["quote"]> {
  return {
    ...input,
    gross: formatMinorUnitsToCanonicalDecimal(
      input.grossMinorUnits,
      input.decimalPlaces,
    ),
    deposit: formatMinorUnitsToCanonicalDecimal(
      input.depositMinorUnits,
      input.decimalPlaces,
    ),
    remainder: formatMinorUnitsToCanonicalDecimal(
      input.remainderMinorUnits,
      input.decimalPlaces,
    ),
  };
}

function requireBookingFormulaVersion(
  persistedFormulaVersion: string,
): typeof BOOKING_FORMULA_VERSION {
  if (persistedFormulaVersion !== BOOKING_FORMULA_VERSION) {
    throw new Error("UNSUPPORTED_BOOKING_FORMULA_VERSION");
  }
  return persistedFormulaVersion;
}

function toAggregate(row: {
  readonly id: string;
  readonly customerUserId: string;
  readonly countryId: string;
  readonly currencyCode: string;
  readonly currencyDecimalPlaces: number;
  readonly status: BookingAggregate["status"];
  readonly serviceId: string;
  readonly providerId: string;
  readonly teamId: string;
  readonly cityId: string;
  readonly districtId: string | null;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly crewPreference: "ALL_MALE" | "ALL_FEMALE" | "ANY";
  readonly requiredTeamUnits: number;
  readonly locale: "AR" | "EN";
  readonly notes: string | null;
  readonly emergencySignaled: boolean;
  readonly version: number;
  readonly depositPercent: string;
  readonly eligibilityEvaluationId: string | null;
  readonly grossMinorUnits: { toFixed(digits: number): string } | null;
  readonly depositMinorUnits: { toFixed(digits: number): string } | null;
  readonly remainderMinorUnits: { toFixed(digits: number): string } | null;
  readonly cancelledAt: Date | null;
  readonly submittedAt: Date | null;
  readonly createdAt: Date;
  readonly items: readonly {
    readonly catalogServiceId: string;
    readonly catalogServiceCode: string;
    readonly catalogServiceVersion: number;
    readonly providerServiceId: string;
    readonly providerServiceVersion: number;
    readonly providerServicePriceId: string;
    readonly estimatedDurationMinutes: number;
  }[];
  readonly answers: readonly {
    readonly fieldId: string;
    readonly fieldCode: string;
    readonly kind: string;
    readonly valueJson: unknown;
  }[];
  readonly address: {
    readonly sourceUserAddressId: string;
    readonly countryCode: string;
    readonly cityId: string;
    readonly districtId: string | null;
    readonly cityLabel: string;
    readonly districtLabel: string;
    readonly addressText: string;
    readonly building: string | null;
    readonly floor: string | null;
    readonly notes: string | null;
  } | null;
  readonly media: readonly {
    readonly mediaId: string;
    readonly displayOrder: number;
  }[];
  readonly statusHistory: readonly {
    readonly fromStatus: string;
    readonly toStatus: BookingAggregate["status"];
    readonly actorType: string;
    readonly reasonCode: string | null;
    readonly createdAt: Date;
  }[];
  readonly snapshot: {
    readonly catalogSnapshotJson: unknown;
    readonly providerSnapshotJson: unknown;
    readonly frozenAt: Date;
  } | null;
  readonly priceBreakdown: {
    readonly currencyCode: string;
    readonly decimalPlaces: number;
    readonly grossMinorUnits: { toFixed(digits: number): string };
    readonly depositMinorUnits: { toFixed(digits: number): string };
    readonly remainderMinorUnits: { toFixed(digits: number): string };
    readonly depositPercent: string;
    readonly formulaVersion: string;
    readonly createdAt: Date;
  } | null;
}): BookingAggregate {
  const item = row.items[0];
  const headerQuote =
    row.grossMinorUnits === null ||
    row.depositMinorUnits === null ||
    row.remainderMinorUnits === null
      ? null
      : toQuote({
          currencyCode: row.currencyCode,
          decimalPlaces: row.currencyDecimalPlaces,
          grossMinorUnits: row.grossMinorUnits.toFixed(0),
          depositMinorUnits: row.depositMinorUnits.toFixed(0),
          remainderMinorUnits: row.remainderMinorUnits.toFixed(0),
          depositPercent: row.depositPercent,
          formulaVersion: BOOKING_FORMULA_VERSION,
        });
  const frozenQuote =
    row.priceBreakdown === null
      ? null
      : toQuote({
          currencyCode: row.priceBreakdown.currencyCode,
          decimalPlaces: row.priceBreakdown.decimalPlaces,
          grossMinorUnits: row.priceBreakdown.grossMinorUnits.toFixed(0),
          depositMinorUnits: row.priceBreakdown.depositMinorUnits.toFixed(0),
          remainderMinorUnits:
            row.priceBreakdown.remainderMinorUnits.toFixed(0),
          depositPercent: row.priceBreakdown.depositPercent,
          formulaVersion: requireBookingFormulaVersion(
            row.priceBreakdown.formulaVersion,
          ),
        });
  const quote = frozenQuote ?? headerQuote;
  return {
    id: row.id,
    customerUserId: row.customerUserId,
    countryId: row.countryId,
    currencyCode: row.currencyCode,
    currencyDecimalPlaces: row.currencyDecimalPlaces,
    status: row.status,
    serviceId: row.serviceId,
    providerId: row.providerId,
    teamId: row.teamId,
    cityId: row.cityId,
    districtId: row.districtId,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    crewPreference: crewFromDb(row.crewPreference),
    requiredTeamUnits: row.requiredTeamUnits,
    locale: row.locale,
    notes: row.notes,
    emergencySignaled: row.emergencySignaled,
    version: row.version,
    depositPercent: row.depositPercent,
    quote,
    eligibilityEvaluationId: row.eligibilityEvaluationId,
    item: item
      ? {
          catalogServiceId: item.catalogServiceId,
          catalogServiceCode: item.catalogServiceCode,
          catalogServiceVersion: item.catalogServiceVersion,
          providerServiceId: item.providerServiceId,
          providerServiceVersion: item.providerServiceVersion,
          providerServicePriceId: item.providerServicePriceId,
          estimatedDurationMinutes: item.estimatedDurationMinutes,
        }
      : null,
    address: row.address
      ? {
          sourceUserAddressId: row.address.sourceUserAddressId,
          countryCode: row.address.countryCode,
          cityId: row.address.cityId,
          districtId: row.address.districtId,
          cityLabel: row.address.cityLabel,
          districtLabel: row.address.districtLabel,
          addressText: row.address.addressText,
          building: row.address.building,
          floor: row.address.floor,
          notes: row.address.notes,
        }
      : null,
    answers: row.answers.map((answer) => ({
      fieldId: answer.fieldId,
      fieldCode: answer.fieldCode,
      kind: answer.kind,
      value: answer.valueJson,
    })),
    media: row.media
      .slice()
      .sort((left, right) => left.displayOrder - right.displayOrder)
      .map((entry) => ({
        mediaId: entry.mediaId,
        displayOrder: entry.displayOrder,
      })),
    statusHistory: row.statusHistory
      .slice()
      .sort(
        (left, right) => left.createdAt.getTime() - right.createdAt.getTime(),
      )
      .map((entry) => ({
        fromStatus: entry.fromStatus,
        toStatus: entry.toStatus,
        actorType: entry.actorType,
        reasonCode: entry.reasonCode,
        createdAt: entry.createdAt.toISOString(),
      })),
    snapshot:
      row.snapshot === null
        ? null
        : {
            catalog: row.snapshot.catalogSnapshotJson,
            provider: row.snapshot.providerSnapshotJson,
            frozenAt: row.snapshot.frozenAt.toISOString(),
          },
    priceBreakdown:
      row.priceBreakdown === null || frozenQuote === null
        ? null
        : {
            gross: frozenQuote.gross,
            deposit: frozenQuote.deposit,
            remainder: frozenQuote.remainder,
            currencyCode: frozenQuote.currencyCode,
            decimalPlaces: frozenQuote.decimalPlaces,
            depositPercent: frozenQuote.depositPercent,
            formulaVersion: frozenQuote.formulaVersion,
            createdAt: row.priceBreakdown.createdAt.toISOString(),
          },
    snapshotFrozen: row.snapshot !== null,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

const includeAll = {
  items: true,
  answers: true,
  address: true,
  media: true,
  snapshot: true,
  priceBreakdown: true,
  statusHistory: true,
} as const;

/**
 * @desc Bookings-owned Prisma persistence for draft/submit/cancel commands.
 * @access Bookings infrastructure
 */
export function createPrismaBookingsCommandRepository(
  databaseContext?: unknown,
): BookingsCommandRepository {
  const client = (databaseContext ?? getPrismaClient()) as ReturnType<
    typeof getPrismaClient
  >;
  return {
    async isExecutableTransition(input) {
      const row = await client.statusTransitionRule.findFirst({
        where: {
          actor: input.actor,
          fromStatus: input.from,
          toStatus: input.to,
          executable: true,
        },
        select: { id: true },
      });
      return row !== null;
    },
    async findCommand(input) {
      const row = await client.bookingCommand.findUnique({
        where: {
          customerUserId_commandType_idempotencyKey: {
            customerUserId: input.customerUserId,
            commandType: input.commandType,
            idempotencyKey: input.idempotencyKey,
          },
        },
      });
      return row === null
        ? null
        : {
            requestHash: row.requestHash,
            bookingId: row.bookingId,
            responseJson: row.responseJson,
          };
    },
    async createDraft(input) {
      return client.$transaction(async (tx) => {
        await requireExecutableCustomerTransition(tx, "NONE", "DRAFT");
        await reserveCommand(tx, input.command);
        const booking = await tx.booking.create({
          data: {
            customerUserId: input.customerUserId,
            countryId: input.countryId,
            currencyCode: input.currencyCode,
            currencyDecimalPlaces: input.currencyDecimalPlaces,
            status: "DRAFT",
            serviceId: input.serviceId,
            providerId: input.providerId,
            teamId: input.teamId,
            cityId: input.cityId,
            districtId: input.districtId,
            startsAt: input.startsAt,
            endsAt: input.endsAt,
            crewPreference: input.crewPreference,
            requiredTeamUnits: input.requiredTeamUnits,
            locale: input.locale,
            notes: input.notes,
            depositPercent: input.depositPercent,
            eligibilityEvaluationId: input.eligibilityEvaluationId,
            grossMinorUnits: new PrismaNamespace.Decimal(
              input.quote.grossMinorUnits,
            ),
            depositMinorUnits: new PrismaNamespace.Decimal(
              input.quote.depositMinorUnits,
            ),
            remainderMinorUnits: new PrismaNamespace.Decimal(
              input.quote.remainderMinorUnits,
            ),
            items: { create: { ...input.item } },
            address: { create: { ...input.address } },
            answers: {
              create: input.answers.map((answer) => ({
                fieldId: answer.fieldId,
                fieldCode: answer.fieldCode,
                kind: answer.kind,
                valueJson: answer.value as Prisma.InputJsonValue,
              })),
            },
            statusHistory: {
              create: {
                fromStatus: "NONE",
                toStatus: "DRAFT",
                actorUserId: input.customerUserId,
                actorType: "CUSTOMER",
              },
            },
          },
          include: includeAll,
        });
        const aggregate = toAggregate(booking);
        await finalizeCommand(tx, input.command, aggregate.id, aggregate);
        return aggregate;
      });
    },
    async findOwned(input) {
      const row = await client.booking.findFirst({
        where: { id: input.bookingId, customerUserId: input.customerUserId },
        include: includeAll,
      });
      return row === null ? null : toAggregate(row);
    },
    async listOwned(input) {
      const take = input.limit + 1;
      const rows = await client.booking.findMany({
        where: {
          customerUserId: input.customerUserId,
          ...(input.status === undefined ? {} : { status: input.status }),
          ...(input.cursor === undefined
            ? {}
            : {
                id: {
                  lt: Buffer.from(input.cursor, "base64url").toString("utf8"),
                },
              }),
        },
        orderBy: { id: "desc" },
        take,
        include: includeAll,
      });
      const hasMore = rows.length > input.limit;
      const page = hasMore ? rows.slice(0, input.limit) : rows;
      return {
        items: page.map(toAggregate),
        nextCursor: hasMore
          ? Buffer.from(page[page.length - 1]!.id, "utf8").toString("base64url")
          : null,
      };
    },
    async replaceDraftContents(input) {
      return client.$transaction(async (tx) => {
        const current = await tx.booking.findFirst({
          where: { id: input.bookingId, customerUserId: input.customerUserId },
          select: { status: true, version: true },
        });
        if (current === null) return "NOT_FOUND" as const;
        if (current.status !== "DRAFT") return "NOT_DRAFT" as const;
        if (current.version !== input.expectedVersion)
          return "CONFLICT" as const;
        const claimed = await claimOwnedBooking(tx, {
          bookingId: input.bookingId,
          customerUserId: input.customerUserId,
          expectedVersion: input.expectedVersion,
          status: "DRAFT",
          data: {
            notes: input.notes,
            version: { increment: 1 },
          },
        });
        if (!claimed) {
          return classifyFailedDraftClaim(tx, {
            bookingId: input.bookingId,
            customerUserId: input.customerUserId,
          });
        }
        if (input.answers !== null) {
          await tx.bookingAnswer.deleteMany({
            where: { bookingId: input.bookingId },
          });
          if (input.answers.length > 0) {
            await tx.bookingAnswer.createMany({
              data: input.answers.map((answer) => ({
                bookingId: input.bookingId,
                fieldId: answer.fieldId,
                fieldCode: answer.fieldCode,
                kind: answer.kind,
                valueJson: answer.value as Prisma.InputJsonValue,
              })),
            });
          }
        }
        if (input.address !== null) {
          await tx.bookingAddress.deleteMany({
            where: { bookingId: input.bookingId },
          });
          await tx.bookingAddress.create({
            data: { bookingId: input.bookingId, ...input.address },
          });
        }
        const row = await tx.booking.findFirstOrThrow({
          where: { id: input.bookingId },
          include: includeAll,
        });
        const aggregate = toAggregate(row);
        return aggregate;
      });
    },
    async attachMedia(input) {
      try {
        return await client.$transaction(async (tx) => {
          const current = await tx.booking.findFirst({
            where: {
              id: input.bookingId,
              customerUserId: input.customerUserId,
            },
            include: { media: true },
          });
          if (current === null) return "NOT_FOUND" as const;
          if (current.status !== "DRAFT") return "NOT_DRAFT" as const;
          if (current.version !== input.expectedVersion)
            return "CONFLICT" as const;
          const alreadyLinked = current.media.some(
            (row) => row.mediaId === input.mediaId,
          );
          if (!alreadyLinked && current.media.length >= 5) {
            return "LIMIT" as const;
          }
          await reserveCommand(tx, input.command);
          if (alreadyLinked) {
            const existing = await tx.booking.findFirstOrThrow({
              where: { id: input.bookingId },
              include: includeAll,
            });
            const aggregate = toAggregate(existing);
            await finalizeCommand(tx, input.command, aggregate.id, aggregate);
            return aggregate;
          }
          const claimed = await claimOwnedBooking(tx, {
            bookingId: input.bookingId,
            customerUserId: input.customerUserId,
            expectedVersion: input.expectedVersion,
            status: "DRAFT",
            data: { version: { increment: 1 } },
          });
          if (!claimed) {
            throw new BookingDraftMutationRejected(
              await classifyFailedDraftClaim(tx, {
                bookingId: input.bookingId,
                customerUserId: input.customerUserId,
              }),
            );
          }
          await tx.bookingMedia.create({
            data: {
              bookingId: input.bookingId,
              mediaId: input.mediaId,
              displayOrder: current.media.length,
            },
          });
          const row = await tx.booking.findFirstOrThrow({
            where: { id: input.bookingId },
            include: includeAll,
          });
          const aggregate = toAggregate(row);
          await finalizeCommand(tx, input.command, aggregate.id, aggregate);
          return aggregate;
        });
      } catch (error) {
        if (error instanceof BookingDraftMutationRejected) {
          return error.result;
        }
        throw error;
      }
    },
    async submitForDeposit(input) {
      try {
        return await client.$transaction(async (tx) => {
          const current = await tx.booking.findFirst({
            where: {
              id: input.bookingId,
              customerUserId: input.customerUserId,
            },
            select: { status: true, version: true },
          });
          if (current === null) return "NOT_FOUND" as const;
          if (current.status !== "DRAFT") return "NOT_DRAFT" as const;
          if (current.version !== input.expectedVersion)
            return "CONFLICT" as const;
          await requireExecutableCustomerTransition(
            tx,
            "DRAFT",
            "AWAITING_DEPOSIT",
          );
          await reserveCommand(tx, input.command);
          const claimed = await claimOwnedBooking(tx, {
            bookingId: input.bookingId,
            customerUserId: input.customerUserId,
            expectedVersion: input.expectedVersion,
            status: "DRAFT",
            data: {
              status: "AWAITING_DEPOSIT",
              version: { increment: 1 },
              submittedAt: new Date(),
              eligibilityEvaluationId: input.eligibilityEvaluationId,
              grossMinorUnits: new PrismaNamespace.Decimal(
                input.quote.grossMinorUnits,
              ),
              depositMinorUnits: new PrismaNamespace.Decimal(
                input.quote.depositMinorUnits,
              ),
              remainderMinorUnits: new PrismaNamespace.Decimal(
                input.quote.remainderMinorUnits,
              ),
              depositPercent: input.quote.depositPercent,
            },
          });
          if (!claimed) {
            throw new BookingDraftMutationRejected(
              await classifyFailedDraftClaim(tx, {
                bookingId: input.bookingId,
                customerUserId: input.customerUserId,
              }),
            );
          }
          await tx.bookingSnapshot.create({
            data: {
              bookingId: input.bookingId,
              catalogSnapshotJson:
                input.catalogSnapshot as Prisma.InputJsonValue,
              providerSnapshotJson:
                input.providerSnapshot as Prisma.InputJsonValue,
              catalogHash: input.catalogHash,
              providerHash: input.providerHash,
              priceInputHash: input.priceInputHash,
              frozenAt: new Date(),
            },
          });
          await tx.bookingPriceBreakdown.create({
            data: {
              bookingId: input.bookingId,
              currencyCode: input.quote.currencyCode,
              decimalPlaces: input.quote.decimalPlaces,
              grossMinorUnits: new PrismaNamespace.Decimal(
                input.quote.grossMinorUnits,
              ),
              depositMinorUnits: new PrismaNamespace.Decimal(
                input.quote.depositMinorUnits,
              ),
              remainderMinorUnits: new PrismaNamespace.Decimal(
                input.quote.remainderMinorUnits,
              ),
              depositPercent: input.quote.depositPercent,
              formulaVersion: input.quote.formulaVersion,
            },
          });
          await tx.bookingStatusHistory.create({
            data: {
              bookingId: input.bookingId,
              fromStatus: "DRAFT",
              toStatus: "AWAITING_DEPOSIT",
              actorUserId: input.customerUserId,
              actorType: "CUSTOMER",
            },
          });
          const row = await tx.booking.findFirstOrThrow({
            where: { id: input.bookingId },
            include: includeAll,
          });
          const aggregate = toAggregate(row);
          await finalizeCommand(tx, input.command, aggregate.id, aggregate);
          return aggregate;
        });
      } catch (error) {
        if (error instanceof BookingDraftMutationRejected) {
          return error.result;
        }
        throw error;
      }
    },
    async cancel(input) {
      try {
        return await client.$transaction(async (tx) => {
          const current = await tx.booking.findFirst({
            where: {
              id: input.bookingId,
              customerUserId: input.customerUserId,
            },
            select: { status: true, version: true },
          });
          if (current === null) return "NOT_FOUND" as const;
          if (
            current.status !== "DRAFT" &&
            current.status !== "AWAITING_DEPOSIT"
          ) {
            return "NOT_CANCELLABLE" as const;
          }
          if (current.version !== input.expectedVersion)
            return "CONFLICT" as const;
          await requireExecutableCustomerTransition(
            tx,
            current.status,
            "CANCELLED",
          );
          await reserveCommand(tx, input.command);
          const claimed = await claimOwnedBooking(tx, {
            bookingId: input.bookingId,
            customerUserId: input.customerUserId,
            expectedVersion: input.expectedVersion,
            status: current.status,
            data: {
              status: "CANCELLED",
              version: { increment: 1 },
              cancelledAt: new Date(),
            },
          });
          if (!claimed) {
            throw new BookingCancelMutationRejected(
              await classifyFailedCancelClaim(tx, {
                bookingId: input.bookingId,
                customerUserId: input.customerUserId,
              }),
            );
          }
          await tx.bookingStatusHistory.create({
            data: {
              bookingId: input.bookingId,
              fromStatus: current.status,
              toStatus: "CANCELLED",
              actorUserId: input.customerUserId,
              actorType: "CUSTOMER",
              reasonCode: input.reason,
              ...(input.requestId === undefined
                ? {}
                : { requestId: input.requestId }),
            },
          });
          const row = await tx.booking.findFirstOrThrow({
            where: { id: input.bookingId },
            include: includeAll,
          });
          const aggregate = toAggregate(row);
          await finalizeCommand(tx, input.command, aggregate.id, aggregate);
          return aggregate;
        });
      } catch (error) {
        if (error instanceof BookingCancelMutationRejected) {
          return error.result;
        }
        throw error;
      }
    },
  };
}
