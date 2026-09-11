import { createPrismaCustomerAddressSnapshotReader } from "#modules/customers/infrastructure/prisma-customer-address-snapshot.reader";

describe("customer address snapshot reader", () => {
  it("returns owned addresses and hides foreign ids", async () => {
    const findUnique = vi.fn(async ({ where: { id } }: { where: { id: string } }) => {
      if (id === "missing") {
        return null;
      }
      if (id === "foreign") {
        return {
          id: "foreign",
          userId: "other",
          city: "Cairo",
          district: "Nasr City",
          addressText: "x",
          building: null,
          floor: null,
          notes: null,
          version: 1,
          country: { code: "EG" },
        };
      }
      return {
        id: "addr-1",
        userId: "user-1",
        city: "Cairo",
        district: "Nasr City",
        addressText: "1 Main",
        building: null,
        floor: null,
        notes: null,
        version: 1,
        country: { code: "EG" },
      };
    });
    const reader = createPrismaCustomerAddressSnapshotReader({
      userAddress: { findUnique },
    });
    await expect(
      reader.readOwnedAddress({ userId: "user-1", addressId: "addr-1" }),
    ).resolves.toMatchObject({ id: "addr-1", countryCode: "EG" });
    await expect(
      reader.readOwnedAddress({ userId: "user-1", addressId: "foreign" }),
    ).resolves.toBeNull();
    await expect(
      reader.readOwnedAddress({ userId: "user-1", addressId: "missing" }),
    ).resolves.toBeNull();
  });

  it("uses a transaction client when one is supplied", async () => {
    const find = vi.fn().mockResolvedValue({
      id: "addr-1",
      userId: "user-1",
      city: "Cairo",
      district: "Nasr City",
      addressText: "1 Main",
      building: "B",
      floor: "2",
      notes: "n",
      version: 1,
      country: { code: "EG" },
    });
    const reader = createPrismaCustomerAddressSnapshotReader({
      $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({ userAddress: { findUnique: find } }),
      userAddress: { findUnique: find },
    });
    await expect(
      reader.readOwnedAddress({ userId: "user-1", addressId: "addr-1" }),
    ).resolves.toMatchObject({ id: "addr-1", building: "B", floor: "2" });
  });
});
