import type { DenialAuditWriter } from "#modules/admin/audit.service";

import {
  authorizeCategoryProfileSelf,
  type SupportedCustomerCategory,
} from "./domain/customer-self.policy.js";
import { denyCustomerOperation } from "./domain/ownership-denial.js";
import type {
  CustomerProfileView,
  ProfileCommand,
  ProfileInput,
} from "./domain/customers.types.js";
import { PrismaProfileRepository } from "./infrastructure/prisma-profile.repository.js";
import { PrismaCustomersUnitOfWork } from "./infrastructure/prisma-customers.unit-of-work.js";

/** Customers-owned profile workflow. Authentication identity fields are never read or written here. */
export class ProfileService {
  public constructor(
    private readonly unitOfWork: PrismaCustomersUnitOfWork,
    private readonly repository: PrismaProfileRepository,
    private readonly denialAudit: DenialAuditWriter,
  ) {}

  public async get(
    command: Pick<ProfileCommand, "principal" | "requestId"> & {
      readonly category: SupportedCustomerCategory;
    },
  ): Promise<CustomerProfileView> {
    const decision = authorizeCategoryProfileSelf({
      principal: command.principal,
      resourceOwnerUserId: command.principal.userId,
      category: command.category,
    });
    if (!decision.allowed) {
      return denyCustomerOperation(
        this.denialAudit,
        command.principal,
        "customers.profile.read",
        decision.denialCode!,
        command.requestId,
      );
    }
    return this.unitOfWork.run((context) =>
      this.repository.get(context.prisma, command.principal.userId, command.category),
    );
  }

  public async upsert(command: ProfileCommand): Promise<CustomerProfileView> {
    const input = trimProfileInput(command.input);
    const decision = authorizeCategoryProfileSelf({
      principal: command.principal,
      resourceOwnerUserId: command.principal.userId,
      category: input.category,
    });
    if (!decision.allowed) {
      return denyCustomerOperation(
        this.denialAudit,
        command.principal,
        "customers.profile.upsert",
        decision.denialCode!,
        command.requestId,
      );
    }

    return this.unitOfWork.run(async (context) => {
      const profile = await this.repository.upsert(
        context.prisma,
        command.principal.userId,
        input,
      );
      await context.generalAudit.append({
        actorType: "USER",
        actorId: command.principal.userId,
        action: "customers.profile.upsert",
        targetType: "customer_profile",
        targetId: command.principal.userId,
        context: { category: input.category, outcome: "SUCCEEDED" },
        ...(command.requestId === undefined ? {} : { requestId: command.requestId }),
      });
      return profile;
    });
  }
}

function trimProfileInput(input: ProfileInput): ProfileInput {
  switch (input.category) {
    case "INDIVIDUAL":
      return { category: input.category, fullName: input.fullName.trim() };
    case "COMPANY":
      return {
        category: input.category,
        companyName: input.companyName.trim(),
        representativeFullName: input.representativeFullName.trim(),
      };
    case "ENGINEER":
      return {
        category: input.category,
        fullName: input.fullName.trim(),
        professionalTitle: input.professionalTitle.trim(),
      };
  }
}
