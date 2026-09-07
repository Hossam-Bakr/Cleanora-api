
import {
  decideProviderServiceManagementAuthorization,
  isExactProviderServiceManager,
  isProviderServiceOwnershipOrMembershipOperation,
  type ProviderServiceAuthorizationFacts,
  type ProviderServiceManagementOperation,
} from "../../../src/modules/providers/domain/provider-service-authorization.policy.js";

const baseAllowed: ProviderServiceAuthorizationFacts = {
  actorActive: true,
  providerAdminEnabled: true,
  providerApproved: true,
  sameProvider: true,
  membershipActive: true,
  managementLevel: "OWNER",
};

const operations: readonly ProviderServiceManagementOperation[] = [
  "LIST_OFFERINGS",
  "READ_OFFERING",
  "CREATE_OFFERING",
  "UPDATE_CONFIGURATION",
  "PROPOSE_PRICE",
  "ENABLE_OFFERING",
  "DISABLE_OFFERING",
  "READ_PRICE_HISTORY",
  "READ_STATUS_HISTORY",
];

describe("provider-service authorization policy (T023)", () => {
  it("allows exact active OWNER and ADMIN for every management operation", () => {
    for (const operation of operations) {
      expect(
        decideProviderServiceManagementAuthorization(operation, baseAllowed),
      ).toEqual({ allowed: true });
      expect(
        decideProviderServiceManagementAuthorization(operation, {
          ...baseAllowed,
          managementLevel: "ADMIN",
        }),
      ).toEqual({ allowed: true });
    }
    expect(isExactProviderServiceManager(baseAllowed)).toBe(true);
  });

  it("denies disabled membership with non-enumerating not-found", () => {
    expect(
      decideProviderServiceManagementAuthorization("CREATE_OFFERING", {
        ...baseAllowed,
        membershipActive: false,
        managementLevel: "OWNER",
      }),
    ).toEqual({
      allowed: false,
      denialCode: "PROVIDER_SERVICE_NOT_FOUND",
    });
  });

  it("denies missing provider_admin capability as forbidden", () => {
    expect(
      decideProviderServiceManagementAuthorization("LIST_OFFERINGS", {
        ...baseAllowed,
        providerAdminEnabled: false,
      }),
    ).toEqual({
      allowed: false,
      denialCode: "PROVIDER_SERVICE_FORBIDDEN",
    });
  });

  it("denies inactive actors as forbidden", () => {
    expect(
      decideProviderServiceManagementAuthorization("READ_OFFERING", {
        ...baseAllowed,
        actorActive: false,
      }),
    ).toEqual({
      allowed: false,
      denialCode: "PROVIDER_SERVICE_FORBIDDEN",
    });
  });

  it("denies unapproved Provider state", () => {
    expect(
      decideProviderServiceManagementAuthorization("CREATE_OFFERING", {
        ...baseAllowed,
        providerApproved: false,
      }),
    ).toEqual({
      allowed: false,
      denialCode: "PROVIDER_SERVICE_PROVIDER_STATE_INVALID",
    });
  });

  it("denies cross-Provider access without enumeration", () => {
    expect(
      decideProviderServiceManagementAuthorization("READ_OFFERING", {
        ...baseAllowed,
        sameProvider: false,
      }),
    ).toEqual({
      allowed: false,
      denialCode: "PROVIDER_SERVICE_NOT_FOUND",
    });
  });

  it("never expands into ownership or membership administration", () => {
    expect(isProviderServiceOwnershipOrMembershipOperation("TRANSFER_OWNERSHIP")).toBe(
      true,
    );
    expect(isProviderServiceOwnershipOrMembershipOperation("MANAGE_MEMBERSHIP")).toBe(
      true,
    );
    expect(isProviderServiceOwnershipOrMembershipOperation("CREATE_OFFERING")).toBe(
      false,
    );
  });
});
