import type { Prisma } from "#generated/prisma/client";

import type { AddressInput, AddressView } from "../domain/customers.types.js";

type Transaction = Prisma.TransactionClient;

type AddressRecord = {
  readonly id: string;
  readonly userId: string;
  readonly city: string;
  readonly district: string;
  readonly addressText: string;
  readonly building: string | null;
  readonly floor: string | null;
  readonly notes: string | null;
  readonly version: number;
  readonly country: { readonly code: string };
};

function view(record: AddressRecord): AddressView {
  return {
    id: record.id,
    countryCode: record.country.code,
    city: record.city,
    district: record.district,
    addressText: record.addressText,
    building: record.building,
    floor: record.floor,
    notes: record.notes,
    version: record.version,
  };
}

const includeCountry = { country: { select: { code: true } } } as const;

export class PrismaAddressRepository {
  public async list(transaction: Transaction, userId: string): Promise<AddressView[]> {
    const addresses = await transaction.userAddress.findMany({
      where: { userId },
      include: includeCountry,
      orderBy: { createdAt: "asc" },
    });
    return addresses.map(view);
  }

  public async find(
    transaction: Transaction,
    addressId: string,
  ): Promise<(AddressView & { readonly userId: string }) | undefined> {
    const address = await transaction.userAddress.findUnique({
      where: { id: addressId },
      include: includeCountry,
    });
    return address === null ? undefined : { ...view(address), userId: address.userId };
  }

  public async create(
    transaction: Transaction,
    userId: string,
    countryId: string,
    input: AddressInput,
  ): Promise<AddressView> {
    const address = await transaction.userAddress.create({
      data: {
        userId,
        countryId,
        city: input.city,
        district: input.district,
        addressText: input.addressText,
        building: input.building,
        floor: input.floor,
        notes: input.notes,
      },
      include: includeCountry,
    });
    return view(address);
  }

  public async update(
    transaction: Transaction,
    addressId: string,
    userId: string,
    countryId: string,
    input: AddressInput,
    version: number,
  ): Promise<AddressView | undefined> {
    const result = await transaction.userAddress.updateMany({
      where: { id: addressId, userId, version },
      data: {
        countryId,
        city: input.city,
        district: input.district,
        addressText: input.addressText,
        building: input.building,
        floor: input.floor,
        notes: input.notes,
        version: { increment: 1 },
      },
    });
    if (result.count !== 1) return undefined;
    const address = await transaction.userAddress.findUniqueOrThrow({
      where: { id: addressId },
      include: includeCountry,
    });
    return view(address);
  }

  public async remove(
    transaction: Transaction,
    addressId: string,
    userId: string,
    version: number,
  ): Promise<boolean> {
    const result = await transaction.userAddress.deleteMany({
      where: { id: addressId, userId, version },
    });
    return result.count === 1;
  }
}
