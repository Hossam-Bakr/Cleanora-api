import type { DenialAuditWriter } from "#modules/admin/audit.service";

import { AddressService } from "../../../../src/modules/customers/address.service.js";
import { PrivacyRequestService } from "../../../../src/modules/customers/privacy-request.service.js";
import { ProfileService } from "../../../../src/modules/customers/profile.service.js";
import type { AuthenticationPrincipal } from "../../../../src/modules/authentication/authentication.public.js";

const verifiedOwner: AuthenticationPrincipal = {
  userId: "user-1",
  sessionId: "session-1",
  accountCategories: ["INDIVIDUAL"],
  verifiedCategories: ["INDIVIDUAL"],
  pendingCategories: [],
  status: "ACTIVE",
  verificationOnly: false,
};

const wrongOwnerAddress = {
  id: "addr-1",
  userId: "other-owner",
  countryCode: "SA",
  city: "Riyadh",
  district: "Olaya",
  addressText: "1 Main",
  building: null,
  floor: null,
  notes: null,
  version: 1,
};

const addressInput = {
  countryCode: "SA",
  city: "Riyadh",
  district: "Olaya",
  addressText: "1 Main",
  building: null,
  floor: null,
  notes: null,
};

function createBoundaryTrackingDenialAudit(events: string[]): {
  readonly denialAudit: DenialAuditWriter;
  readonly denialAppendedInsideUow: { value: boolean };
  readonly setUowActive: (active: boolean) => void;
} {
  let uowActive = false;
  const denialAppendedInsideUow = { value: false };
  const denialAudit: DenialAuditWriter = {
    append: async () => {
      events.push("denial");
      if (uowActive) {
        denialAppendedInsideUow.value = true;
      }
      return { id: "denial-1", createdAt: new Date().toISOString() };
    },
  };
  return {
    denialAudit,
    denialAppendedInsideUow,
    setUowActive: (active: boolean) => {
      uowActive = active;
    },
  };
}

function createTrackingUnitOfWork(
  events: string[],
  setUowActive: (active: boolean) => void,
  context: unknown = { prisma: {} },
) {
  return {
    run: async <T>(work: (ctx: unknown) => Promise<T>): Promise<T> => {
      events.push("uow");
      setUowActive(true);
      try {
        return await work(context);
      } finally {
        setUowActive(false);
      }
    },
  };
}

describe("customers denial audit TX boundary", () => {
  it("appends denial audit before any unit-of-work run on forbidden profile read", async () => {
    const events: string[] = [];
    const denialAudit: DenialAuditWriter = {
      append: async () => {
        events.push("denial");
        return { id: "denial-1", createdAt: new Date().toISOString() };
      },
    };
    const unitOfWork = {
      run: async () => {
        events.push("uow");
        throw new Error("UoW must not run for denied reads");
      },
    };
    const repository = {
      get: async () => {
        events.push("repo");
        return { category: "INDIVIDUAL" as const, created: false };
      },
    };
    const service = new ProfileService(
      unitOfWork as never,
      repository as never,
      denialAudit,
    );
    const principal: AuthenticationPrincipal = {
      userId: "user-1",
      sessionId: "session-1",
      accountCategories: ["INDIVIDUAL"],
      verifiedCategories: [],
      pendingCategories: ["INDIVIDUAL"],
      status: "ACTIVE",
      verificationOnly: false,
    };

    await expect(
      service.get({ principal, category: "INDIVIDUAL" }),
    ).rejects.toMatchObject({ code: "CUSTOMER_PROFILE_FORBIDDEN" });

    expect(events).toEqual(["denial"]);
  });

  it("appends ownership denial after address get UoW completes, never inside the callback", async () => {
    const events: string[] = [];
    const { denialAudit, denialAppendedInsideUow, setUowActive } =
      createBoundaryTrackingDenialAudit(events);

    const service = new AddressService(
      createTrackingUnitOfWork(events, setUowActive) as never,
      { find: async () => wrongOwnerAddress } as never,
      { resolveActiveCountry: async () => ({ id: "country-1" }) },
      denialAudit,
    );

    await expect(service.get(verifiedOwner, "addr-1")).rejects.toMatchObject({
      code: "CUSTOMER_ADDRESS_NOT_FOUND",
    });

    expect(events).toEqual(["uow", "denial"]);
    expect(denialAppendedInsideUow.value).toBe(false);
  });

  it("appends ownership denial after address update UoW completes, never inside the callback", async () => {
    const events: string[] = [];
    const { denialAudit, denialAppendedInsideUow, setUowActive } =
      createBoundaryTrackingDenialAudit(events);
    const update = vi.fn();

    const service = new AddressService(
      createTrackingUnitOfWork(events, setUowActive, {
        prisma: {},
        generalAudit: { append: async () => undefined },
      }) as never,
      { find: async () => wrongOwnerAddress, update } as never,
      { resolveActiveCountry: async () => ({ id: "country-1" }) },
      denialAudit,
    );

    await expect(
      service.update({
        principal: verifiedOwner,
        addressId: "addr-1",
        version: 1,
        input: addressInput,
      }),
    ).rejects.toMatchObject({ code: "CUSTOMER_ADDRESS_NOT_FOUND" });

    expect(events).toEqual(["uow", "denial"]);
    expect(denialAppendedInsideUow.value).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it("appends ownership denial after address remove UoW completes, never inside the callback", async () => {
    const events: string[] = [];
    const { denialAudit, denialAppendedInsideUow, setUowActive } =
      createBoundaryTrackingDenialAudit(events);
    const remove = vi.fn();

    const service = new AddressService(
      createTrackingUnitOfWork(events, setUowActive, {
        prisma: {},
        generalAudit: { append: async () => undefined },
      }) as never,
      { find: async () => wrongOwnerAddress, remove } as never,
      { resolveActiveCountry: async () => ({ id: "country-1" }) },
      denialAudit,
    );

    await expect(service.remove(verifiedOwner, "addr-1", 1)).rejects.toMatchObject({
      code: "CUSTOMER_ADDRESS_NOT_FOUND",
    });

    expect(events).toEqual(["uow", "denial"]);
    expect(denialAppendedInsideUow.value).toBe(false);
    expect(remove).not.toHaveBeenCalled();
  });

  it("appends ownership denial after privacy cancel UoW completes, never inside the callback", async () => {
    const events: string[] = [];
    const { denialAudit, denialAppendedInsideUow, setUowActive } =
      createBoundaryTrackingDenialAudit(events);

    const repository = {
      find: async () => ({
        id: "privacy-1",
        userId: "other-owner",
        purpose: "EXPORT" as const,
        status: "PENDING" as const,
        createdAt: new Date().toISOString(),
        cancelledAt: null,
        processingAt: null,
        terminalAt: null,
        purgeAfter: null,
      }),
      cancel: vi.fn(),
    };
    const service = new PrivacyRequestService(
      createTrackingUnitOfWork(events, setUowActive, {
        prisma: {},
        generalAudit: { append: async () => undefined },
      }) as never,
      repository as never,
      30,
      denialAudit,
    );

    await expect(service.cancel(verifiedOwner, "privacy-1")).rejects.toMatchObject({
      code: "PRIVACY_REQUEST_NOT_FOUND",
    });

    expect(events).toEqual(["uow", "denial"]);
    expect(denialAppendedInsideUow.value).toBe(false);
    expect(repository.cancel).not.toHaveBeenCalled();
  });
});
