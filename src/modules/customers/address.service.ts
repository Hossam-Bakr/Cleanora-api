import type { DenialAuditWriter } from "#modules/admin/audit.service";
import type { AuthenticationPrincipal } from "#modules/authentication/authentication.public";

import { authorizeSharedImageOrAddressSelf } from "./domain/customer-self.policy.js";
import { customersError } from "./domain/customers.errors.js";
import type { AddressInput, AddressView } from "./domain/customers.types.js";
import {
  denyCustomerOperation,
  denyCustomerOwnershipAsUnavailable,
} from "./domain/ownership-denial.js";
import { PrismaAddressRepository } from "./infrastructure/prisma-address.repository.js";
import { PrismaCustomersUnitOfWork } from "./infrastructure/prisma-customers.unit-of-work.js";

export interface ActiveCountryResolver {
  resolveActiveCountry(countryCode: string): Promise<{ readonly id: string }>;
}

export interface AddressMutationCommand {
  readonly principal: AuthenticationPrincipal;
  readonly input: AddressInput;
  readonly requestId?: string;
}

type OwnershipTxResult<T> =
  | { readonly kind: "ok"; readonly value: T }
  | { readonly kind: "ownership_denied" };

/** Customers-owned address workflow; Configuration resolves only active country IDs. */
export class AddressService {
  public constructor(
    private readonly unitOfWork: PrismaCustomersUnitOfWork,
    private readonly repository: PrismaAddressRepository,
    private readonly countries: ActiveCountryResolver,
    private readonly denialAudit: DenialAuditWriter,
  ) {}

  public async list(
    principal: AuthenticationPrincipal,
    requestId?: string,
  ): Promise<AddressView[]> {
    await this.authorize(principal, "customers.address.list", requestId);
    return this.unitOfWork.run((context) =>
      this.repository.list(context.prisma, principal.userId),
    );
  }

  public async get(
    principal: AuthenticationPrincipal,
    addressId: string,
    requestId?: string,
  ): Promise<AddressView> {
    await this.authorize(principal, "customers.address.read", requestId);
    const outcome = await this.unitOfWork.run(
      async (context): Promise<OwnershipTxResult<AddressView>> => {
        const address = await this.repository.find(context.prisma, addressId);
        if (address === undefined) throw customersError("CUSTOMER_ADDRESS_NOT_FOUND");
        if (address.userId !== principal.userId) {
          return { kind: "ownership_denied" };
        }
        const { userId: _, ...view } = address;
        return { kind: "ok", value: view };
      },
    );
    if (outcome.kind === "ownership_denied") {
      return denyCustomerOwnershipAsUnavailable(
        this.denialAudit,
        principal,
        "customers.address.read",
        "OWNERSHIP_DENIED",
        "CUSTOMER_ADDRESS_NOT_FOUND",
        requestId,
      );
    }
    return outcome.value;
  }

  public async create(command: AddressMutationCommand): Promise<AddressView> {
    await this.authorize(command.principal, "customers.address.create", command.requestId);
    const input = normalizeAddress(command.input);
    const country = await this.resolveCountry(input.countryCode);
    return this.unitOfWork.run(async (context) => {
      const address = await this.repository.create(
        context.prisma,
        command.principal.userId,
        country.id,
        input,
      );
      await context.generalAudit.append({
        actorType: "USER",
        actorId: command.principal.userId,
        action: "customers.address.create",
        targetType: "user_address",
        targetId: address.id,
        context: { outcome: "SUCCEEDED" },
        ...(command.requestId === undefined ? {} : { requestId: command.requestId }),
      });
      return address;
    });
  }

  public async update(
    command: AddressMutationCommand & { readonly addressId: string; readonly version: number },
  ): Promise<AddressView> {
    await this.authorize(command.principal, "customers.address.update", command.requestId);
    const input = normalizeAddress(command.input);
    const country = await this.resolveCountry(input.countryCode);
    const outcome = await this.unitOfWork.run(
      async (context): Promise<OwnershipTxResult<AddressView>> => {
        const existing = await this.repository.find(context.prisma, command.addressId);
        if (existing === undefined) throw customersError("CUSTOMER_ADDRESS_NOT_FOUND");
        if (existing.userId !== command.principal.userId) {
          return { kind: "ownership_denied" };
        }
        const address = await this.repository.update(
          context.prisma, command.addressId, command.principal.userId, country.id, input, command.version,
        );
        if (address === undefined) throw customersError("CUSTOMER_ADDRESS_CONFLICT");
        await context.generalAudit.append({
          actorType: "USER", actorId: command.principal.userId,
          action: "customers.address.update", targetType: "user_address", targetId: address.id,
          context: { outcome: "SUCCEEDED" },
          ...(command.requestId === undefined ? {} : { requestId: command.requestId }),
        });
        return { kind: "ok", value: address };
      },
    );
    if (outcome.kind === "ownership_denied") {
      return denyCustomerOwnershipAsUnavailable(
        this.denialAudit,
        command.principal,
        "customers.address.update",
        "OWNERSHIP_DENIED",
        "CUSTOMER_ADDRESS_NOT_FOUND",
        command.requestId,
      );
    }
    return outcome.value;
  }

  public async remove(
    principal: AuthenticationPrincipal,
    addressId: string,
    version: number,
    requestId?: string,
  ): Promise<{ readonly removed: true }> {
    await this.authorize(principal, "customers.address.remove", requestId);
    const outcome = await this.unitOfWork.run(
      async (context): Promise<OwnershipTxResult<{ readonly removed: true }>> => {
        const existing = await this.repository.find(context.prisma, addressId);
        if (existing === undefined) throw customersError("CUSTOMER_ADDRESS_NOT_FOUND");
        if (existing.userId !== principal.userId) {
          return { kind: "ownership_denied" };
        }
        if (!(await this.repository.remove(context.prisma, addressId, principal.userId, version))) {
          throw customersError("CUSTOMER_ADDRESS_CONFLICT");
        }
        await context.generalAudit.append({
          actorType: "USER", actorId: principal.userId,
          action: "customers.address.remove", targetType: "user_address", targetId: addressId,
          context: { outcome: "SUCCEEDED" },
          ...(requestId === undefined ? {} : { requestId }),
        });
        return { kind: "ok", value: { removed: true } };
      },
    );
    if (outcome.kind === "ownership_denied") {
      return denyCustomerOwnershipAsUnavailable(
        this.denialAudit,
        principal,
        "customers.address.remove",
        "OWNERSHIP_DENIED",
        "CUSTOMER_ADDRESS_NOT_FOUND",
        requestId,
      );
    }
    return outcome.value;
  }

  private async authorize(
    principal: AuthenticationPrincipal,
    action: string,
    requestId?: string,
  ): Promise<void> {
    const decision = authorizeSharedImageOrAddressSelf({
      principal,
      resourceOwnerUserId: principal.userId,
    });
    if (!decision.allowed) {
      await denyCustomerOperation(this.denialAudit, principal, action, decision.denialCode!, requestId);
    }
  }

  private async resolveCountry(code: string): Promise<{ readonly id: string }> {
    try {
      return await this.countries.resolveActiveCountry(code);
    } catch {
      throw customersError("CUSTOMER_ADDRESS_INVALID");
    }
  }
}

export function normalizeAddress(input: AddressInput): AddressInput {
  return {
    countryCode: input.countryCode.trim().toUpperCase(),
    city: input.city.trim(),
    district: input.district.trim(),
    addressText: input.addressText.trim(),
    building: input.building?.trim() || null,
    floor: input.floor?.trim() || null,
    notes: input.notes?.trim() || null,
  };
}
