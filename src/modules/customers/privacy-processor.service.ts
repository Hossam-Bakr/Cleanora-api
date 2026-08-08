import { customersError } from "./domain/customers.errors.js";
import { isClosedOutcome } from "./domain/privacy-request.lifecycle.js";
import { PRIVACY_PROCESSOR_CAPABILITY } from "./domain/privacy-processor.capability.js";
import type {
  PrivacyRequestOutcomeCode,
  PrivacyRequestView,
} from "./domain/customers.types.js";
import { PrismaPrivacyRequestRepository } from "./infrastructure/prisma-privacy-request.repository.js";
import { PrismaCustomersUnitOfWork } from "./infrastructure/prisma-customers.unit-of-work.js";

export interface PrivacyProcessorContext {
  readonly processorId: string;
  readonly capability: typeof PRIVACY_PROCESSOR_CAPABILITY;
}

/** Explicit composition-only contract for later privacy orchestrators. */
export interface PrivacyProcessorPort {
  claim(requestId: string, context: PrivacyProcessorContext): Promise<PrivacyRequestView>;
  resolve(
    requestId: string, context: PrivacyProcessorContext,
    status: "COMPLETED" | "REJECTED", outcomeCode: PrivacyRequestOutcomeCode,
  ): Promise<PrivacyRequestView>;
}

export class PrivacyProcessorService implements PrivacyProcessorPort {
  public constructor(
    private readonly unitOfWork: PrismaCustomersUnitOfWork,
    private readonly repository: PrismaPrivacyRequestRepository,
    private readonly retentionDays: number,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async claim(requestId: string, context: PrivacyProcessorContext): Promise<PrivacyRequestView> {
    this.assertCapability(context);
    return this.unitOfWork.run(async (transaction) => {
      const existing = await this.repository.find(transaction.prisma, requestId);
      if (existing === undefined) throw customersError("PRIVACY_REQUEST_NOT_FOUND");
      if (existing.status === "PROCESSING") {
        if (existing.processorId === context.processorId) return existing;
        throw customersError("PRIVACY_REQUEST_CONFLICT");
      }
      if (existing.status !== "PENDING") throw customersError("PRIVACY_REQUEST_TRANSITION_INVALID");
      const request = await this.repository.claim(transaction.prisma, requestId, context.processorId, this.now());
      if (request === undefined) throw customersError("PRIVACY_REQUEST_CONFLICT");
      await transaction.generalAudit.append({
        actorType: "SYSTEM", actorId: context.processorId, action: "customers.privacy.requests.claim",
        targetType: "privacy_request", targetId: request.id, context: { outcome: "SUCCEEDED" },
      });
      return request;
    });
  }

  public async resolve(
    requestId: string, context: PrivacyProcessorContext,
    status: "COMPLETED" | "REJECTED", outcomeCode: PrivacyRequestOutcomeCode,
  ): Promise<PrivacyRequestView> {
    this.assertCapability(context);
    if (!isClosedOutcome(status, outcomeCode)) throw customersError("PRIVACY_REQUEST_OUTCOME_INVALID");
    return this.unitOfWork.run(async (transaction) => {
      const existing = await this.repository.find(transaction.prisma, requestId);
      if (existing === undefined) throw customersError("PRIVACY_REQUEST_NOT_FOUND");
      if (existing.status !== "PROCESSING" || existing.processorId !== context.processorId) {
        throw customersError("PRIVACY_REQUEST_TRANSITION_INVALID");
      }
      const terminalAt = this.now();
      const request = await this.repository.resolve(
        transaction.prisma, requestId, context.processorId, status, outcomeCode,
        terminalAt, this.purgeAfter(terminalAt),
      );
      if (request === undefined) throw customersError("PRIVACY_REQUEST_CONFLICT");
      await transaction.generalAudit.append({
        actorType: "SYSTEM", actorId: context.processorId, action: "customers.privacy.requests.resolve",
        targetType: "privacy_request", targetId: request.id,
        context: { outcome: "SUCCEEDED", terminalStatus: status, outcomeCode },
      });
      return request;
    });
  }

  private assertCapability(context: PrivacyProcessorContext): void {
    if (context.capability !== PRIVACY_PROCESSOR_CAPABILITY || context.processorId.trim().length === 0) {
      throw customersError("PRIVACY_REQUEST_FORBIDDEN");
    }
  }

  private purgeAfter(terminalAt: Date): Date {
    return new Date(terminalAt.getTime() + this.retentionDays * 86_400_000);
  }
}
