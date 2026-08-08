import type { DenialAuditWriter } from "#modules/admin/audit.service";
import type { AuthenticationPrincipal } from "#modules/authentication/authentication.public";

import { authorizeContactPrefsPrivacySelf } from "./domain/customer-self.policy.js";
import { customersError } from "./domain/customers.errors.js";
import { canCancelPrivacyRequest } from "./domain/privacy-request.lifecycle.js";
import type { PrivacyRequestPurpose, PrivacyRequestView } from "./domain/customers.types.js";
import {
  denyCustomerOperation,
  denyCustomerOwnershipAsUnavailable,
} from "./domain/ownership-denial.js";
import { PrismaPrivacyRequestRepository } from "./infrastructure/prisma-privacy-request.repository.js";
import { PrismaCustomersUnitOfWork } from "./infrastructure/prisma-customers.unit-of-work.js";

type OwnershipTxResult<T> =
  | { readonly kind: "ok"; readonly value: T }
  | { readonly kind: "ownership_denied" };

export class PrivacyRequestService {
  public constructor(
    private readonly unitOfWork: PrismaCustomersUnitOfWork,
    private readonly repository: PrismaPrivacyRequestRepository,
    private readonly retentionDays: number,
    private readonly denialAudit: DenialAuditWriter,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async submit(
    principal: AuthenticationPrincipal, purpose: PrivacyRequestPurpose, requestId?: string,
  ): Promise<PrivacyRequestView> {
    await this.authorize(principal, "customers.privacy.requests.submit", requestId);
    return this.unitOfWork.run(async (context) => {
      const result = await this.repository.createOrFindActive(context.prisma, principal.userId, purpose);
      if (result.created) {
        await context.generalAudit.append({
          actorType: "USER", actorId: principal.userId, action: "customers.privacy.requests.submit",
          targetType: "privacy_request", targetId: result.request.id,
          context: { outcome: "SUCCEEDED", purpose },
          ...(requestId === undefined ? {} : { requestId }),
        });
      }
      return result.request;
    });
  }

  public async list(principal: AuthenticationPrincipal, requestId?: string): Promise<PrivacyRequestView[]> {
    await this.authorize(principal, "customers.privacy.requests.list", requestId);
    return this.unitOfWork.run((context) =>
      this.repository.listOwnedVisible(context.prisma, principal.userId, this.now()));
  }

  public async get(
    principal: AuthenticationPrincipal, id: string, requestId?: string,
  ): Promise<PrivacyRequestView> {
    await this.authorize(principal, "customers.privacy.requests.read", requestId);
    const outcome = await this.unitOfWork.run(
      async (context): Promise<OwnershipTxResult<PrivacyRequestView>> => {
        const existing = await this.repository.find(context.prisma, id);
        if (existing === undefined) throw customersError("PRIVACY_REQUEST_NOT_FOUND");
        if (existing.userId !== principal.userId) {
          return { kind: "ownership_denied" };
        }
        const visible = await this.repository.findOwnedVisible(
          context.prisma, id, principal.userId, this.now(),
        );
        if (visible === undefined) throw customersError("PRIVACY_REQUEST_NOT_FOUND");
        return { kind: "ok", value: visible };
      },
    );
    if (outcome.kind === "ownership_denied") {
      return denyCustomerOwnershipAsUnavailable(
        this.denialAudit,
        principal,
        "customers.privacy.requests.read",
        "OWNERSHIP_DENIED",
        "PRIVACY_REQUEST_NOT_FOUND",
        requestId,
      );
    }
    return outcome.value;
  }

  public async cancel(
    principal: AuthenticationPrincipal, id: string, requestId?: string,
  ): Promise<PrivacyRequestView> {
    await this.authorize(principal, "customers.privacy.requests.cancel", requestId);
    const outcome = await this.unitOfWork.run(
      async (context): Promise<OwnershipTxResult<PrivacyRequestView>> => {
        const existing = await this.repository.find(context.prisma, id);
        if (existing === undefined) throw customersError("PRIVACY_REQUEST_NOT_FOUND");
        if (existing.userId !== principal.userId) {
          return { kind: "ownership_denied" };
        }
        if (!canCancelPrivacyRequest(existing.status)) {
          throw customersError("PRIVACY_REQUEST_TRANSITION_INVALID");
        }
        const now = this.now();
        const request = await this.repository.cancel(
          context.prisma, id, principal.userId, now, this.purgeAfter(now),
        );
        if (request === undefined) throw customersError("PRIVACY_REQUEST_CONFLICT");
        await context.generalAudit.append({
          actorType: "USER", actorId: principal.userId, action: "customers.privacy.requests.cancel",
          targetType: "privacy_request", targetId: id, context: { outcome: "SUCCEEDED" },
          ...(requestId === undefined ? {} : { requestId }),
        });
        return { kind: "ok", value: request };
      },
    );
    if (outcome.kind === "ownership_denied") {
      return denyCustomerOwnershipAsUnavailable(
        this.denialAudit,
        principal,
        "customers.privacy.requests.cancel",
        "OWNERSHIP_DENIED",
        "PRIVACY_REQUEST_NOT_FOUND",
        requestId,
      );
    }
    return outcome.value;
  }

  private purgeAfter(terminalAt: Date): Date {
    return new Date(terminalAt.getTime() + this.retentionDays * 86_400_000);
  }

  private async authorize(principal: AuthenticationPrincipal, action: string, requestId?: string): Promise<void> {
    const decision = authorizeContactPrefsPrivacySelf({ principal, resourceOwnerUserId: principal.userId });
    if (!decision.allowed) {
      await denyCustomerOperation(this.denialAudit, principal, action, decision.denialCode!, requestId);
    }
  }
}
