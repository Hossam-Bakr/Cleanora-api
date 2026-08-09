import type { DenialAuditWriter } from "#modules/admin/audit.service";
import type { AuthenticationPrincipal } from "#modules/authentication/authentication.public";

import type { AddressService } from "./address.service.js";
import {
  authorizeSharedImageOrAddressSelf,
  SUPPORTED_CUSTOMER_CATEGORIES,
  type SupportedCustomerCategory,
} from "./domain/customer-self.policy.js";
import type {
  AddressView,
  ContactStateView,
  CustomerProfileView,
  ProfileImageDeliveryView,
} from "./domain/customers.types.js";
import { denyCustomerOperation } from "./domain/ownership-denial.js";
import type { PreferencesService, PreferencesView } from "./preferences.service.js";
import type { ProfileImageService } from "./profile-image.service.js";
import type { ProfileService } from "./profile.service.js";

export interface CustomerOverviewView {
  readonly identity: {
    readonly userId: string;
    readonly status: "ACTIVE";
    readonly accountCategories: readonly SupportedCustomerCategory[];
    readonly verifiedCategories: readonly SupportedCustomerCategory[];
    readonly pendingCategories: readonly SupportedCustomerCategory[];
  };
  readonly profiles: readonly CustomerProfileView[];
  readonly profileImage: ProfileImageDeliveryView | null;
  readonly contactState: ContactStateView;
  readonly preferences: PreferencesView;
  readonly addresses: readonly AddressView[];
}

/**
 * Read-only frontend projection for the customer profile screen.
 *
 * Existing services remain the owners of profile, media, contact, preference,
 * and address rules. This service orchestrates their reads in bounded parallel
 * waves so one request cannot exhaust the Prisma transaction pool; it owns no
 * persistence and performs no mutation or success audit.
 */
export class CustomerOverviewService {
  public constructor(
    private readonly profiles: Pick<ProfileService, "get">,
    private readonly profileImages: Pick<ProfileImageService, "get">,
    private readonly addresses: Pick<AddressService, "list">,
    private readonly preferences: Pick<PreferencesService, "get" | "contactState">,
    private readonly denialAudit: DenialAuditWriter,
  ) {}

  public async get(
    principal: AuthenticationPrincipal,
    requestId?: string,
  ): Promise<CustomerOverviewView> {
    const decision = authorizeSharedImageOrAddressSelf({
      principal,
      resourceOwnerUserId: principal.userId,
    });
    if (!decision.allowed) {
      return denyCustomerOperation(
        this.denialAudit,
        principal,
        "customers.overview.read",
        decision.denialCode!,
        requestId,
      );
    }

    const accountCategories = filterCustomerCategories(principal.accountCategories);
    const verifiedCategories = filterCustomerCategories(principal.verifiedCategories);
    const pendingCategories = filterCustomerCategories(principal.pendingCategories);

    const readProfiles = async (): Promise<CustomerProfileView[]> => {
      const views: CustomerProfileView[] = [];
      for (const category of verifiedCategories) {
        views.push(
          await this.profiles.get({
            principal,
            category,
            ...(requestId === undefined ? {} : { requestId }),
          }),
        );
      }
      return views;
    };

    const [profiles, profileImage, contactState] = await Promise.all([
      readProfiles(),
      this.profileImages.get(principal, requestId),
      this.preferences.contactState(principal, requestId),
    ]);
    const [preferences, addresses] = await Promise.all([
      this.preferences.get(principal, requestId),
      this.addresses.list(principal, requestId),
    ]);

    return {
      identity: {
        userId: principal.userId,
        status: "ACTIVE",
        accountCategories,
        verifiedCategories,
        pendingCategories,
      },
      profiles,
      profileImage,
      contactState,
      preferences,
      addresses,
    };
  }
}

function filterCustomerCategories(
  categories: AuthenticationPrincipal["accountCategories"],
): SupportedCustomerCategory[] {
  return SUPPORTED_CUSTOMER_CATEGORIES.filter((category) =>
    categories.includes(category),
  );
}
