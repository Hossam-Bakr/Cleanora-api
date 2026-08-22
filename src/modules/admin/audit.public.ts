/**
 * Approved public audit surface for cross-module consumers.
 * Re-exports business-neutral general transactional and denial audit contracts.
 * Infrastructure Prisma factories stay composed at the application root —
 * Providers and other modules must never import `admin/infrastructure/*`.
 */
export const ADMIN_AUDIT_PUBLIC_CONTRACT = "admin.audit.public" as const;

export interface PayoutRevealAuditGate {
  commitAcceptedReveal(input: {
    readonly actorUserId: string;
    readonly providerId: string;
    readonly destinationVersionId: string;
    readonly expectedVersion: number;
    readonly purpose: "MANUAL_PAYOUT_DESTINATION_VERIFICATION";
    readonly reasonCode: string;
    readonly requestId: string;
    readonly encryptionKeyIds: readonly string[];
    readonly lookupKeyIds: readonly string[];
    readonly now: Date;
  }): Promise<
    | { readonly accepted: true; readonly attemptId: string; readonly acceptedAt: Date }
    | { readonly accepted: false; readonly safeCode: "PAYOUT_REVEAL_RATE_LIMITED" }
  >;
  appendDeniedReveal(input: {
    readonly actorUserId: string | null;
    readonly providerId: string;
    readonly destinationVersionId: string;
    readonly expectedVersion: number;
    readonly purpose: "MANUAL_PAYOUT_DESTINATION_VERIFICATION";
    readonly safeReason: string;
    readonly safeCode: string;
    readonly requestId: string;
    readonly encryptionKeyIds?: readonly string[];
    readonly lookupKeyIds?: readonly string[];
    readonly now: Date;
  }): Promise<void>;
}

export interface TransactionalAcceptedPayoutRevealAuthorizer {
  authorize(input: {
    readonly attemptId: string;
    readonly actorUserId: string;
    readonly providerId: string;
    readonly destinationVersionId: string;
    readonly expectedVersion: number;
    readonly purpose: "MANUAL_PAYOUT_DESTINATION_VERIFICATION";
  }): Promise<boolean>;
}

export type TransactionalAcceptedPayoutRevealAuthorizerFactory = (
  transaction: unknown,
) => TransactionalAcceptedPayoutRevealAuthorizer;

export type {
  AuditActorType,
  DenialAuditAck,
  DenialAuditWriter,
  GeneralTransactionalAuditAck,
  GeneralTransactionalAuditWriter,
  PrivilegedAuditWriter,
  SafeAuditContext,
  SafeDenialAuditInput,
  SafeJsonPrimitive,
  SafeJsonValue,
  WriteAuditInput,
} from "./audit.service.js";

export {
  assertSafeAuditInput,
  assertSafeDenialAuditInput,
} from "./audit.service.js";
