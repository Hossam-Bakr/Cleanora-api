/**
 * R1-P18 Orders application service.
 * Owns ensure-order, transitions, completion codes, media/notes, timeline, cancel.
 */

import { createHash, randomUUID } from "node:crypto";

import {
  issueCompletionCode,
  isSixDigitCode,
  verifyCompletionCode,
  DEFAULT_COMPLETION_CODE_MAX_ATTEMPTS,
  DEFAULT_COMPLETION_CODE_TTL_SECONDS,
} from "./domain/completion-code.js";
import {
  canReadOrder,
  canViewCompletionMedia,
  classifyOrderActor,
  isFieldActor,
  type OrderActorRole,
} from "./domain/order-authz.js";
import { ordersError } from "./orders.errors.js";
import {
  canCancelFromBooking,
  isLegalForwardTransition,
  type OrderStatusName,
} from "./orders.matrix.js";

type StoreDelegate = {
  findUnique: (args: unknown) => Promise<any>;
  findFirst: (args: unknown) => Promise<any>;
  findMany: (args: unknown) => Promise<any[]>;
  create: (args: unknown) => Promise<any>;
  update: (args: unknown) => Promise<any>;
  updateMany: (args: unknown) => Promise<{ count: number }>;
  upsert: (args: unknown) => Promise<any>;
};

type OrdersTx = {
  order: StoreDelegate;
  orderStatusHistory: StoreDelegate;
  completionCode: StoreDelegate;
  completionCodeAttempt: StoreDelegate;
  orderMedia: StoreDelegate;
  orderNote: StoreDelegate;
  orderEvent: StoreDelegate;
  orderNotificationIntent: StoreDelegate;
  orderActorCommand: StoreDelegate;
};

type OrdersStore = OrdersTx & {
  $transaction: <T>(work: (tx: OrdersTx) => Promise<T>) => Promise<T>;
};

export interface BookingOrderActivationFacts {
  readonly bookingId: string;
  readonly status: string;
  readonly providerId: string;
  readonly customerUserId: string;
  readonly activeAssignment: {
    readonly assignmentId: string;
    readonly members: readonly {
      readonly workerId: string;
      readonly workerUserId: string | null;
    }[];
  } | null;
}

export interface OrdersServiceDependencies {
  readonly client?: unknown;
  readonly now: () => Date;
  readonly completionCodePepper?: string;
  readonly completionCodeTtlSeconds?: number;
  readonly completionCodeMaxAttempts?: number;
  readonly readBookingActivation: (
    bookingId: string,
  ) => Promise<BookingOrderActivationFacts | null>;
  readonly assertActiveProviderManager: (
    providerId: string,
    userId: string,
  ) => Promise<{
    readonly providerId: string;
    readonly userId: string;
    readonly level: "OWNER" | "ADMIN";
  }>;
  readonly isStaffAdmin: (userId: string) => Promise<boolean>;
}

export interface OrderDossier {
  readonly orderId: string;
  readonly bookingId: string;
  readonly providerId: string;
  readonly customerUserId: string;
  readonly status: OrderStatusName;
  readonly assignedAt: string;
  readonly onTheWayAt: string | null;
  readonly inProgressAt: string | null;
  readonly readyToCompleteAt: string | null;
  readonly completedAt: string | null;
  readonly cancelledAt: string | null;
  readonly activeCompletionCode: {
    readonly expiresAt: string;
    readonly attemptsRemaining: number;
  } | null;
}

export interface OrderTimelineItem {
  readonly type: string;
  readonly createdAt: string;
  readonly actorUserId: string | null;
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface OrderMediaItem {
  readonly mediaId: string;
  readonly mediaFileId: string;
  readonly kind: "PROGRESS" | "COMPLETION";
  readonly uploadedByUserId: string;
  readonly createdAt: string;
}

function clientOf(deps: OrdersServiceDependencies): OrdersStore {
  return deps.client as OrdersStore;
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

function iso(value: Date | null | undefined): string | null {
  return value === null || value === undefined ? null : value.toISOString();
}

function dossierOf(row: any): OrderDossier {
  const active = row.activeCompletionCode ?? null;
  return {
    orderId: row.id,
    bookingId: row.bookingId,
    providerId: row.providerId,
    customerUserId: row.customerUserId,
    status: row.status,
    assignedAt: row.assignedAt.toISOString(),
    onTheWayAt: iso(row.onTheWayAt),
    inProgressAt: iso(row.inProgressAt),
    readyToCompleteAt: iso(row.readyToCompleteAt),
    completedAt: iso(row.completedAt),
    cancelledAt: iso(row.cancelledAt),
    activeCompletionCode:
      active === null
        ? null
        : {
            expiresAt: active.expiresAt.toISOString(),
            attemptsRemaining: Math.max(
              0,
              active.maxAttempts - active.attemptsUsed,
            ),
          },
  };
}

/**
 * @desc Orders application workflows for R1-P18.
 * @access Orders module
 */
export class OrdersService {
  public constructor(private readonly deps: OrdersServiceDependencies) {}

  /**
   * @desc Idempotent ensure-order for ASSIGNED booking with ACTIVE assignment.
   */
  public async ensureOrderForAssignedBooking(input: {
    readonly bookingId: string;
    readonly actorUserId: string;
  }): Promise<OrderDossier> {
    const facts = requirePresent(
      await this.deps.readBookingActivation(input.bookingId),
      () => ordersError("ORDER_ENSURE_REJECTED", { reason: "BOOKING_MISSING" }),
    );
    failWhen(facts.status !== "ASSIGNED", () =>
      ordersError("ORDER_ENSURE_REJECTED", { reason: "BOOKING_NOT_ASSIGNED" }),
    );
    failWhen(facts.activeAssignment === null, () =>
      ordersError("ORDER_ENSURE_REJECTED", { reason: "NO_ACTIVE_ASSIGNMENT" }),
    );

    const db = clientOf(this.deps);
    const existing = await db.order.findUnique({
      where: { bookingId: input.bookingId },
    });
    if (existing !== null) {
      return this.toDossier(existing);
    }

    const now = this.deps.now();
    try {
      const created = await db.$transaction(async (tx) => {
        const again = await tx.order.findUnique({
          where: { bookingId: input.bookingId },
        });
        if (again !== null) {
          return again;
        }
        const order = await tx.order.create({
          data: {
            id: randomUUID(),
            bookingId: facts.bookingId,
            providerId: facts.providerId,
            customerUserId: facts.customerUserId,
            status: "ASSIGNED",
            assignedAt: now,
            updatedAt: now,
          },
        });
        await tx.orderStatusHistory.create({
          data: {
            id: randomUUID(),
            orderId: order.id,
            fromStatus: null,
            toStatus: "ASSIGNED",
            actorUserId: input.actorUserId,
            actorRole: "SYSTEM",
            reasonCode: "ENSURE_ORDER",
          },
        });
        await tx.orderEvent.create({
          data: {
            id: randomUUID(),
            orderId: order.id,
            type: "CREATED",
            actorUserId: input.actorUserId,
            payload: { bookingId: facts.bookingId, status: "ASSIGNED" },
          },
        });
        return order;
      });
      return this.toDossier(created);
    } catch (error) {
      if (isUniqueCollision(error)) {
        const raced = requirePresent(
          await db.order.findUnique({ where: { bookingId: input.bookingId } }),
          () => ordersError("DEPENDENCY_FAILURE"),
        );
        return this.toDossier(raced);
      }
      throw error;
    }
  }

  public async getOrder(input: {
    readonly orderId: string;
    readonly actorUserId: string;
  }): Promise<OrderDossier> {
    const order = await this.requireOrder(input.orderId);
    await this.requireReadAccess(order, input.actorUserId);
    return this.toDossier(order);
  }

  public async getOrEnsureByBooking(input: {
    readonly bookingId: string;
    readonly actorUserId: string;
  }): Promise<OrderDossier> {
    const facts = requirePresent(
      await this.deps.readBookingActivation(input.bookingId),
      () => ordersError("ORDER_ENSURE_REJECTED", { reason: "BOOKING_MISSING" }),
    );
    // Entitlement must be proven before any ensure side effect (US1 / deny-by-default).
    await this.requireReadAccessForActivation(facts, input.actorUserId);

    const db = clientOf(this.deps);
    const existing = await db.order.findUnique({
      where: { bookingId: input.bookingId },
    });
    if (existing !== null) {
      return this.toDossier(existing);
    }
    return this.ensureOrderForAssignedBooking(input);
  }

  public async transitionOnTheWay(input: {
    readonly orderId: string;
    readonly actorUserId: string;
    readonly idempotencyKey: string;
  }): Promise<OrderDossier> {
    return this.runFieldTransition({
      ...input,
      commandType: "TRANSITION_ON_THE_WAY",
      toStatus: "ON_THE_WAY",
      timestampField: "onTheWayAt",
      notifyTemplate: "ORDER_ON_THE_WAY",
      includeCodeInIntent: false,
    });
  }

  public async transitionInProgress(input: {
    readonly orderId: string;
    readonly actorUserId: string;
    readonly idempotencyKey: string;
  }): Promise<OrderDossier> {
    return this.runFieldTransition({
      ...input,
      commandType: "TRANSITION_IN_PROGRESS",
      toStatus: "IN_PROGRESS",
      timestampField: "inProgressAt",
      notifyTemplate: null,
      includeCodeInIntent: false,
    });
  }

  public async transitionReadyToComplete(input: {
    readonly orderId: string;
    readonly actorUserId: string;
    readonly idempotencyKey: string;
  }): Promise<OrderDossier> {
    return this.runFieldTransition({
      ...input,
      commandType: "TRANSITION_READY_TO_COMPLETE",
      toStatus: "READY_TO_COMPLETE",
      timestampField: "readyToCompleteAt",
      notifyTemplate: "ORDER_READY_TO_COMPLETE",
      includeCodeInIntent: true,
    });
  }

  public async complete(input: {
    readonly orderId: string;
    readonly actorUserId: string;
    readonly code: string;
    readonly idempotencyKey: string;
  }): Promise<OrderDossier> {
    failWhen(!isSixDigitCode(input.code), () =>
      ordersError("ORDER_CODE_REQUIRED"),
    );
    const orderProbe = await this.requireOrder(input.orderId);
    const role = await this.requireFieldActor(orderProbe, input.actorUserId);
    return this.withActorIdempotency({
      orderId: input.orderId,
      actorUserId: input.actorUserId,
      commandType: "COMPLETE",
      idempotencyKey: input.idempotencyKey,
      request: { orderId: input.orderId, code: input.code },
      run: async (tx) => {
        const order = requirePresent(
          await tx.order.findUnique({ where: { id: input.orderId } }),
          () => ordersError("ORDER_NOT_FOUND"),
        );
        failWhen(order.status === "COMPLETED", () =>
          ordersError("ORDER_ALREADY_TERMINAL"),
        );
        failWhen(order.status !== "READY_TO_COMPLETE", () =>
          ordersError("ORDER_TRANSITION_ILLEGAL", {
            from: order.status,
            to: "COMPLETED",
          }),
        );
        const active = requirePresent(
          await tx.completionCode.findFirst({
            where: { orderId: order.id, status: "ACTIVE" },
          }),
          () => ordersError("ORDER_CODE_INVALID"),
        );
        const now = this.deps.now();
        failWhen(active.expiresAt.getTime() <= now.getTime(), () =>
          ordersError("ORDER_CODE_EXPIRED"),
        );
        failWhen(active.attemptsUsed >= active.maxAttempts, () =>
          ordersError("ORDER_CODE_LOCKED"),
        );
        const ok = verifyCompletionCode({
          plaintext: input.code,
          codeHash: active.codeHash as string,
          codeSalt: active.codeSalt as string,
          ...(this.deps.completionCodePepper === undefined
            ? {}
            : { pepper: this.deps.completionCodePepper }),
        });
        await tx.completionCodeAttempt.create({
          data: {
            id: randomUUID(),
            completionCodeId: active.id,
            orderId: order.id,
            actorUserId: input.actorUserId,
            success: ok,
          },
        });
        await tx.orderEvent.create({
          data: {
            id: randomUUID(),
            orderId: order.id,
            type: "CODE_ATTEMPT",
            actorUserId: input.actorUserId,
            payload: { success: ok },
          },
        });
        if (!ok) {
          const used = active.attemptsUsed + 1;
          await tx.completionCode.update({
            where: { id: active.id },
            data: { attemptsUsed: used },
          });
          // Return structured failure so the attempt row commits with the unit of work.
          return {
            __ordersFailure: true as const,
            code: used >= active.maxAttempts ? "ORDER_CODE_LOCKED" : "ORDER_CODE_INVALID",
          };
        }
        await tx.completionCode.update({
          where: { id: active.id },
          data: {
            status: "CONSUMED",
            consumedAt: now,
            attemptsUsed: active.attemptsUsed + 1,
          },
        });
        const updated = await this.applyStatusChange(tx, {
          order,
          toStatus: "COMPLETED",
          actorUserId: input.actorUserId,
          actorRole: role,
          timestampField: "completedAt",
          now,
        });
        await tx.orderNotificationIntent.create({
          data: {
            id: randomUUID(),
            orderId: order.id,
            templateKey: "ORDER_COMPLETED",
            recipientUserId: order.customerUserId,
            payload: { orderId: order.id, status: "COMPLETED" },
            deliveryStatus: "PENDING",
          },
        });
        return this.toDossier(updated);
      },
    }).then((result) => {
      if (
        result !== null &&
        typeof result === "object" &&
        "__ordersFailure" in result &&
        (result as { __ordersFailure?: boolean }).__ordersFailure === true
      ) {
        throw ordersError(
          (result as { code: "ORDER_CODE_LOCKED" | "ORDER_CODE_INVALID" }).code,
        );
      }
      return result as OrderDossier;
    });
  }

  public async resendCompletionCode(input: {
    readonly orderId: string;
    readonly actorUserId: string;
    readonly idempotencyKey: string;
  }): Promise<OrderDossier> {
    const orderProbe = await this.requireOrder(input.orderId);
    await this.requireFieldActor(orderProbe, input.actorUserId);
    return this.withActorIdempotency({
      orderId: input.orderId,
      actorUserId: input.actorUserId,
      commandType: "RESEND_COMPLETION_CODE",
      idempotencyKey: input.idempotencyKey,
      request: { orderId: input.orderId },
      run: async (tx) => {
        const order = requirePresent(
          await tx.order.findUnique({ where: { id: input.orderId } }),
          () => ordersError("ORDER_NOT_FOUND"),
        );
        failWhen(order.status !== "READY_TO_COMPLETE", () =>
          ordersError("ORDER_TRANSITION_ILLEGAL", {
            reason: "RESEND_REQUIRES_READY_TO_COMPLETE",
          }),
        );
        const now = this.deps.now();
        const prior = await tx.completionCode.findFirst({
          where: { orderId: order.id, status: "ACTIVE" },
        });
        if (prior !== null) {
          await tx.completionCode.update({
            where: { id: prior.id },
            data: { status: "SUPERSEDED" },
          });
        }
        const issued = issueCompletionCode({
          now,
          ...(this.deps.completionCodeTtlSeconds === undefined
            ? {}
            : { ttlSeconds: this.deps.completionCodeTtlSeconds }),
          ...(this.deps.completionCodeMaxAttempts === undefined
            ? {}
            : { maxAttempts: this.deps.completionCodeMaxAttempts }),
          ...(this.deps.completionCodePepper === undefined
            ? {}
            : { pepper: this.deps.completionCodePepper }),
        });
        await tx.completionCode.create({
          data: {
            id: randomUUID(),
            orderId: order.id,
            codeHash: issued.codeHash,
            codeSalt: issued.codeSalt,
            status: "ACTIVE",
            expiresAt: issued.expiresAt,
            maxAttempts: issued.maxAttempts,
            attemptsUsed: 0,
            issuedAt: now,
            supersedesCodeId: prior?.id ?? null,
          },
        });
        await tx.orderEvent.create({
          data: {
            id: randomUUID(),
            orderId: order.id,
            type: "CODE_RESENT",
            actorUserId: input.actorUserId,
            payload: { expiresAt: issued.expiresAt.toISOString() },
          },
        });
        await tx.orderNotificationIntent.create({
          data: {
            id: randomUUID(),
            orderId: order.id,
            templateKey: "ORDER_READY_TO_COMPLETE",
            recipientUserId: order.customerUserId,
            payload: {
              orderId: order.id,
              status: "READY_TO_COMPLETE",
              completionCode: issued.plaintext,
            },
            deliveryStatus: "PENDING",
          },
        });
        return this.toDossier(order);
      },
    });
  }

  public async attachMedia(input: {
    readonly orderId: string;
    readonly actorUserId: string;
    readonly mediaFileId: string;
    readonly kind: "PROGRESS" | "COMPLETION";
    readonly idempotencyKey: string;
  }): Promise<OrderMediaItem> {
    const orderProbe = await this.requireOrder(input.orderId);
    await this.requireFieldActor(orderProbe, input.actorUserId);
    return this.withActorIdempotency({
      orderId: input.orderId,
      actorUserId: input.actorUserId,
      commandType: "ATTACH_MEDIA",
      idempotencyKey: input.idempotencyKey,
      request: {
        orderId: input.orderId,
        mediaFileId: input.mediaFileId,
        kind: input.kind,
      },
      run: async (tx) => {
        const order = requirePresent(
          await tx.order.findUnique({ where: { id: input.orderId } }),
          () => ordersError("ORDER_NOT_FOUND"),
        );
        failWhen(
          order.status === "CANCELLED" || order.status === "COMPLETED",
          () => ordersError("ORDER_ALREADY_TERMINAL"),
        );
        const row = await tx.orderMedia.create({
          data: {
            id: randomUUID(),
            orderId: order.id,
            mediaFileId: input.mediaFileId,
            kind: input.kind,
            uploadedByUserId: input.actorUserId,
          },
        });
        await tx.orderEvent.create({
          data: {
            id: randomUUID(),
            orderId: order.id,
            type: "MEDIA_ATTACHED",
            actorUserId: input.actorUserId,
            payload: { mediaFileId: input.mediaFileId, kind: input.kind },
          },
        });
        return {
          mediaId: row.id,
          mediaFileId: row.mediaFileId,
          kind: row.kind,
          uploadedByUserId: row.uploadedByUserId,
          createdAt: row.createdAt.toISOString(),
        };
      },
    });
  }

  public async addNote(input: {
    readonly orderId: string;
    readonly actorUserId: string;
    readonly body: string;
    readonly idempotencyKey: string;
  }): Promise<{ readonly noteId: string; readonly createdAt: string }> {
    const orderProbe = await this.requireOrder(input.orderId);
    await this.requireFieldActor(orderProbe, input.actorUserId);
    return this.withActorIdempotency({
      orderId: input.orderId,
      actorUserId: input.actorUserId,
      commandType: "ADD_NOTE",
      idempotencyKey: input.idempotencyKey,
      request: { orderId: input.orderId, body: input.body },
      run: async (tx) => {
        const order = requirePresent(
          await tx.order.findUnique({ where: { id: input.orderId } }),
          () => ordersError("ORDER_NOT_FOUND"),
        );
        failWhen(order.status === "CANCELLED", () =>
          ordersError("ORDER_ALREADY_TERMINAL"),
        );
        const row = await tx.orderNote.create({
          data: {
            id: randomUUID(),
            orderId: order.id,
            body: input.body,
            authorUserId: input.actorUserId,
          },
        });
        await tx.orderEvent.create({
          data: {
            id: randomUUID(),
            orderId: order.id,
            type: "NOTE_ADDED",
            actorUserId: input.actorUserId,
            payload: { noteId: row.id },
          },
        });
        return { noteId: row.id, createdAt: row.createdAt.toISOString() };
      },
    });
  }

  public async listMedia(input: {
    readonly orderId: string;
    readonly actorUserId: string;
  }): Promise<readonly OrderMediaItem[]> {
    const order = await this.requireOrder(input.orderId);
    const role = await this.requireReadAccess(order, input.actorUserId);
    const rows = await clientOf(this.deps).orderMedia.findMany({
      where: { orderId: order.id },
      orderBy: { createdAt: "asc" },
    });
    return rows
      .filter((row) =>
        canViewCompletionMedia({
          role,
          orderStatus: order.status,
          kind: row.kind,
        }),
      )
      .map((row) => ({
        mediaId: row.id,
        mediaFileId: row.mediaFileId,
        kind: row.kind,
        uploadedByUserId: row.uploadedByUserId,
        createdAt: row.createdAt.toISOString(),
      }));
  }

  public async getTimeline(input: {
    readonly orderId: string;
    readonly actorUserId: string;
  }): Promise<readonly OrderTimelineItem[]> {
    const order = await this.requireOrder(input.orderId);
    await this.requireReadAccess(order, input.actorUserId);
    const events = await clientOf(this.deps).orderEvent.findMany({
      where: { orderId: order.id },
      orderBy: { createdAt: "asc" },
    });
    return events.map((event) => ({
      type: event.type,
      createdAt: event.createdAt.toISOString(),
      actorUserId: event.actorUserId,
      payload: redactPayload(event.payload as Record<string, unknown>),
    }));
  }

  /**
   * @desc Cancel non-terminal order when linked booking cancels (no fees).
   */
  public async cancelOrderForBooking(input: {
    readonly bookingId: string;
    readonly actorUserId?: string | null;
  }): Promise<{ readonly cancelled: boolean; readonly orderId?: string }> {
    const db = clientOf(this.deps);
    const order = await db.order.findUnique({
      where: { bookingId: input.bookingId },
    });
    if (order === null) {
      return { cancelled: false };
    }
    if (!canCancelFromBooking(order.status)) {
      return { cancelled: false, orderId: order.id };
    }
    const now = this.deps.now();
    const actorUserId = input.actorUserId ?? "system";
    let cancelled = false;
    await db.$transaction(async (tx) => {
      const claimed = await tx.order.updateMany({
        where: {
          id: order.id,
          status: {
            in: ["ASSIGNED", "ON_THE_WAY", "IN_PROGRESS", "READY_TO_COMPLETE"],
          },
        },
        data: {
          status: "CANCELLED",
          cancelledAt: now,
          updatedAt: now,
        },
      });
      if (claimed.count !== 1) {
        return;
      }
      cancelled = true;
      await tx.orderStatusHistory.create({
        data: {
          id: randomUUID(),
          orderId: order.id,
          fromStatus: order.status,
          toStatus: "CANCELLED",
          actorUserId,
          actorRole: "BOOKING_CANCEL",
          reasonCode: "BOOKING_CANCELLED",
        },
      });
      await tx.orderEvent.create({
        data: {
          id: randomUUID(),
          orderId: order.id,
          type: "CANCELLED",
          actorUserId,
          payload: { reason: "BOOKING_CANCELLED" },
        },
      });
      const active = await tx.completionCode.findFirst({
        where: { orderId: order.id, status: "ACTIVE" },
      });
      if (active !== null) {
        await tx.completionCode.update({
          where: { id: active.id },
          data: { status: "SUPERSEDED" },
        });
      }
    });
    return cancelled
      ? { cancelled: true, orderId: order.id }
      : { cancelled: false, orderId: order.id };
  }

  private async runFieldTransition(input: {
    readonly orderId: string;
    readonly actorUserId: string;
    readonly idempotencyKey: string;
    readonly commandType:
      | "TRANSITION_ON_THE_WAY"
      | "TRANSITION_IN_PROGRESS"
      | "TRANSITION_READY_TO_COMPLETE";
    readonly toStatus: OrderStatusName;
    readonly timestampField: "onTheWayAt" | "inProgressAt" | "readyToCompleteAt";
    readonly notifyTemplate: "ORDER_ON_THE_WAY" | "ORDER_READY_TO_COMPLETE" | null;
    readonly includeCodeInIntent: boolean;
  }): Promise<OrderDossier> {
    const orderProbe = await this.requireOrder(input.orderId);
    const role = await this.requireFieldActor(orderProbe, input.actorUserId);
    return this.withActorIdempotency({
      orderId: input.orderId,
      actorUserId: input.actorUserId,
      commandType: input.commandType,
      idempotencyKey: input.idempotencyKey,
      request: { orderId: input.orderId, toStatus: input.toStatus },
      run: async (tx) => {
        const order = requirePresent(
          await tx.order.findUnique({ where: { id: input.orderId } }),
          () => ordersError("ORDER_NOT_FOUND"),
        );
        failWhen(!isLegalForwardTransition(order.status, input.toStatus), () =>
          ordersError("ORDER_TRANSITION_ILLEGAL", {
            from: order.status,
            to: input.toStatus,
          }),
        );
        const now = this.deps.now();
        const updated = await this.applyStatusChange(tx, {
          order,
          toStatus: input.toStatus,
          actorUserId: input.actorUserId,
          actorRole: role,
          timestampField: input.timestampField,
          now,
        });
        let plaintext: string | undefined;
        if (input.includeCodeInIntent) {
          const prior = await tx.completionCode.findFirst({
            where: { orderId: order.id, status: "ACTIVE" },
          });
          if (prior !== null) {
            await tx.completionCode.update({
              where: { id: prior.id },
              data: { status: "SUPERSEDED" },
            });
          }
          const issued = issueCompletionCode({
            now,
            ...(this.deps.completionCodeTtlSeconds === undefined
              ? {}
              : { ttlSeconds: this.deps.completionCodeTtlSeconds }),
            ...(this.deps.completionCodeMaxAttempts === undefined
              ? {}
              : { maxAttempts: this.deps.completionCodeMaxAttempts }),
            ...(this.deps.completionCodePepper === undefined
              ? {}
              : { pepper: this.deps.completionCodePepper }),
          });
          plaintext = issued.plaintext;
          await tx.completionCode.create({
            data: {
              id: randomUUID(),
              orderId: order.id,
              codeHash: issued.codeHash,
              codeSalt: issued.codeSalt,
              status: "ACTIVE",
              expiresAt: issued.expiresAt,
              maxAttempts: issued.maxAttempts,
              attemptsUsed: 0,
              issuedAt: now,
              supersedesCodeId: prior?.id ?? null,
            },
          });
          await tx.orderEvent.create({
            data: {
              id: randomUUID(),
              orderId: order.id,
              type: "CODE_ISSUED",
              actorUserId: input.actorUserId,
              payload: { expiresAt: issued.expiresAt.toISOString() },
            },
          });
        }
        if (input.notifyTemplate !== null) {
          await tx.orderNotificationIntent.create({
            data: {
              id: randomUUID(),
              orderId: order.id,
              templateKey: input.notifyTemplate,
              recipientUserId: order.customerUserId,
              payload: {
                orderId: order.id,
                status: input.toStatus,
                ...(plaintext === undefined
                  ? {}
                  : { completionCode: plaintext }),
              },
              deliveryStatus: "PENDING",
            },
          });
        }
        return this.toDossier(updated);
      },
    });
  }

  private async applyStatusChange(
    tx: OrdersTx,
    input: {
      readonly order: any;
      readonly toStatus: OrderStatusName;
      readonly actorUserId: string;
      readonly actorRole: OrderActorRole | string;
      readonly timestampField:
        | "onTheWayAt"
        | "inProgressAt"
        | "readyToCompleteAt"
        | "completedAt";
      readonly now: Date;
    },
  ): Promise<any> {
    const fromStatus = input.order.status as OrderStatusName;
    const claimed = await tx.order.updateMany({
      where: { id: input.order.id, status: fromStatus },
      data: {
        status: input.toStatus,
        [input.timestampField]: input.now,
        updatedAt: input.now,
      },
    });
    failWhen(claimed.count !== 1, () =>
      ordersError("ORDER_TRANSITION_ILLEGAL", {
        from: fromStatus,
        to: input.toStatus,
        reason: "STATUS_CAS_LOST",
      }),
    );
    const updated = requirePresent(
      await tx.order.findUnique({ where: { id: input.order.id } }),
      () => ordersError("ORDER_NOT_FOUND"),
    );
    await tx.orderStatusHistory.create({
      data: {
        id: randomUUID(),
        orderId: input.order.id,
        fromStatus,
        toStatus: input.toStatus,
        actorUserId: input.actorUserId,
        actorRole: String(input.actorRole),
      },
    });
    await tx.orderEvent.create({
      data: {
        id: randomUUID(),
        orderId: input.order.id,
        type: "STATUS_CHANGED",
        actorUserId: input.actorUserId,
        payload: {
          fromStatus,
          toStatus: input.toStatus,
        },
      },
    });
    return updated;
  }

  private async withActorIdempotency<T>(input: {
    readonly orderId: string;
    readonly actorUserId: string;
    readonly commandType: string;
    readonly idempotencyKey: string;
    readonly request: unknown;
    readonly run: (tx: OrdersTx) => Promise<T>;
  }): Promise<T> {
    const db = clientOf(this.deps);
    const requestHash = requestHashOf(input.request);
    const existing = await db.orderActorCommand.findUnique({
      where: {
        orderId_actorUserId_commandType_idempotencyKey: {
          orderId: input.orderId,
          actorUserId: input.actorUserId,
          commandType: input.commandType,
          idempotencyKey: input.idempotencyKey,
        },
      },
    });
    if (existing !== null) {
      failWhen(existing.requestHash !== requestHash, () =>
        ordersError("ORDER_IDEMPOTENCY_CONFLICT"),
      );
      return existing.responseJson as T;
    }
    return db.$transaction(async (tx) => {
      const raced = await tx.orderActorCommand.findUnique({
        where: {
          orderId_actorUserId_commandType_idempotencyKey: {
            orderId: input.orderId,
            actorUserId: input.actorUserId,
            commandType: input.commandType,
            idempotencyKey: input.idempotencyKey,
          },
        },
      });
      if (raced !== null) {
        failWhen(raced.requestHash !== requestHash, () =>
          ordersError("ORDER_IDEMPOTENCY_CONFLICT"),
        );
        return raced.responseJson as T;
      }
      const result = await input.run(tx);
      if (
        result !== null &&
        typeof result === "object" &&
        "__ordersFailure" in (result as object) &&
        (result as { __ordersFailure?: boolean }).__ordersFailure === true
      ) {
        return result;
      }
      await tx.orderActorCommand.create({
        data: {
          id: randomUUID(),
          orderId: input.orderId,
          actorUserId: input.actorUserId,
          commandType: input.commandType,
          idempotencyKey: input.idempotencyKey,
          requestHash,
          responseJson: result as object,
        },
      });
      return result;
    });
  }

  private async requireOrder(orderId: string): Promise<any> {
    return requirePresent(
      await clientOf(this.deps).order.findUnique({ where: { id: orderId } }),
      () => ordersError("ORDER_NOT_FOUND"),
    );
  }

  private async toDossier(order: any): Promise<OrderDossier> {
    const active = await clientOf(this.deps).completionCode.findFirst({
      where: { orderId: order.id, status: "ACTIVE" },
    });
    return dossierOf({ ...order, activeCompletionCode: active });
  }

  private async resolveRoleFromActivation(
    facts: BookingOrderActivationFacts,
    actorUserId: string,
  ): Promise<OrderActorRole> {
    const members = facts.activeAssignment?.members ?? [];
    let isProviderManager = false;
    try {
      await this.deps.assertActiveProviderManager(
        facts.providerId,
        actorUserId,
      );
      isProviderManager = true;
    } catch {
      isProviderManager = false;
    }
    const isStaff = await this.deps.isStaffAdmin(actorUserId);
    return classifyOrderActor({
      actorUserId,
      facts: {
        providerId: facts.providerId,
        customerUserId: facts.customerUserId,
        activeMembers: members,
      },
      isProviderManager,
      isStaff,
    });
  }

  private async resolveRole(
    order: any,
    actorUserId: string,
  ): Promise<OrderActorRole> {
    const facts = await this.deps.readBookingActivation(order.bookingId);
    if (facts === null) {
      return classifyOrderActor({
        actorUserId,
        facts: {
          providerId: order.providerId,
          customerUserId: order.customerUserId,
          activeMembers: [],
        },
        isProviderManager: false,
        isStaff: await this.deps.isStaffAdmin(actorUserId),
      });
    }
    return this.resolveRoleFromActivation(facts, actorUserId);
  }

  private async requireReadAccessForActivation(
    facts: BookingOrderActivationFacts,
    actorUserId: string,
  ): Promise<OrderActorRole> {
    const role = await this.resolveRoleFromActivation(facts, actorUserId);
    failWhen(!canReadOrder(role), () => ordersError("ORDER_FORBIDDEN"));
    return role;
  }

  private async requireReadAccess(
    order: any,
    actorUserId: string,
  ): Promise<OrderActorRole> {
    const role = await this.resolveRole(order, actorUserId);
    failWhen(!canReadOrder(role), () => ordersError("ORDER_FORBIDDEN"));
    return role;
  }

  private async requireFieldActor(
    order: any,
    actorUserId: string,
  ): Promise<OrderActorRole> {
    const role = await this.resolveRole(order, actorUserId);
    failWhen(!isFieldActor(role), () => ordersError("ORDER_FORBIDDEN"));
    return role;
  }
}

function redactPayload(
  payload: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  const next: Record<string, unknown> = { ...payload };
  delete next["completionCode"];
  delete next["code"];
  delete next["plaintext"];
  return next;
}

/**
 * @desc Factory for OrdersService.
 * @access Composition / Orders module
 */
export function createOrdersService(
  dependencies: OrdersServiceDependencies,
): OrdersService {
  return new OrdersService({
    ...dependencies,
    completionCodeTtlSeconds:
      dependencies.completionCodeTtlSeconds ??
      DEFAULT_COMPLETION_CODE_TTL_SECONDS,
    completionCodeMaxAttempts:
      dependencies.completionCodeMaxAttempts ??
      DEFAULT_COMPLETION_CODE_MAX_ATTEMPTS,
  });
}
