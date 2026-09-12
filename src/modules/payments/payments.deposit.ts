import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import type {
  BookingFinancialSnapshotReader,
  ConfirmDepositPayment,
} from "#modules/bookings/bookings.public";

import type { PaymentGatewayPort } from "./adapters/payment-gateway.port.js";
import { paymentsError } from "./payments.errors.js";
import { compareMinorUnits, requirePositiveMinorUnits } from "./payments.money.js";
import type {
  BrowserReturnStatus,
  InitiateDepositResult,
  PaymentMethodPublic,
  PaymentPublicView,
} from "./payments.public.js";
import type { PaymentsUnitOfWork } from "./payments.repository.js";
import { PaymentsIdempotencyCollision } from "./payments.repository.js";

export interface DepositWorkflowDependencies {
  readonly unitOfWork: PaymentsUnitOfWork;
  readonly bookingReader: BookingFinancialSnapshotReader;
  readonly gateway: PaymentGatewayPort;
  readonly confirmDepositPayment: ConfirmDepositPayment;
  readonly returnTokenSecret: string;
  readonly isStaffAdmin?: (userId: string) => Promise<boolean>;
  readonly clock?: () => Date;
  readonly activeCountryExists?: (countryId: string) => Promise<boolean>;
}

/**
 * @desc Deposit / methods / webhook / receipt / refund foundation workflows.
 * @access Payments application
 */
export function createDepositWorkflows(dependencies: DepositWorkflowDependencies) {
  const now = dependencies.clock ?? (() => new Date());

  return {
    async listEnabledMethodsForCountry(input: {
      readonly countryId: string;
    }): Promise<readonly PaymentMethodPublic[]> {
      if (input.countryId.trim().length === 0) {
        throw paymentsError("VALIDATION_FAILED", { field: "countryId" });
      }
      if (dependencies.activeCountryExists !== undefined) {
        const exists = await dependencies.activeCountryExists(input.countryId);
        if (!exists) {
          throw paymentsError("NOT_FOUND", { reason: "COUNTRY" });
        }
      }
      return dependencies.unitOfWork.run(async (repository) => {
        const rows = await repository.listEnabledPaymentMethods(input.countryId);
        return rows.map(toMethodPublic);
      });
    },

    async initiateBookingDeposit(input: {
      readonly actorUserId: string;
      readonly bookingId: string;
      readonly paymentMethodId: string;
      readonly idempotencyKey: string;
    }): Promise<InitiateDepositResult> {
      if (
        input.actorUserId.trim().length === 0 ||
        input.bookingId.trim().length === 0 ||
        input.paymentMethodId.trim().length === 0 ||
        input.idempotencyKey.trim().length === 0 ||
        input.idempotencyKey.length > 128
      ) {
        throw paymentsError("VALIDATION_FAILED");
      }

      const booking = await dependencies.bookingReader.readById({
        bookingId: input.bookingId,
      });
      if (booking === null || booking.customerUserId !== input.actorUserId) {
        throw paymentsError("NOT_FOUND");
      }
      if (booking.status !== "AWAITING_DEPOSIT") {
        throw paymentsError("TRANSITION_NOT_AVAILABLE", {
          status: booking.status,
        });
      }
      if (
        booking.depositMinorUnits === null ||
        booking.depositMinorUnits.length === 0
      ) {
        throw paymentsError("DEPENDENCY_FAILURE", { reason: "DEPOSIT_MISSING" });
      }
      const depositAmount = requirePositiveMinorUnits(booking.depositMinorUnits);

      return dependencies.unitOfWork.run(async (repository) => {
        const succeeded = await repository.findSucceededDepositPayment(
          input.bookingId,
        );
        if (succeeded !== null) {
          throw paymentsError("PAYMENT_ALREADY_SUCCEEDED");
        }

        const existing = await repository.findAttemptByIdempotency({
          customerUserId: input.actorUserId,
          bookingId: input.bookingId,
          idempotencyKey: input.idempotencyKey,
        });
        if (existing !== null) {
          if (existing.paymentMethodId !== input.paymentMethodId) {
            throw paymentsError("IDEMPOTENCY_CONFLICT");
          }
          const payment = await repository.findPaymentById(existing.paymentId);
          if (payment === null || payment.customerUserId !== input.actorUserId) {
            throw paymentsError("NOT_FOUND");
          }
          return presentInitiate(existing, payment, replayReturnToken(existing, dependencies.returnTokenSecret));
        }

        const method = await repository.findPaymentMethodById(
          input.paymentMethodId,
        );
        if (
          method === null ||
          !method.enabled ||
          method.provider !== "PAYMOB" ||
          (method.methodKind !== "CARD" && method.methodKind !== "WALLET")
        ) {
          throw paymentsError("VALIDATION_FAILED", { reason: "METHOD" });
        }
        if (method.countryId !== booking.countryId) {
          throw paymentsError("VALIDATION_FAILED", { reason: "COUNTRY_METHOD" });
        }

        // Re-read ownership: booking must belong to actor. Snapshot reader may
        // not include customerUserId; confirm via initiate ownership check by
        // requiring actor match when payment rows are created.
        const paymentId = randomUUID();
        const attemptId = randomUUID();
        const payment = await repository.insertPayment({
          id: paymentId,
          bookingId: input.bookingId,
          customerUserId: input.actorUserId,
          purpose: "BOOKING_DEPOSIT",
          status: "PENDING",
          amountMinorUnits: depositAmount,
          currencyCode: booking.currencyCode,
          currencyDecimalPlaces: booking.currencyDecimalPlaces,
          paymentMethodId: method.id,
        });

        let attempt;
        try {
          attempt = await repository.insertAttempt({
            id: attemptId,
            paymentId: payment.id,
            bookingId: input.bookingId,
            customerUserId: input.actorUserId,
            paymentMethodId: method.id,
            status: "CREATED",
            amountMinorUnits: depositAmount,
            currencyCode: booking.currencyCode,
            currencyDecimalPlaces: booking.currencyDecimalPlaces,
            idempotencyKey: input.idempotencyKey,
          });
        } catch (error) {
          if (error instanceof PaymentsIdempotencyCollision) {
            const raced = await repository.findAttemptByIdempotency({
              customerUserId: input.actorUserId,
              bookingId: input.bookingId,
              idempotencyKey: input.idempotencyKey,
            });
            if (raced === null) {
              throw paymentsError("IDEMPOTENCY_CONFLICT");
            }
            const racedPayment = await repository.findPaymentById(raced.paymentId);
            if (racedPayment === null) {
              throw paymentsError("NOT_FOUND");
            }
            return presentInitiate(
              raced,
              racedPayment,
              replayReturnToken(raced, dependencies.returnTokenSecret),
            );
          }
          throw error;
        }

        const returnToken = issueReturnToken({
          attemptId: attempt.id,
          paymentId: payment.id,
          customerUserId: input.actorUserId,
          secret: dependencies.returnTokenSecret,
        });
        const returnTokenHash = hashToken(returnToken);
        const returnUrl = `payments/return?attemptId=${encodeURIComponent(attempt.id)}&paymentId=${encodeURIComponent(payment.id)}&returnToken=${encodeURIComponent(returnToken)}`;

        let session;
        try {
          session = await dependencies.gateway.createDepositSession({
            attemptId: attempt.id,
            paymentId: payment.id,
            amountMinorUnits: depositAmount,
            currencyCode: booking.currencyCode,
            customerReference: input.actorUserId,
            returnUrl,
            methodKind: method.methodKind === "WALLET" ? "WALLET" : "CARD",
          });
        } catch (error) {
          if (isPaymentsErrorCode(error, "GATEWAY_MISCONFIGURED")) {
            throw error;
          }
          throw paymentsError("GATEWAY_MISCONFIGURED", {
            cause: error instanceof Error ? error.message : "gateway",
          });
        }

        await repository.updateAttemptGateway({
          attemptId: attempt.id,
          status: "REDIRECTED",
          gatewaySessionRef: session.sessionRef,
          redirectUrl: session.redirectUrl,
          returnTokenHash,
        });

        const updatedAttempt = {
          ...attempt,
          status: "REDIRECTED" as const,
          gatewaySessionRef: session.sessionRef,
          redirectUrl: session.redirectUrl,
          returnTokenHash,
        };
        return presentInitiate(updatedAttempt, payment, returnToken);
      });
    },

    async getBrowserReturnStatus(input: {
      readonly actorUserId?: string;
      readonly paymentId?: string;
      readonly attemptId?: string;
      readonly returnToken?: string;
    }): Promise<BrowserReturnStatus> {
      return dependencies.unitOfWork.run(async (repository) => {
        const attempt =
          input.attemptId === undefined
            ? null
            : await repository.findAttemptById(input.attemptId);
        let payment =
          input.paymentId === undefined
            ? null
            : await repository.findPaymentById(input.paymentId);

        if (attempt === null && payment !== null) {
          // No mutation — status projection only.
        }
        if (attempt !== null && payment === null) {
          payment = await repository.findPaymentById(attempt.paymentId);
        }
        if (attempt === null && payment === null) {
          throw paymentsError("NOT_FOUND");
        }

        if (input.returnToken !== undefined && attempt !== null) {
          const expectedHash = attempt.returnTokenHash;
          if (
            expectedHash === null ||
            !tokenHashesEqual(hashToken(input.returnToken), expectedHash)
          ) {
            throw paymentsError("FORBIDDEN");
          }
        } else if (input.actorUserId !== undefined && payment !== null) {
          if (payment.customerUserId !== input.actorUserId) {
            throw paymentsError("NOT_FOUND");
          }
        } else if (input.returnToken === undefined) {
          throw paymentsError("AUTHENTICATION_REQUIRED");
        }

        const booking = await dependencies.bookingReader.readById({
          bookingId: (payment ?? attempt)!.bookingId,
        });
        return {
          paymentId: payment?.id ?? null,
          attemptId: attempt?.id ?? null,
          paymentStatus: payment?.status ?? "UNKNOWN",
          bookingStatus: booking?.status ?? "UNKNOWN",
          message: "Browser return is status-only; webhook remains payment authority",
        };
      });
    },

    async processPaymobWebhook(input: {
      readonly rawBody: Buffer;
      readonly signatureHeader: string | undefined;
    }): Promise<{ readonly replayed: boolean; readonly paymentId?: string }> {
      const signatureValid = dependencies.gateway.verifyWebhookSignature(input);
      if (!signatureValid) {
        throw paymentsError("WEBHOOK_SIGNATURE_INVALID");
      }

      let parsed;
      try {
        parsed = dependencies.gateway.parseWebhookEvent({
          rawBody: input.rawBody,
        });
      } catch {
        throw paymentsError("VALIDATION_FAILED", { reason: "WEBHOOK_BODY" });
      }

      const payloadHash = createHash("sha256").update(input.rawBody).digest("hex");
      const clock = now();

      // First transaction: claim event + succeed payment + journal + receipt.
      const pipeline = await dependencies.unitOfWork.run(async (repository) => {
        const existing = await repository.findGatewayEvent(
          "PAYMOB",
          parsed.idempotencyKey,
        );
        if (existing !== null) {
          return {
            replayed: true as const,
            paymentId: existing.paymentId ?? undefined,
            confirm: null as null | {
              bookingId: string;
              paymentId: string;
              amountMinorUnits: string;
              currencyCode: string;
            },
          };
        }

        let event;
        try {
          event = await repository.insertGatewayEvent({
            id: randomUUID(),
            provider: "PAYMOB",
            idempotencyKey: parsed.idempotencyKey,
            eventType: parsed.eventType,
            signatureValid: true,
            status: "RECEIVED",
            payloadHash,
          });
        } catch (error) {
          if (error instanceof PaymentsIdempotencyCollision) {
            const raced = await repository.findGatewayEvent(
              "PAYMOB",
              parsed.idempotencyKey,
            );
            return {
              replayed: true as const,
              paymentId: raced?.paymentId ?? undefined,
              confirm: null,
            };
          }
          throw error;
        }

        if (
          parsed.sessionRef === undefined ||
          parsed.sessionRef.trim().length === 0
        ) {
          await repository.markGatewayEventProcessed({
            eventId: event.id,
            status: "IGNORED",
            processedAt: clock,
          });
          return { replayed: false as const, confirm: null };
        }

        const attempt = await repository.findAttemptByGatewaySessionRef(
          parsed.sessionRef,
        );
        if (attempt === null) {
          await repository.markGatewayEventProcessed({
            eventId: event.id,
            status: "IGNORED",
            processedAt: clock,
          });
          return { replayed: false as const, confirm: null };
        }

        const payment = await repository.findPaymentById(attempt.paymentId);
        if (payment === null) {
          await repository.markGatewayEventProcessed({
            eventId: event.id,
            status: "IGNORED",
            paymentAttemptId: attempt.id,
            processedAt: clock,
          });
          return { replayed: false as const, confirm: null };
        }

        if (!parsed.success) {
          await repository.markAttemptTerminal({
            attemptId: attempt.id,
            status: "FAILED",
            failureCode: parsed.failureCode ?? "GATEWAY_DECLINED",
            failureMessageSafe: "Gateway reported unsuccessful payment",
          });
          if (payment.status === "PENDING") {
            await repository.markPaymentFailed(payment.id);
          }
          await repository.markGatewayEventProcessed({
            eventId: event.id,
            status: "PROCESSED",
            paymentAttemptId: attempt.id,
            paymentId: payment.id,
            processedAt: clock,
          });
          return {
            replayed: false as const,
            paymentId: payment.id,
            confirm: null,
          };
        }

        if (payment.status === "SUCCEEDED") {
          await repository.markGatewayEventProcessed({
            eventId: event.id,
            status: "PROCESSED",
            paymentAttemptId: attempt.id,
            paymentId: payment.id,
            processedAt: clock,
          });
          return {
            replayed: false as const,
            paymentId: payment.id,
            confirm: null,
          };
        }

        const booking = await dependencies.bookingReader.readById({
          bookingId: payment.bookingId,
        });
        if (booking === null || booking.status !== "AWAITING_DEPOSIT") {
          throw paymentsError("TRANSITION_NOT_AVAILABLE");
        }
        if (
          booking.depositMinorUnits === null ||
          compareMinorUnits(payment.amountMinorUnits, booking.depositMinorUnits) !==
            0 ||
          payment.currencyCode !== booking.currencyCode
        ) {
          throw paymentsError("AMOUNT_MISMATCH");
        }
        if (
          parsed.amountMinorUnits !== undefined &&
          compareMinorUnits(parsed.amountMinorUnits, payment.amountMinorUnits) !== 0
        ) {
          throw paymentsError("AMOUNT_MISMATCH");
        }
        if (
          parsed.currencyCode !== undefined &&
          parsed.currencyCode !== payment.currencyCode
        ) {
          throw paymentsError("AMOUNT_MISMATCH");
        }

        const already = await repository.findSucceededDepositPayment(
          payment.bookingId,
        );
        if (already !== null && already.id !== payment.id) {
          throw paymentsError("PAYMENT_ALREADY_SUCCEEDED");
        }

        const journalId = randomUUID();
        const accounts = await repository.findAccounts(
          booking.countryId,
          payment.currencyCode,
        );
        const clearing = accounts.find(
          (account) => account.accountType === "PLATFORM_CLEARING",
        );
        const liability = accounts.find(
          (account) => account.accountType === "CUSTOMER_DEPOSIT_LIABILITY",
        );
        if (clearing === undefined || liability === undefined) {
          throw paymentsError("ACCOUNT_NOT_SEEDED");
        }
        const journalIdempotencyKey = `deposit-journal:${payment.id}`;
        const existingJournal = await repository.findIdempotency({
          commandType: "POST_JOURNAL",
          actorKind: "SYSTEM",
          actorId: "payments-webhook",
          idempotencyKey: journalIdempotencyKey,
        });
        let resolvedJournalId = existingJournal?.journalId ?? null;
        if (resolvedJournalId === null) {
          try {
            await repository.insertIdempotency({
              commandType: "POST_JOURNAL",
              actorKind: "SYSTEM",
              actorId: "payments-webhook",
              idempotencyKey: journalIdempotencyKey,
              payloadHash: createHash("sha256")
                .update(`${payment.id}:${payment.amountMinorUnits}`)
                .digest("hex"),
              journalId,
            });
            await repository.insertJournal({
              journalId,
              bookingId: payment.bookingId,
              lines: [
                {
                  id: randomUUID(),
                  accountId: clearing.id,
                  entryType: "DEPOSIT",
                  side: "DEBIT",
                  amountMinorUnits: payment.amountMinorUnits,
                  currencyCode: payment.currencyCode,
                  currencyDecimalPlaces: payment.currencyDecimalPlaces,
                },
                {
                  id: randomUUID(),
                  accountId: liability.id,
                  entryType: "DEPOSIT",
                  side: "CREDIT",
                  amountMinorUnits: payment.amountMinorUnits,
                  currencyCode: payment.currencyCode,
                  currencyDecimalPlaces: payment.currencyDecimalPlaces,
                },
              ],
            });
            resolvedJournalId = journalId;
          } catch (error) {
            if (error instanceof PaymentsIdempotencyCollision) {
              const replay = await repository.findIdempotency({
                commandType: "POST_JOURNAL",
                actorKind: "SYSTEM",
                actorId: "payments-webhook",
                idempotencyKey: journalIdempotencyKey,
              });
              if (replay?.journalId === null || replay?.journalId === undefined) {
                throw paymentsError("IDEMPOTENCY_CONFLICT");
              }
              resolvedJournalId = replay.journalId;
            } else {
              throw error;
            }
          }
        }

        await repository.markAttemptTerminal({
          attemptId: attempt.id,
          status: "SUCCEEDED",
        });
        await repository.markPaymentSucceeded({
          paymentId: payment.id,
          succeededAttemptId: attempt.id,
          ledgerJournalId: resolvedJournalId,
        });

        const method = await repository.findPaymentMethodById(
          payment.paymentMethodId,
        );
        const existingReceipt = await repository.findReceiptByPaymentId(payment.id);
        if (existingReceipt === null) {
          await repository.insertReceipt({
            id: randomUUID(),
            paymentId: payment.id,
            bookingId: payment.bookingId,
            customerUserId: payment.customerUserId,
            amountMinorUnits: payment.amountMinorUnits,
            currencyCode: payment.currencyCode,
            currencyDecimalPlaces: payment.currencyDecimalPlaces,
            methodCode: method?.code ?? "PAYMOB",
            ...(parsed.sessionRef === undefined
              ? {}
              : { providerRef: parsed.sessionRef }),
            issuedAt: clock,
          });
        }

        await repository.markGatewayEventProcessed({
          eventId: event.id,
          status: "PROCESSED",
          paymentAttemptId: attempt.id,
          paymentId: payment.id,
          processedAt: clock,
        });

        return {
          replayed: false as const,
          paymentId: payment.id,
          confirm: {
            bookingId: payment.bookingId,
            paymentId: payment.id,
            amountMinorUnits: payment.amountMinorUnits,
            currencyCode: payment.currencyCode,
          },
        };
      });

      if (pipeline.confirm !== null) {
        await dependencies.confirmDepositPayment({
          bookingId: pipeline.confirm.bookingId,
          paymentId: pipeline.confirm.paymentId,
          expectedDepositMinorUnits: pipeline.confirm.amountMinorUnits,
          currencyCode: pipeline.confirm.currencyCode,
          actorKind: "SYSTEM",
          actorId: "payments-webhook",
          reason: "Verified Paymob deposit webhook",
        });
      }

      return {
        replayed: pipeline.replayed,
        ...(pipeline.paymentId === undefined
          ? {}
          : { paymentId: pipeline.paymentId }),
      };
    },

    async getPaymentForReader(input: {
      readonly paymentId: string;
      readonly reader:
        | { readonly kind: "CUSTOMER"; readonly userId: string }
        | { readonly kind: "STAFF_ADMIN"; readonly userId: string };
    }): Promise<PaymentPublicView> {
      return dependencies.unitOfWork.run(async (repository) => {
        const payment = await repository.findPaymentById(input.paymentId);
        if (payment === null) {
          throw paymentsError("NOT_FOUND");
        }
        if (input.reader.kind === "CUSTOMER") {
          if (payment.customerUserId !== input.reader.userId) {
            throw paymentsError("NOT_FOUND");
          }
        } else if (dependencies.isStaffAdmin !== undefined) {
          const ok = await dependencies.isStaffAdmin(input.reader.userId);
          if (!ok) {
            throw paymentsError("FORBIDDEN");
          }
        }
        const method = await repository.findPaymentMethodById(
          payment.paymentMethodId,
        );
        const receipt = await repository.findReceiptByPaymentId(payment.id);
        return {
          paymentId: payment.id,
          bookingId: payment.bookingId,
          purpose: payment.purpose,
          status: payment.status,
          amountMinorUnits: payment.amountMinorUnits,
          currencyCode: payment.currencyCode,
          currencyDecimalPlaces: payment.currencyDecimalPlaces,
          methodCode: method?.code ?? "UNKNOWN",
          ...(receipt === null
            ? {}
            : {
                receipt: {
                  receiptId: receipt.id,
                  issuedAt: receipt.issuedAt.toISOString(),
                  ...(receipt.providerRef === null
                    ? {}
                    : { providerRef: receipt.providerRef }),
                },
              }),
        };
      });
    },

    async setPaymentMethodEnabled(input: {
      readonly staffUserId: string;
      readonly methodId: string;
      readonly enabled: boolean;
    }): Promise<PaymentMethodPublic> {
      if (dependencies.isStaffAdmin !== undefined) {
        const ok = await dependencies.isStaffAdmin(input.staffUserId);
        if (!ok) {
          throw paymentsError("FORBIDDEN");
        }
      }
      return dependencies.unitOfWork.run(async (repository) => {
        const updated = await repository.setPaymentMethodEnabled(
          input.methodId,
          input.enabled,
        );
        if (updated === null) {
          throw paymentsError("NOT_FOUND");
        }
        return toMethodPublic(updated);
      });
    },

    async createRefundRequest(input: {
      readonly paymentId: string;
      readonly actorKind: string;
      readonly actorId: string;
      readonly reason?: string;
      readonly amountMinorUnits?: string;
    }): Promise<{ readonly refundRequestId: string; readonly status: "REQUESTED" }> {
      return dependencies.unitOfWork.run(async (repository) => {
        const payment = await repository.findPaymentById(input.paymentId);
        if (payment === null) {
          throw paymentsError("NOT_FOUND");
        }
        if (payment.status !== "SUCCEEDED") {
          throw paymentsError("TRANSITION_NOT_AVAILABLE");
        }
        const amount =
          input.amountMinorUnits === undefined
            ? payment.amountMinorUnits
            : requirePositiveMinorUnits(input.amountMinorUnits);
        if (compareMinorUnits(amount, payment.amountMinorUnits) > 0) {
          throw paymentsError("AMOUNT_MISMATCH");
        }
        const row = await repository.insertRefundRequest({
          id: randomUUID(),
          paymentId: payment.id,
          bookingId: payment.bookingId,
          customerUserId: payment.customerUserId,
          amountMinorUnits: amount,
          currencyCode: payment.currencyCode,
          currencyDecimalPlaces: payment.currencyDecimalPlaces,
          ...(input.reason === undefined ? {} : { reason: input.reason }),
          requestedByActorKind: input.actorKind,
          requestedByActorId: input.actorId,
        });
        return { refundRequestId: row.id, status: "REQUESTED" as const };
      });
    },
  };
}

function toMethodPublic(row: {
  readonly id: string;
  readonly countryId: string;
  readonly code: string;
  readonly provider: PaymentMethodPublic["provider"];
  readonly methodKind: PaymentMethodPublic["methodKind"];
  readonly displayNameAr: string;
  readonly displayNameEn: string;
  readonly enabled: boolean;
  readonly sortOrder: number;
}): PaymentMethodPublic {
  return {
    id: row.id,
    countryId: row.countryId,
    code: row.code,
    provider: row.provider,
    methodKind: row.methodKind,
    displayNameAr: row.displayNameAr,
    displayNameEn: row.displayNameEn,
    enabled: row.enabled,
    sortOrder: row.sortOrder,
  };
}

function presentInitiate(
  attempt: {
    readonly id: string;
    readonly status: string;
    readonly amountMinorUnits: string;
    readonly currencyCode: string;
    readonly currencyDecimalPlaces: number;
    readonly gatewaySessionRef: string | null;
    readonly redirectUrl: string | null;
  },
  payment: { readonly id: string },
  returnToken: string,
): InitiateDepositResult {
  const status =
    attempt.status === "REDIRECTED" ||
    attempt.status === "CREATED" ||
    attempt.status === "PENDING"
      ? attempt.status
      : "PENDING";
  return {
    paymentId: payment.id,
    attemptId: attempt.id,
    status,
    amountMinorUnits: attempt.amountMinorUnits,
    currencyCode: attempt.currencyCode,
    currencyDecimalPlaces: attempt.currencyDecimalPlaces,
    gateway: {
      provider: "PAYMOB",
      ...(attempt.redirectUrl === null
        ? {}
        : { redirectUrl: attempt.redirectUrl }),
      ...(attempt.gatewaySessionRef === null
        ? {}
        : { sessionRef: attempt.gatewaySessionRef }),
    },
    returnToken,
  };
}

function issueReturnToken(input: {
  readonly attemptId: string;
  readonly paymentId: string;
  readonly customerUserId: string;
  readonly secret: string;
}): string {
  const payload = `${input.attemptId}.${input.paymentId}.${input.customerUserId}`;
  const sig = createHmac("sha256", input.secret).update(payload).digest("hex");
  return Buffer.from(`${payload}.${sig}`, "utf8").toString("base64url");
}

function replayReturnToken(
  attempt: {
    readonly id: string;
    readonly paymentId: string;
    readonly customerUserId: string;
  },
  secret: string,
): string {
  return issueReturnToken({
    attemptId: attempt.id,
    paymentId: attempt.paymentId,
    customerUserId: attempt.customerUserId,
    secret,
  });
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function isPaymentsErrorCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === code
  );
}

function tokenHashesEqual(left: string, right: string): boolean {
  try {
    const a = Buffer.from(left, "utf8");
    const b = Buffer.from(right, "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
