import type { Prisma, PrismaClient } from "#generated/prisma/client";

import { getPrismaClient } from "#database/prisma";

import { PrismaAddressRepository } from "./prisma-address.repository.js";
import type {
  CustomerAddressSnapshot,
  CustomerAddressSnapshotReader,
} from "../customers.public.js";

/**
 * @desc Owned-address snapshot. Foreign ids return null (non-enumerating).
 * @access Customers infrastructure
 */
export function createPrismaCustomerAddressSnapshotReader(
  suppliedClient?: unknown,
): CustomerAddressSnapshotReader {
  const client = (suppliedClient ?? getPrismaClient()) as
    | PrismaClient
    | Prisma.TransactionClient;
  const repository = new PrismaAddressRepository();
  return {
    async readOwnedAddress(input: {
      readonly userId: string;
      readonly addressId: string;
    }): Promise<CustomerAddressSnapshot | null> {
      const record =
        "$transaction" in client
          ? await client.$transaction((transaction) =>
              repository.find(transaction, input.addressId),
            )
          : await repository.find(client, input.addressId);
      if (record === undefined || record.userId !== input.userId) {
        return null;
      }
      return {
        id: record.id,
        countryCode: record.countryCode,
        city: record.city,
        district: record.district,
        addressText: record.addressText,
        building: record.building,
        floor: record.floor,
        notes: record.notes,
      };
    },
  };
}
