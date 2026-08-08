import type { DenialAuditWriter } from "#modules/admin/audit.service";
import type { AuthenticationPrincipal } from "#modules/authentication/authentication.public";

import { authorizeContactPrefsPrivacySelf } from "./domain/customer-self.policy.js";
import { customersError } from "./domain/customers.errors.js";
import type { ContactStateView, PreferencesInput } from "./domain/customers.types.js";
import { denyCustomerOperation } from "./domain/ownership-denial.js";
import { IdentityContactRead } from "./infrastructure/identity-contact.read.js";
import {
  PrismaPreferencesRepository,
  type StoredPreferences,
} from "./infrastructure/prisma-preferences.repository.js";
import { PrismaCustomersUnitOfWork } from "./infrastructure/prisma-customers.unit-of-work.js";

export interface PreferencesView {
  readonly version: number;
  readonly language: "AR" | "EN" | null;
  readonly reminders: { readonly sms: boolean; readonly push: boolean };
  readonly promotional: { readonly sms: boolean; readonly push: boolean };
  readonly mandatory: {
    readonly security: { readonly sms: true; readonly push: true };
    readonly activeService: { readonly sms: true; readonly push: true };
  };
}

const mandatory = {
  security: { sms: true, push: true },
  activeService: { sms: true, push: true },
} as const;

function view(preferences: StoredPreferences | undefined): PreferencesView {
  return {
    version: preferences?.version ?? 1,
    language: preferences?.language ?? null,
    reminders: {
      sms: preferences?.remindersSms ?? false,
      push: preferences?.remindersPush ?? false,
    },
    promotional: {
      sms: preferences?.promotionalSms ?? false,
      push: preferences?.promotionalPush ?? false,
    },
    mandatory,
  };
}

/** DEC-032 full-replacement preference workflow and identity contact projection. */
export class PreferencesService {
  public constructor(
    private readonly unitOfWork: PrismaCustomersUnitOfWork,
    private readonly repository: PrismaPreferencesRepository,
    private readonly contacts: IdentityContactRead,
    private readonly denialAudit: DenialAuditWriter,
  ) {}

  public async get(principal: AuthenticationPrincipal, requestId?: string): Promise<PreferencesView> {
    await this.authorize(principal, "customers.preferences.read", requestId);
    return this.unitOfWork.run(async (context) => view(
      await this.repository.get(context.prisma, principal.userId),
    ));
  }

  public async replace(
    principal: AuthenticationPrincipal,
    input: PreferencesInput,
    requestId?: string,
  ): Promise<PreferencesView> {
    await this.authorize(principal, "customers.preferences.replace", requestId);
    if (
      input.mandatory.security.sms !== true ||
      input.mandatory.security.push !== true ||
      input.mandatory.activeService.sms !== true ||
      input.mandatory.activeService.push !== true
    ) {
      throw customersError("CUSTOMER_PREFERENCES_INVALID");
    }
    return this.unitOfWork.run(async (context) => {
      const preferences = await this.repository.replace(context.prisma, principal.userId, input);
      if (preferences === undefined) throw customersError("CUSTOMER_PREFERENCES_CONFLICT");
      await context.generalAudit.append({
        actorType: "USER",
        actorId: principal.userId,
        action: "customers.preferences.replace",
        targetType: "user_preferences",
        targetId: principal.userId,
        context: { outcome: "SUCCEEDED" },
        ...(requestId === undefined ? {} : { requestId }),
      });
      return view(preferences);
    });
  }

  public async contactState(
    principal: AuthenticationPrincipal,
    requestId?: string,
  ): Promise<ContactStateView> {
    await this.authorize(principal, "customers.contact-state.read", requestId);
    return this.contacts.read(principal.userId);
  }

  private async authorize(
    principal: AuthenticationPrincipal,
    action: string,
    requestId?: string,
  ): Promise<void> {
    const decision = authorizeContactPrefsPrivacySelf({
      principal,
      resourceOwnerUserId: principal.userId,
    });
    if (!decision.allowed) {
      await denyCustomerOperation(this.denialAudit, principal, action, decision.denialCode!, requestId);
    }
  }
}
