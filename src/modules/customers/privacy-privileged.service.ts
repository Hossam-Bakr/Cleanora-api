import { findPrivilegedActionReason } from "#modules/authentication/authentication.public";
import type { AuthenticationPrincipal } from "#modules/authentication/authentication.public";
import type { AuthorizationService } from "#modules/authentication/authorization.service";

import { customersError } from "./domain/customers.errors.js";
import type { PrivacyRequestView } from "./domain/customers.types.js";
import { PrismaPrivacyRequestRepository } from "./infrastructure/prisma-privacy-request.repository.js";
import { PrismaCustomersUnitOfWork } from "./infrastructure/prisma-customers.unit-of-work.js";

export interface PrivacyPrivilegedReassignCommand {
  readonly requestId: string;
  readonly newProcessorId: string;
  readonly actor: AuthenticationPrincipal;
  readonly reasonCode: string;
  readonly requestIdForAudit?: string;
}

/** Internal application contract: it intentionally has no HTTP adapter in R1-P04. */
export interface PrivacyPrivilegedPort {
  reassign(command: PrivacyPrivilegedReassignCommand): Promise<PrivacyRequestView>;
}

export class PrivacyPrivilegedService implements PrivacyPrivilegedPort {
  public constructor(
    private readonly unitOfWork: PrismaCustomersUnitOfWork,
    private readonly repository: PrismaPrivacyRequestRepository,
    private readonly authorization: AuthorizationService,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async reassign(command: PrivacyPrivilegedReassignCommand): Promise<PrivacyRequestView> {
    if (command.newProcessorId.trim().length === 0) throw customersError("PRIVACY_REQUEST_FORBIDDEN");
    const reason = findPrivilegedActionReason(command.reasonCode);
    if (reason?.operation !== "PRIVACY_REQUEST_REASSIGN") {
      throw customersError("PRIVACY_REQUEST_FORBIDDEN");
    }
    const decision = await this.authorization.authorizeProtectedOperation({
      principal: command.actor,
      operationId: "customers.privacy.requests.reassign",
      scope: { kind: "GLOBAL" },
    });
    if (!decision.allowed) throw customersError("PRIVACY_REQUEST_FORBIDDEN");

    return this.unitOfWork.run(async (transaction) => {
      const existing = await this.repository.find(transaction.prisma, command.requestId);
      if (existing === undefined) throw customersError("PRIVACY_REQUEST_NOT_FOUND");
      if (existing.status !== "PROCESSING") throw customersError("PRIVACY_REQUEST_TRANSITION_INVALID");
      const beforeProcessorId = existing.processorId!;
      const beforeProcessingAt = existing.processingAt!;
      const request = await this.repository.reassign(
        transaction.prisma, command.requestId, command.newProcessorId, this.now(),
      );
      if (request === undefined) throw customersError("PRIVACY_REQUEST_CONFLICT");
      await transaction.privilegedAudit.append({
        actorType: "USER", actorId: command.actor.userId,
        action: "customers.privacy.requests.reassign", targetType: "privacy_request",
        targetId: request.id, reason: command.reasonCode,
        context: {
          outcome: "SUCCEEDED",
          beforeProcessorId,
          beforeProcessingAt,
          afterProcessorId: command.newProcessorId,
          afterProcessingAt: request.processingAt!,
        },
        ...(command.requestIdForAudit === undefined ? {} : { requestId: command.requestIdForAudit }),
      });
      return request;
    });
  }
}
