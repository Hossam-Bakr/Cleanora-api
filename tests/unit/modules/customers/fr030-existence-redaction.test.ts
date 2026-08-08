import { AddressService } from "../../../../src/modules/customers/address.service.js";
import { PrivacyRequestService } from "../../../../src/modules/customers/privacy-request.service.js";
import type { AuthenticationPrincipal } from "../../../../src/modules/authentication/authentication.public.js";
import { customersError } from "../../../../src/modules/customers/domain/customers.errors.js";

const owner: AuthenticationPrincipal = {
  userId: "owner-1",
  sessionId: "session-1",
  accountCategories: ["INDIVIDUAL"],
  verifiedCategories: ["INDIVIDUAL"],
  pendingCategories: [],
  status: "ACTIVE",
  verificationOnly: false,
};

const addressInput = {
  countryCode: "EG",
  city: "Cairo",
  district: "Maadi",
  addressText: "12 Road",
  building: null,
  floor: null,
  notes: null,
};

const wrongOwnerAddress = {
  id: "addr-1",
  userId: "other-owner",
  ...addressInput,
  version: 1,
};

const wrongOwnerPrivacy = {
  id: "privacy-1",
  userId: "other-owner",
  purpose: "EXPORT" as const,
  status: "PENDING" as const,
  createdAt: new Date().toISOString(),
  cancelledAt: null,
  processingAt: null,
  terminalAt: null,
  purgeAfter: null,
};

function shapeOf(code: "CUSTOMER_ADDRESS_NOT_FOUND" | "PRIVACY_REQUEST_NOT_FOUND") {
  const error = customersError(code);
  return {
    code: error.code,
    statusCode: error.statusCode,
    message: error.message,
  };
}

function unitOfWork() {
  return {
    run: async <T>(work: (context: unknown) => Promise<T>): Promise<T> =>
      work({
        prisma: {},
        generalAudit: { append: async () => undefined },
      }),
  };
}

describe("FR-030 existence redaction", () => {
  it("matches missing and wrong-owner AppError shape for address get", async () => {
    const expected = shapeOf("CUSTOMER_ADDRESS_NOT_FOUND");
    const denialAppend = vi.fn(async () => ({
      id: "denial",
      createdAt: new Date().toISOString(),
    }));

    const missingService = new AddressService(
      unitOfWork() as never,
      { find: async () => undefined } as never,
      { resolveActiveCountry: async () => ({ id: "country" }) },
      { append: denialAppend },
    );
    const wrongOwnerService = new AddressService(
      unitOfWork() as never,
      { find: async () => wrongOwnerAddress } as never,
      { resolveActiveCountry: async () => ({ id: "country" }) },
      { append: denialAppend },
    );

    await expect(missingService.get(owner, "missing")).rejects.toMatchObject(expected);
    await expect(wrongOwnerService.get(owner, "addr-1")).rejects.toMatchObject(expected);
    expect(denialAppend).toHaveBeenCalledTimes(1);
    expect(denialAppend).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "customers.address.read",
        outcome: "OWNERSHIP_DENIED",
      }),
    );
  });

  it("matches missing and wrong-owner AppError shape for address update without mutation", async () => {
    const expected = shapeOf("CUSTOMER_ADDRESS_NOT_FOUND");
    const denialAppend = vi.fn(async () => ({
      id: "denial",
      createdAt: new Date().toISOString(),
    }));
    const update = vi.fn();

    const missingService = new AddressService(
      unitOfWork() as never,
      { find: async () => undefined, update } as never,
      { resolveActiveCountry: async () => ({ id: "country" }) },
      { append: denialAppend },
    );
    const wrongOwnerService = new AddressService(
      unitOfWork() as never,
      { find: async () => wrongOwnerAddress, update } as never,
      { resolveActiveCountry: async () => ({ id: "country" }) },
      { append: denialAppend },
    );

    await expect(
      missingService.update({
        principal: owner,
        addressId: "missing",
        version: 1,
        input: addressInput,
      }),
    ).rejects.toMatchObject(expected);
    await expect(
      wrongOwnerService.update({
        principal: owner,
        addressId: "addr-1",
        version: 1,
        input: addressInput,
      }),
    ).rejects.toMatchObject(expected);

    expect(update).not.toHaveBeenCalled();
    expect(denialAppend).toHaveBeenCalledTimes(1);
    expect(denialAppend).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "customers.address.update",
        outcome: "OWNERSHIP_DENIED",
      }),
    );
  });

  it("matches missing and wrong-owner AppError shape for address remove without mutation", async () => {
    const expected = shapeOf("CUSTOMER_ADDRESS_NOT_FOUND");
    const denialAppend = vi.fn(async () => ({
      id: "denial",
      createdAt: new Date().toISOString(),
    }));
    const remove = vi.fn();

    const missingService = new AddressService(
      unitOfWork() as never,
      { find: async () => undefined, remove } as never,
      { resolveActiveCountry: async () => ({ id: "country" }) },
      { append: denialAppend },
    );
    const wrongOwnerService = new AddressService(
      unitOfWork() as never,
      { find: async () => wrongOwnerAddress, remove } as never,
      { resolveActiveCountry: async () => ({ id: "country" }) },
      { append: denialAppend },
    );

    await expect(missingService.remove(owner, "missing", 1)).rejects.toMatchObject(expected);
    await expect(wrongOwnerService.remove(owner, "addr-1", 1)).rejects.toMatchObject(expected);

    expect(remove).not.toHaveBeenCalled();
    expect(denialAppend).toHaveBeenCalledTimes(1);
    expect(denialAppend).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "customers.address.remove",
        outcome: "OWNERSHIP_DENIED",
      }),
    );
  });

  it("matches missing and wrong-owner AppError shape for privacy get", async () => {
    const expected = shapeOf("PRIVACY_REQUEST_NOT_FOUND");
    const denialAppend = vi.fn(async () => ({
      id: "denial",
      createdAt: new Date().toISOString(),
    }));

    const missingService = new PrivacyRequestService(
      unitOfWork() as never,
      { find: async () => undefined } as never,
      30,
      { append: denialAppend },
    );
    const wrongOwnerService = new PrivacyRequestService(
      unitOfWork() as never,
      { find: async () => wrongOwnerPrivacy } as never,
      30,
      { append: denialAppend },
    );

    await expect(missingService.get(owner, "missing")).rejects.toMatchObject(expected);
    await expect(wrongOwnerService.get(owner, "privacy-1")).rejects.toMatchObject(expected);
    expect(denialAppend).toHaveBeenCalledTimes(1);
    expect(denialAppend).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "customers.privacy.requests.read",
        outcome: "OWNERSHIP_DENIED",
      }),
    );
  });

  it("matches missing and wrong-owner AppError shape for privacy cancel without mutation", async () => {
    const expected = shapeOf("PRIVACY_REQUEST_NOT_FOUND");
    const denialAppend = vi.fn(async () => ({
      id: "denial",
      createdAt: new Date().toISOString(),
    }));
    const cancel = vi.fn();

    const missingService = new PrivacyRequestService(
      unitOfWork() as never,
      { find: async () => undefined, cancel } as never,
      30,
      { append: denialAppend },
    );
    const wrongOwnerService = new PrivacyRequestService(
      unitOfWork() as never,
      { find: async () => wrongOwnerPrivacy, cancel } as never,
      30,
      { append: denialAppend },
    );

    await expect(missingService.cancel(owner, "missing")).rejects.toMatchObject(expected);
    await expect(wrongOwnerService.cancel(owner, "privacy-1")).rejects.toMatchObject(expected);

    expect(cancel).not.toHaveBeenCalled();
    expect(denialAppend).toHaveBeenCalledTimes(1);
    expect(denialAppend).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "customers.privacy.requests.cancel",
        outcome: "OWNERSHIP_DENIED",
      }),
    );
  });
});
