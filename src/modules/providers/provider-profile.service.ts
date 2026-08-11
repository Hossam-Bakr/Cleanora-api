import type { AuthenticationPrincipal } from "../authentication/authentication.public.js";
import {
  decideProviderOperation,
  type ProviderAuthorizationFacts,
  type ProviderOperation,
} from "./domain/provider-authorization.policy.js";
import { assertExpectedVersion } from "./domain/provider-lifecycle.policy.js";
import {
  normalizeContactChannels,
  normalizeOperationalEmail,
  normalizeOperationalPhone,
  normalizeProfileText,
} from "./domain/provider-profile.policy.js";
import { providersError } from "./domain/providers.errors.js";
import type {
  ActiveCountryReaderPort,
  ProviderDenialAuditPort,
  ProviderIdentityReaderPort,
  ProviderRepositoryPort,
  ProvidersUnitOfWorkPort,
} from "./domain/providers.ports.js";
import type { ProviderRecord } from "./domain/providers.types.js";
import {
  mapEditableProfile,
  mapPrivateContacts,
  mapProviderPreview,
  type ProviderEditableProfileDto,
  type ProviderPreviewDto,
  type ProviderPrivateContactsDto,
} from "./provider.dto.js";
import { ProviderDenialAuditService } from "./provider-denial-audit.service.js";
import type { ProviderProjectionService } from "./provider-projection.service.js";

export interface ProviderProfileServiceDependencies {
  readonly unitOfWork: ProvidersUnitOfWorkPort;
  readonly providers: ProviderRepositoryPort;
  readonly identityReader: ProviderIdentityReaderPort;
  readonly activeCountries: ActiveCountryReaderPort;
  readonly denialAudit: ProviderDenialAuditPort;
  readonly projections: Pick<ProviderProjectionService, "computeProjections">;
}

/**
 * Editable bilingual profile, private contacts, and contact-free preview.
 */
export class ProviderProfileService {
  private readonly denialAudit: ProviderDenialAuditService;

  public constructor(
    private readonly dependencies: ProviderProfileServiceDependencies,
  ) {
    this.denialAudit = new ProviderDenialAuditService(
      this.dependencies.denialAudit,
    );
  }

  public async getProfile(input: {
    readonly principal: AuthenticationPrincipal;
    readonly providerId: string;
  }): Promise<ProviderEditableProfileDto> {
    const { provider } = await this.loadAuthorizedProvider({
      principal: input.principal,
      providerId: input.providerId,
      operation: "READ_PROFILE",
      action: "providers.profile.get",
    });
    const profile = await this.dependencies.providers.getProfile(provider.id);
    const countryCode = await this.resolveCountryCode(profile?.countryId ?? null);
    return mapEditableProfile({
      profile,
      countryCode,
      version: provider.version,
    });
  }

  public async replaceProfile(input: {
    readonly principal: AuthenticationPrincipal;
    readonly providerId: string;
    readonly displayNameAr: string;
    readonly displayNameEn: string | null;
    readonly descriptionAr: string;
    readonly descriptionEn: string | null;
    readonly countryCode: string;
    readonly expectedVersion: number;
    readonly requestId?: string;
  }): Promise<ProviderEditableProfileDto> {
    assertExpectedVersion(input.expectedVersion);

    const displayNameAr = normalizeProfileText(input.displayNameAr);
    const displayNameEn = normalizeProfileText(input.displayNameEn);
    const descriptionAr = normalizeProfileText(input.descriptionAr);
    const descriptionEn = normalizeProfileText(input.descriptionEn);

    const activeCountry =
      await this.dependencies.activeCountries.resolveActiveCountry(
        input.countryCode.trim().toUpperCase(),
      );
    if (activeCountry === null) {
      throw providersError("VALIDATION_ERROR", {
        field: "countryCode",
        reason: "COUNTRY_UNAVAILABLE",
      });
    }

    return this.dependencies.unitOfWork.run(async (context) => {
      const locked = await context.providers.lockById(input.providerId);
      if (locked === null) {
        throw providersError("PROVIDER_NOT_FOUND");
      }
      const facts = await this.buildAuthorizationFacts({
        principal: input.principal,
        provider: locked,
        providers: context.providers,
      });
      await this.assertOperationOrDeny({
        facts,
        operation: "EDIT_PROFILE_OR_CONTACTS",
        action: "providers.profile.replace",
        providerId: locked.id,
        actorUserId: input.principal.userId,
        ...(input.requestId === undefined
          ? {}
          : { requestId: input.requestId }),
      });

      // Recheck active country inside TX window for CAS safety.
      const rechecked =
        await this.dependencies.activeCountries.resolveActiveCountry(
          activeCountry.code,
        );
      if (rechecked?.id !== activeCountry.id) {
        throw providersError("VALIDATION_ERROR", {
          field: "countryCode",
          reason: "COUNTRY_UNAVAILABLE",
        });
      }

      await context.providers.upsertProfile({
        providerId: locked.id,
        displayNameAr,
        displayNameEn,
        descriptionAr,
        descriptionEn,
        countryId: rechecked.id,
      });

      const updated = await context.providers.bumpVersion({
        providerId: locked.id,
        expectedVersion: input.expectedVersion,
      });

      await context.generalAudit.append({
        actorType: "USER",
        actorId: input.principal.userId,
        action: "providers.profile.replace",
        targetType: "provider",
        targetId: updated.id,
        context: {
          outcome: "SUCCEEDED",
          applicationStatus: updated.applicationStatus,
          countryCode: rechecked.code,
          version: updated.version,
        },
        ...(input.requestId === undefined
          ? {}
          : { requestId: input.requestId }),
      });

      // Touch completion/readiness projections (derived; not persisted).
      await this.recomputeProjections({
        provider: updated,
        providers: context.providers,
        actorUserId: input.principal.userId,
      });

      return mapEditableProfile({
        profile: await context.providers.getProfile(updated.id),
        countryCode: rechecked.code,
        version: updated.version,
      });
    });
  }

  public async getContacts(input: {
    readonly principal: AuthenticationPrincipal;
    readonly providerId: string;
  }): Promise<ProviderPrivateContactsDto> {
    const { provider } = await this.loadAuthorizedProvider({
      principal: input.principal,
      providerId: input.providerId,
      operation: "READ_CONTACTS",
      action: "providers.contacts.get",
    });

    const contact = await this.dependencies.providers.getContact(provider.id);
    const identity =
      await this.dependencies.identityReader.getEligibilityFacts(
        input.principal.userId,
      );

    return mapPrivateContacts({
      contact,
      operationalEmail:
        contact?.operationalEmailNormalized ??
        identity?.emailNormalized ??
        null,
      operationalPhone:
        contact?.operationalPhoneE164 ?? identity?.phoneE164 ?? null,
      version: provider.version,
    });
  }

  public async replaceContacts(input: {
    readonly principal: AuthenticationPrincipal;
    readonly providerId: string;
    readonly operationalEmail: string;
    readonly operationalPhone: string;
    readonly channels: readonly {
      readonly type: "WHATSAPP" | "SOCIAL" | "WEBSITE" | "EXTERNAL_BOOKING";
      readonly value: string;
    }[];
    readonly expectedVersion: number;
    readonly requestId?: string;
  }): Promise<ProviderPrivateContactsDto> {
    assertExpectedVersion(input.expectedVersion);

    const operationalEmailNormalized = normalizeOperationalEmail(
      input.operationalEmail,
    );
    const operationalPhoneE164 = normalizeOperationalPhone(
      input.operationalPhone,
    );
    const channels = normalizeContactChannels(input.channels);

    return this.dependencies.unitOfWork.run(async (context) => {
      const locked = await context.providers.lockById(input.providerId);
      if (locked === null) {
        throw providersError("PROVIDER_NOT_FOUND");
      }
      const facts = await this.buildAuthorizationFacts({
        principal: input.principal,
        provider: locked,
        providers: context.providers,
      });
      await this.assertOperationOrDeny({
        facts,
        operation: "EDIT_PROFILE_OR_CONTACTS",
        action: "providers.contacts.replace",
        providerId: locked.id,
        actorUserId: input.principal.userId,
        ...(input.requestId === undefined
          ? {}
          : { requestId: input.requestId }),
      });

      const contact = await context.providers.upsertContact({
        providerId: locked.id,
        operationalEmailNormalized,
        operationalPhoneE164,
        channels,
      });

      const updated = await context.providers.bumpVersion({
        providerId: locked.id,
        expectedVersion: input.expectedVersion,
      });

      await context.generalAudit.append({
        actorType: "USER",
        actorId: input.principal.userId,
        action: "providers.contacts.replace",
        targetType: "provider",
        targetId: updated.id,
        context: {
          outcome: "SUCCEEDED",
          applicationStatus: updated.applicationStatus,
          channelCount: channels.length,
          version: updated.version,
        },
        ...(input.requestId === undefined
          ? {}
          : { requestId: input.requestId }),
      });

      await this.recomputeProjections({
        provider: updated,
        providers: context.providers,
        actorUserId: input.principal.userId,
      });

      return mapPrivateContacts({
        contact,
        operationalEmail: contact.operationalEmailNormalized,
        operationalPhone: contact.operationalPhoneE164,
        version: updated.version,
      });
    });
  }

  public async getPreview(input: {
    readonly principal: AuthenticationPrincipal;
    readonly providerId: string;
  }): Promise<ProviderPreviewDto> {
    const { provider } = await this.loadAuthorizedProvider({
      principal: input.principal,
      providerId: input.providerId,
      operation: "READ_PREVIEW",
      action: "providers.preview.get",
    });
    const profile = await this.dependencies.providers.getProfile(provider.id);
    const countryCode = await this.resolveCountryCode(profile?.countryId ?? null);
    return mapProviderPreview({
      provider,
      profile,
      countryCode,
    });
  }

  private async loadAuthorizedProvider(input: {
    readonly principal: AuthenticationPrincipal;
    readonly providerId: string;
    readonly operation: ProviderOperation;
    readonly action: string;
    readonly requestId?: string;
  }): Promise<{
    readonly provider: ProviderRecord;
    readonly facts: ProviderAuthorizationFacts;
  }> {
    const provider = await this.dependencies.providers.findById(
      input.providerId,
    );
    if (provider === null) {
      return this.denialAudit.denyAsUnavailable({
        actorUserId: input.principal.userId,
        action: input.action,
        reason: "PROVIDER_MISSING",
        ...(input.requestId === undefined
          ? {}
          : { requestId: input.requestId }),
      });
    }
    const facts = await this.buildAuthorizationFacts({
      principal: input.principal,
      provider,
    });
    await this.assertOperationOrDeny({
      facts,
      operation: input.operation,
      action: input.action,
      providerId: provider.id,
      actorUserId: input.principal.userId,
      ...(input.requestId === undefined
        ? {}
        : { requestId: input.requestId }),
    });
    return { provider, facts };
  }

  private async assertOperationOrDeny(input: {
    readonly facts: ProviderAuthorizationFacts;
    readonly operation: ProviderOperation;
    readonly action: string;
    readonly providerId: string;
    readonly actorUserId: string;
    readonly requestId?: string;
  }): Promise<void> {
    const decision = decideProviderOperation(input.facts, input.operation);
    if (decision.allowed) {
      return;
    }
    if (decision.denialCode === "PROVIDER_STATE_CONFLICT") {
      throw providersError("PROVIDER_STATE_CONFLICT", {
        reason: decision.reason ?? "STATE_LOCKED",
      });
    }
    if (decision.denialCode === "PROVIDER_ACCESS_DENIED") {
      return this.denialAudit.denyAccess({
        actorUserId: input.actorUserId,
        action: input.action,
        targetId: input.providerId,
        reason: "PERMISSION_DENIED",
        ...(input.requestId === undefined
          ? {}
          : { requestId: input.requestId }),
      });
    }
    return this.denialAudit.denyAsUnavailable({
      actorUserId: input.actorUserId,
      action: input.action,
      targetId: input.providerId,
      reason: "SCOPE_DENIED",
      ...(input.requestId === undefined
        ? {}
        : { requestId: input.requestId }),
    });
  }

  private async buildAuthorizationFacts(input: {
    readonly principal: AuthenticationPrincipal;
    readonly provider: ProviderRecord;
    readonly providers?: ProviderRepositoryPort;
  }): Promise<ProviderAuthorizationFacts> {
    const repository = input.providers ?? this.dependencies.providers;
    const membership = await repository.findMember({
      providerId: input.provider.id,
      userId: input.principal.userId,
    });
    const identity =
      await this.dependencies.identityReader.getEligibilityFacts(
        input.principal.userId,
      );

    return {
      actorUserId: input.principal.userId,
      actorActive: identity?.active === true,
      applicationOwnerUserId: input.provider.applicationOwnerUserId,
      membership:
        membership === null
          ? null
          : {
              level: membership.level,
              status: membership.status,
            },
      staffAdmin: false,
      providerAdminEnabled: identity?.providerAdminEnabled ?? false,
      applicationStatus: input.provider.applicationStatus,
      operationalStatus: input.provider.operationalStatus,
    };
  }

  private async resolveCountryCode(
    countryId: string | null,
  ): Promise<string | null> {
    if (countryId === null) {
      return null;
    }
    const country = await this.dependencies.activeCountries.getById(countryId);
    return country?.code ?? null;
  }

  private async recomputeProjections(input: {
    readonly provider: ProviderRecord;
    readonly providers: ProviderRepositoryPort;
    readonly actorUserId: string;
  }): Promise<{
    readonly completionPercentage: number;
  }> {
    const { completion } = await this.dependencies.projections.computeProjections(
      input.provider,
      input.providers,
    );
    void input.actorUserId;
    return { completionPercentage: completion.percentage };
  }
}
