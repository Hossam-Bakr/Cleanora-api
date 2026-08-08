import type { AuthenticationPrincipal } from "../../authentication/authentication.public.js";
import type { SupportedCustomerCategory } from "./customer-self.policy.js";

export type ProfileInput =
  | { readonly category: "INDIVIDUAL"; readonly fullName: string }
  | {
      readonly category: "COMPANY";
      readonly companyName: string;
      readonly representativeFullName: string;
    }
  | {
      readonly category: "ENGINEER";
      readonly fullName: string;
      readonly professionalTitle: string;
    };

export interface CustomerProfileView {
  readonly category: SupportedCustomerCategory;
  readonly created: boolean;
  readonly fullName?: string;
  readonly companyName?: string;
  readonly representativeFullName?: string;
  readonly professionalTitle?: string;
}

export interface ProfileCommand {
  readonly principal: AuthenticationPrincipal;
  readonly input: ProfileInput;
  readonly requestId?: string;
}

export interface ProfileImageDeliveryView {
  readonly mediaId: string;
  readonly url: string;
  readonly urlExpiresAt: string;
  readonly associationVersion: number;
  readonly contentType: string;
  readonly width?: number;
  readonly height?: number;
}

export interface CustomerProfileAggregate {
  readonly profiles: readonly CustomerProfileView[];
  readonly profileImage: ProfileImageDeliveryView | null;
}

export interface AddressInput {
  readonly countryCode: string;
  readonly city: string;
  readonly district: string;
  readonly addressText: string;
  readonly building: string | null;
  readonly floor: string | null;
  readonly notes: string | null;
}

export interface AddressView extends AddressInput {
  readonly id: string;
  readonly version: number;
}

export interface PreferencesInput {
  readonly version: number;
  readonly language: "AR" | "EN" | null;
  readonly reminders: { readonly sms: boolean; readonly push: boolean };
  readonly promotional: { readonly sms: boolean; readonly push: boolean };
  readonly mandatory: {
    readonly security: { readonly sms: true; readonly push: true };
    readonly activeService: { readonly sms: true; readonly push: true };
  };
}

export interface ContactStateView {
  readonly phone: { readonly value: string | null; readonly verified: boolean };
  readonly email: { readonly value: string | null; readonly verified: boolean };
}

export type PrivacyRequestPurpose = "DEACTIVATION" | "DELETION" | "EXPORT";
export type PrivacyRequestStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "REJECTED"
  | "CANCELLED";
export type PrivacyRequestOutcomeCode =
  | "REQUEST_FULFILLED"
  | "REQUEST_REJECTED";

/** Safe, owner-visible request metadata. It deliberately carries no rationale or payload. */
export interface PrivacyRequestView {
  readonly id: string;
  readonly purpose: PrivacyRequestPurpose;
  readonly status: PrivacyRequestStatus;
  readonly requestedAt: string;
  readonly updatedAt: string;
  readonly cancelledAt: string | null;
  readonly processingAt: string | null;
  readonly terminalAt: string | null;
  readonly outcomeCode: PrivacyRequestOutcomeCode | null;
}
