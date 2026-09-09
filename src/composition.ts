import { APPLICATION_NAME } from "#config/constants";
import {
  assertR1P06RuntimeEnvironment,
  assertCustomersRuntimeEnvironment,
  resolveProviderRuntimeConfig,
  type AppEnvironment,
} from "#config/env";
import { assertReferencedPayoutKeysAvailable, parsePayoutKeyRings } from "#config/payout-data-keys";
import { PrismaLifecycle } from "#database/prisma-lifecycle";
import { Argon2PasswordHasherAdapter } from "#integrations/authentication/argon2-password-hasher.adapter";
import { CryptoVerifierAdapter } from "#integrations/authentication/crypto-verifier.adapter";
import { JwtTokenServiceAdapter } from "#integrations/authentication/jwt-token-service.adapter";
import { MemoryGoogleTransactionStoreAdapter } from "#integrations/authentication/memory-google-transaction-store.adapter";
import { AuthenticationEmailAdapter } from "#integrations/email/authentication-email.adapter";
import { createNodemailerEmailAdapter } from "#integrations/email/nodemailer.adapter";
import { UnavailableEmailAdapter } from "#integrations/email/unavailable-email.adapter";
import { OpenIdClientGoogleAdapter } from "#integrations/google/openid-client-google.adapter";
import { MemoryRateLimiterAdapter } from "#integrations/security/memory-rate-limiter.adapter";
import type { RateLimiterPort } from "#middlewares/rate-limit.types";
import { createPrismaPrivilegedAuditWriter } from "#modules/admin/infrastructure/prisma-privileged-audit.writer";
import { createPrismaGeneralTransactionalAuditWriter } from "#modules/admin/infrastructure/prisma-general-transactional-audit.writer";
import { createPrismaDenialAuditWriter } from "#modules/admin/infrastructure/prisma-denial-audit.writer";
import {
  PrismaAcceptedPayoutRevealAuthorizer,
  PrismaPayoutRevealAuditGate,
} from "#modules/admin/infrastructure/prisma-payout-reveal-audit.gate";
import {
  createAuthenticationModule,
  createAuthenticationPolicy,
} from "#modules/authentication/auth.module";
import { AuthorizationService } from "#modules/authentication/authorization.service";
import { AuthorizationRepository } from "#modules/authentication/infrastructure/authorization.repository";
import {
  PrismaAuthenticationProofConsumption,
  PrismaAuthenticationProofUseAuthorizer,
  PrismaProviderServiceStaffAuthorizer,
  PrismaR1P06StaffPermissionAuthorizer,
} from "#modules/authentication/infrastructure/prisma-r1-p06-security.adapters";
import { ProviderSensitiveActionProofVerifier } from "#modules/authentication/infrastructure/provider-sensitive-action-proof.verifier";
import { PrismaOwnerStaffAdminUnitOfWork } from "#modules/authentication/infrastructure/prisma-owner-staff-admin.unit-of-work";
import { PrismaRoleManagementUnitOfWork } from "#modules/authentication/infrastructure/prisma-role-management.unit-of-work";
import { createOwnerInternalRouter } from "#modules/authentication/owner-staff-admin.routes";
import { OwnerStaffAdminProvisionService } from "#modules/authentication/owner-staff-admin.service";
import { RoleManagementService } from "#modules/authentication/role-management.service";
import { PrismaCustomersUnitOfWork } from "#modules/customers/infrastructure/prisma-customers.unit-of-work";
import { PrismaAddressRepository } from "#modules/customers/infrastructure/prisma-address.repository";
import { PrismaPreferencesRepository } from "#modules/customers/infrastructure/prisma-preferences.repository";
import { IdentityContactRead } from "#modules/customers/infrastructure/identity-contact.read";
import { AddressService } from "#modules/customers/address.service";
import { PreferencesService } from "#modules/customers/preferences.service";
import { PrismaPrivacyRequestRepository } from "#modules/customers/infrastructure/prisma-privacy-request.repository";
import { PrivacyRequestService } from "#modules/customers/privacy-request.service";
import { PrivacyProcessorService, type PrivacyProcessorPort } from "#modules/customers/privacy-processor.service";
import { PrivacyPrivilegedService, type PrivacyPrivilegedPort } from "#modules/customers/privacy-privileged.service";
import { PrivacyRetentionSweep, startPrivacyRetentionSweep } from "#modules/customers/privacy-retention.sweep";
import { PrismaProfileRepository } from "#modules/customers/infrastructure/prisma-profile.repository";
import { ProfileImageService } from "#modules/customers/profile-image.service";
import { ProfileService } from "#modules/customers/profile.service";
import { createCustomersRouter } from "#modules/customers/customers.routes";
import { createPrismaCustomerSignupProfileWriter } from "#modules/customers/infrastructure/prisma-customer-signup-profile.writer";
import {
  createMediaPendingUploadPort,
  createMediaStoragePort,
  createProviderMediaPort,
  createProviderMediaStatusReader,
  createTransactionalWorkerAvatarAuthorizer,
  createWorkerAvatarPort,
  createProviderVerificationEvidencePort,
  createTransactionalProviderVerificationEvidenceAuthorizer,
} from "#modules/media/infrastructure/media-provider.factory";
import { ClamAvVerificationMalwareScanner } from "#modules/media/infrastructure/clamav-verification-malware-scanner";
import { SharpProfileImageProcessor } from "#modules/media/infrastructure/sharp-profile-image.processor";
import { PrismaMediaRepository } from "#modules/media/infrastructure/prisma-media.repository";
import {
  MediaCleanupService,
  startMediaCleanupSweep,
} from "#modules/media/infrastructure/media-cleanup.service";
import { getActiveCountryIdByCode } from "#modules/configuration/configuration.service";
import {
  createActiveCountryReader,
  createTransactionalActiveCountryReader,
  createTransactionalCountryTimeZoneReader,
  createTransactionalLocalityReader,
} from "#modules/configuration/configuration.public";
import { createPrismaLocalityRepository, withLocalityTransaction } from "#modules/configuration/infrastructure/prisma-locality.repository";
import { LocalityService } from "#modules/configuration/locality.service";
import { createLocalityRouter } from "#modules/configuration/locality.routes";
import {
  withProviderAvailabilityReadTransaction,
  withProviderAvailabilityWriteTransaction,
} from "#modules/providers/infrastructure/prisma-provider-availability.repository";
import { ProviderAvailabilityService } from "#modules/providers/provider-availability.service";
import { ProviderCapacityService } from "#modules/providers/provider-capacity.service";
import { ProviderOperationalAvailabilityService } from "#modules/providers/provider-operational-availability.service";
import { ProviderWorkerAvailabilityService } from "#modules/providers/provider-worker-availability.service";
import { createProviderAvailabilityRouter } from "#modules/providers/provider-availability.routes";
import {
  createPrismaProviderIdentityAuthorityWriterFactory,
  createPrismaProviderIdentityReader,
  createProviderInvitationIdentityOnboarding,
  createPrismaWorkerIdentityAuthorityWriterFactory,
  createPrismaWorkerIdentityReaderFactory,
  createPrismaWorkerProofUseAuthorizerFactory,
  createWorkerInvitationIdentityOnboarding,
  WorkerSensitiveActionProofVerifier,
} from "#modules/authentication/authentication.factories";
import { createProviderApplicantProfileReader, createProviderPayoutHolderAuthorityReader } from "#modules/customers/customers.public";
import {
  createProviderAdminInvitationRouter,
  createProvidersRouter,
  createStaffProvidersRouter,
} from "#modules/providers/providers.routes";
import { ProviderApplicationService } from "#modules/providers/provider-application.service";
import { ProviderApprovalService } from "#modules/providers/provider-approval.service";
import { ProviderInvitationAcceptanceService } from "#modules/providers/provider-invitation-acceptance.service";
import { ProviderInvitationOnboardingService } from "#modules/providers/provider-invitation-onboarding.service";
import { ProviderMediaService } from "#modules/providers/provider-media.service";
import { ProviderMembershipService } from "#modules/providers/provider-membership.service";
import { ProviderProfileService } from "#modules/providers/provider-profile.service";
import { ProviderProjectionService } from "#modules/providers/provider-projection.service";
import { ProviderReviewQueryService } from "#modules/providers/provider-review-query.service";
import { ProviderReviewService } from "#modules/providers/provider-review.service";
import { ProviderLifecycleService } from "#modules/providers/provider-lifecycle.service";
import { ProviderDenialAuditService } from "#modules/providers/provider-denial-audit.service";
import { deriveDocumentVerificationTruth } from "#modules/providers/domain/provider-verification.policy";
import { PrismaProviderVerificationRepository } from "#modules/providers/infrastructure/prisma-provider-verification.repository";
import { PrismaProviderPayoutRepository } from "#modules/providers/infrastructure/prisma-provider-payout.repository";
import { PrismaPayoutRegistryRepository } from "#modules/providers/infrastructure/prisma-payout-registry.repository";
import { ProviderDocumentService } from "#modules/providers/provider-document.service";
import { ProviderDocumentReviewService } from "#modules/providers/provider-document-review.service";
import { ProviderDocumentReviewQueryService } from "#modules/providers/provider-document-review-query.service";
import { ProviderDocumentPolicyService } from "#modules/providers/provider-document-policy.service";
import { ProviderDocumentExpirySweep } from "#modules/providers/provider-document-expiry.sweep";
import { ProviderPolicyActivationSweep } from "#modules/providers/provider-policy-activation.sweep";
import { ProviderVerificationHistoryService } from "#modules/providers/provider-verification-history.service";
import { ProviderVerificationQueryService } from "#modules/providers/provider-verification-query.service";
import { ProviderPayoutConflictService } from "#modules/providers/provider-payout-conflict.service";
import { ProviderPayoutDestinationService } from "#modules/providers/provider-payout-destination.service";
import { ProviderPayoutPrimaryService } from "#modules/providers/provider-payout-primary.service";
import { ProviderPayoutHistoryService } from "#modules/providers/provider-payout-history.service";
import { ProviderPayoutRevealService } from "#modules/providers/provider-payout-reveal.service";
import { ProviderPayoutVerificationService } from "#modules/providers/provider-payout-verification.service";
import { ProviderPayoutReviewQueryService } from "#modules/providers/provider-payout-review-query.service";
import { ProviderInvitationEmailAdapter } from "#modules/providers/infrastructure/provider-invitation-email.adapter";
import { ProviderEmailDeliveryAdapter } from "#modules/providers/infrastructure/provider-email-delivery.adapter";
import {
  ProviderEmailDispatcher,
  startProviderEmailDispatcher,
} from "#modules/providers/provider-email-dispatcher";
import { PrismaProviderEmailOutboxRepository } from "#modules/providers/infrastructure/prisma-provider-email-outbox.repository";
import { PrismaProviderMediaRepository } from "#modules/providers/infrastructure/prisma-provider-media.repository";
import { PrismaProviderReviewRepository } from "#modules/providers/infrastructure/prisma-provider-review.repository";
import { PrismaProviderRepository } from "#modules/providers/infrastructure/prisma-provider.repository";
import { PrismaProvidersUnitOfWork } from "#modules/providers/infrastructure/prisma-providers.unit-of-work";
import { PrismaProvidersWorkforceUnitOfWork } from "#modules/providers/infrastructure/prisma-providers-workforce.unit-of-work";
import { PrismaProviderWorkforceNotificationRepository } from "#modules/providers/infrastructure/prisma-provider-workforce-notification.repository";
import { PrismaProviderWorkforceRepository } from "#modules/providers/infrastructure/prisma-provider-workforce.repository";
import { ProviderWorkforceEmailDeliveryAdapter } from "#modules/providers/infrastructure/provider-workforce-email-delivery.adapter";
import { HmacWorkerInvitationProofAdapter } from "#modules/providers/infrastructure/worker-invitation-proof.adapter";
import { ProviderWorkforceService } from "#modules/providers/provider-workforce.service";
import { ProviderWorkforceQueryService } from "#modules/providers/provider-workforce-query.service";
import { ProviderWorkforceMediaService } from "#modules/providers/provider-workforce-media.service";
import { ProviderWorkforceLifecycleService } from "#modules/providers/provider-workforce-lifecycle.service";
import { ProviderWorkforceInvitationService } from "#modules/providers/provider-workforce-invitation.service";
import { ProviderWorkforceInvitationQueryService } from "#modules/providers/provider-workforce-invitation-query.service";
import { ProviderWorkforceOnboardingService } from "#modules/providers/provider-workforce-onboarding.service";
import { ProviderWorkforceInvitationAcceptanceService } from "#modules/providers/provider-workforce-invitation-acceptance.service";
import { ProviderWorkforceAccessService } from "#modules/providers/provider-workforce-access.service";
import { ProviderWorkforceAuthorityService } from "#modules/providers/provider-workforce-authority.service";
import { ProviderTeamService } from "#modules/providers/provider-team.service";
import { ProviderTeamMembershipService } from "#modules/providers/provider-team-membership.service";
import { ProviderTeamSupervisorService } from "#modules/providers/provider-team-supervisor.service";
import { ProviderTeamQueryService } from "#modules/providers/provider-team-query.service";
import { ProviderWorkforceReadinessService } from "#modules/providers/provider-workforce-readiness.service";
import { ProviderWorkerSelfService } from "#modules/providers/provider-worker-self.service";
import {
  ProviderWorkforceNotificationDispatcher,
  startProviderWorkforceNotificationDispatcher,
} from "#modules/providers/provider-workforce-notification.dispatcher";
import { createProviderWorkforceRouter } from "#modules/providers/provider-workforce.routes";
import { createProviderWorkforceInvitationRouter } from "#modules/providers/provider-workforce-invitation.routes";
import { createProviderWorkerSelfRouter } from "#modules/providers/provider-worker-self.routes";
import type {
  ActiveCountryReaderPort,
  ProviderApplicantProfileReaderPort,
  ProviderIdentityReaderPort,
} from "#modules/providers/domain/providers.ports";
import type { RouteDependencies } from "#routes/index";
import {
  createApplicationLogger,
  type Logger,
} from "#shared/logger";
import { AppError } from "#shared/errors/app-error";
import { createCatalogRouter } from "#modules/catalog/catalog.routes";
import { CatalogService } from "#modules/catalog/catalog.service";
import { PrismaCatalogRepository } from "#modules/catalog/catalog.repository";
import {
  createCatalogDefinitionReader,
  createTransactionalCatalogDefinitionReaderFactory,
} from "#modules/catalog/catalog.public";
import type { CatalogDefinitionReader } from "#modules/catalog/catalog.public";
import { createTransactionalProviderServicePricingPolicyReader } from "#modules/configuration/configuration.public";
import {
  createCatalogServiceImagePort,
  createTransactionalCatalogServiceImageAuthorizer,
  createTransactionalCatalogServiceMediaFactsReader,
} from "#modules/media/infrastructure/media-provider.factory";
import { PrismaProviderServiceUnitOfWork } from "#modules/providers/infrastructure/prisma-provider-service.unit-of-work";
import { ProviderServiceService } from "#modules/providers/provider-service.service";
import { ProviderServiceQueryService } from "#modules/providers/provider-service-query.service";
import { ProviderServiceSnapshotService } from "#modules/providers/provider-service-snapshot.service";
import { createProviderServiceRouter, createStaffProviderServiceRouter } from "#modules/providers/provider-service.routes";
import {
  createProviderServiceSnapshotReader,
  createProviderServicesReadyFactsReader,
  createProviderOperationalAvailabilityReader,
  createBoundEligibilityAvailabilityReader,
  createBoundEligibilityPricingReader,
  createBoundEligibilityProviderLifecycleReader,
  createTransactionalEligibilityAvailabilityReaderFactory,
  createTransactionalEligibilityPricingReaderFactory,
  createTransactionalEligibilityProviderLifecycleReaderFactory,
  type ProviderOperationalAvailabilityReader,
  type ProviderServiceSnapshotReader,
  type ProviderServicesReadyFactsReader,
} from "#modules/providers/providers.public";
import {
  createEligibilityApplicationService,
  type EligibilityApplicationService,
} from "#modules/eligibility/eligibility.public";
import { EligibilityUnitOfWork } from "#modules/eligibility/infrastructure/eligibility.unit-of-work";

function adaptProviderActiveCountryReader(
  reader = createActiveCountryReader(),
): ActiveCountryReaderPort {
  return {
    async resolveActiveCountry(countryCode) {
      try {
        return await reader.resolveActiveCountry(countryCode);
      } catch (error) {
        if (error instanceof AppError && error.code === "COUNTRY_UNAVAILABLE") {
          return null;
        }
        throw error;
      }
    },
    async getById(countryId) {
      return reader.getActiveCountryById(countryId);
    },
  };
}

function adaptProviderIdentityReader(
  reader: ReturnType<typeof createPrismaProviderIdentityReader>,
): ProviderIdentityReaderPort {
  return {
    async getEligibilityFacts(userId) {
      const identity = await reader.getIdentity(userId);
      if (identity === null) {
        return null;
      }
      return {
        accountActive: identity.isAccountActive,
        active: identity.isActiveNonVerificationOnly,
        verificationOnly: !identity.isActiveNonVerificationOnly,
        enrolledCategories: identity.accountCategories,
        verifiedCategories: identity.verifiedCategories,
        emailNormalized: identity.emailNormalized,
        emailVerified: identity.emailVerified,
        phoneE164: identity.phoneE164,
        phoneVerified: identity.phoneVerified,
        providerAdminEnabled: identity.providerAdminEnabled,
      };
    },
    async getAuthoritativeEmail(userId) {
      const identity = await reader.getIdentity(userId);
      return identity?.emailNormalized ?? null;
    },
    async findByEmailNormalized(emailNormalized) {
      const identity = await reader.findByEmailNormalized(emailNormalized);
      if (identity === null || identity.emailNormalized === null) {
        return null;
      }
      return {
        userId: identity.userId,
        emailNormalized: identity.emailNormalized,
        emailVerified: identity.emailVerified,
        accountActive: identity.isAccountActive,
        active: identity.isActiveNonVerificationOnly,
      };
    },
  };
}

function adaptProviderApplicantProfileReader(
  reader: ReturnType<typeof createProviderApplicantProfileReader>,
): ProviderApplicantProfileReaderPort {
  return {
    async getMatchingApplicantContext(input) {
      const category =
        input.providerKind === "INDIVIDUAL_TEAM" ? "INDIVIDUAL" : "COMPANY";
      const profile = await reader.readApplicantProfile({
        userId: input.userId,
        category,
      });
      if (profile.category === "INDIVIDUAL") {
        return {
          category: "INDIVIDUAL",
          profileComplete: profile.profileComplete,
          individualFullName: profile.fullName,
          companyName: null,
          representativeFullName: null,
        };
      }
      return {
        category: "COMPANY",
        profileComplete: profile.profileComplete,
        individualFullName: null,
        companyName: profile.companyName,
        representativeFullName: profile.representativeFullName,
      };
    },
  };
}

export interface RuntimeDependencies {
  readonly database: PrismaLifecycle;
  readonly logger: Logger;
  readonly routes: RouteDependencies;
  /**
   * Internal R1-P03 authorization contracts. Role management is also exposed
   * through authenticated staff-admin HTTP commands (non-customer roles).
   */
  readonly authorization: AuthorizationService;
  readonly roleManagement: RoleManagementService;
  readonly ownerStaffAdminProvision: OwnerStaffAdminProvisionService;
  /** Composition-only handoff contracts; no public processor or staff route exists. */
  readonly privacyProcessor: PrivacyProcessorPort | undefined;
  readonly privacyPrivileged: PrivacyPrivilegedPort | undefined;
  readonly startCustomersBackgroundTasks: (() => () => void) | undefined;
  /** Internal Catalog reader for future module wiring; not an HTTP surface. */
  readonly catalogDefinitionReader: CatalogDefinitionReader;
  /**
   * Internal R1-P09 readiness/snapshot readers for composition-authorized
   * consumers only — never mounted as customer/anonymous HTTP.
   */
  readonly providerServicesReadyFactsReader:
    | ProviderServicesReadyFactsReader
    | undefined;
  readonly providerServiceSnapshotReader:
    | ProviderServiceSnapshotReader
    | undefined;
  readonly providerOperationalAvailabilityReader:
    | ProviderOperationalAvailabilityReader
    | undefined;
  /**
   * In-process Eligibility application surface (R1-P11). Composition-only —
   * no Eligibility HTTP routes in this phase.
   */
  readonly eligibilityApplicationService: EligibilityApplicationService;
}

/**
 * Wire the R1-P03 authorization contracts.
 *
 * This is the one place where the admin Prisma audit-writer factory is injected
 * into the identity unit of work, so identity keeps business ports only and
 * admin stays the sole writer of `audit_logs`.
 */
function createAuthorizationDependencies(): {
  readonly authorization: AuthorizationService;
  readonly roleManagement: RoleManagementService;
} {
  const authorization = new AuthorizationService(new AuthorizationRepository());
  const unitOfWork = new PrismaRoleManagementUnitOfWork(
    createPrismaPrivilegedAuditWriter,
  );

  return {
    authorization,
    roleManagement: new RoleManagementService(unitOfWork),
  };
}

function createOwnerStaffAdminProvision(
  environment: AppEnvironment,
): OwnerStaffAdminProvisionService {
  return new OwnerStaffAdminProvisionService(
    {
      enabled: environment.OWNER_ADMIN_API_ENABLED,
      secret: environment.OWNER_ADMIN_SECRET,
    },
    new PrismaOwnerStaffAdminUnitOfWork(createPrismaPrivilegedAuditWriter),
  );
}

function createAuthenticationModuleForRuntime(
  environment: AppEnvironment,
  rateLimiter: RateLimiterPort,
  roleManagement: RoleManagementService,
): ReturnType<typeof createAuthenticationModule> | undefined {
  if (!environment.AUTH_ENABLED) {
    return undefined;
  }

  const email = environment.EMAIL_AUTH_ENABLED
    ? createNodemailerEmailAdapter({
        host: environment.SMTP_HOST!,
        port: environment.SMTP_PORT!,
        secure: environment.SMTP_SECURE!,
        requireTls: environment.SMTP_REQUIRE_TLS!,
        user: environment.SMTP_USER!,
        password: environment.SMTP_PASSWORD!,
        fromName: environment.SMTP_FROM_NAME!,
        fromEmail: environment.SMTP_FROM_EMAIL!,
        connectionTimeoutMilliseconds: environment.SMTP_CONNECTION_TIMEOUT_MS!,
        socketTimeoutMilliseconds: environment.SMTP_SOCKET_TIMEOUT_MS!,
      })
    : new UnavailableEmailAdapter();

  const authentication = createAuthenticationModule({
    trustedOrigins: environment.CORS_ORIGINS,
    cookie: {
      name: environment.AUTH_REFRESH_COOKIE_NAME,
      path: environment.AUTH_REFRESH_COOKIE_PATH,
      secure: environment.AUTH_COOKIE_SECURE,
      sameSite: environment.AUTH_COOKIE_SAME_SITE,
    },
    passwordHasher: new Argon2PasswordHasherAdapter(),
    tokens: new JwtTokenServiceAdapter({
      accessSecret: environment.JWT_ACCESS_SECRET!,
      refreshSecret: environment.JWT_REFRESH_SECRET!,
      issuer: environment.JWT_ISSUER,
      audience: environment.JWT_AUDIENCE,
      accessTtlSeconds: environment.JWT_ACCESS_TTL_SECONDS,
    }),
    verifier: new CryptoVerifierAdapter(environment.AUTH_VERIFIER_SECRET!),
    privacyHashSecret: environment.AUTH_PRIVACY_HASH_SECRET!,
    sensitiveProofSecret: environment.AUTH_VERIFIER_SECRET!,
    policy: createAuthenticationPolicy(),
    email: new AuthenticationEmailAdapter(email),
    customerSignupProfiles: createPrismaCustomerSignupProfileWriter,
    accessTtlSeconds: environment.JWT_ACCESS_TTL_SECONDS,
    refreshTtlSeconds: environment.JWT_REFRESH_TTL_SECONDS,
    rateLimiter,
    roleManagement,
    ...(environment.GOOGLE_AUTH_ENABLED
      ? {
          googleIdentity: new OpenIdClientGoogleAdapter(
            environment.GOOGLE_CLIENT_ID!,
            environment.GOOGLE_CLIENT_SECRET!,
            environment.GOOGLE_REDIRECT_URI!,
          ),
          googleTransactions: new MemoryGoogleTransactionStoreAdapter(),
          googleProviderCallbackUri: environment.GOOGLE_REDIRECT_URI!,
          googleFrontendCallbackUri: environment.GOOGLE_FRONTEND_CALLBACK_URI!,
        }
      : {}),
  });

  return authentication;
}

/** Construct the existing runtime adapters without starting the process. */
export function createRuntimeDependencies(
  environment: AppEnvironment,
): RuntimeDependencies {
  const logger = createApplicationLogger(environment.LOG_LEVEL, {
    application: APPLICATION_NAME,
    environment: environment.NODE_ENV,
  });
  const database = new PrismaLifecycle(environment.DATABASE_URL);
  /**
   * Late-bound so Provider projections (composed earlier) can consume dynamic
   * R1-P09 servicesReady facts once the Provider-service UoW exists.
   */
  const servicesReadyFactsHolder: {
    current: ProviderServicesReadyFactsReader | null;
  } = { current: null };
  const rateLimiter = new MemoryRateLimiterAdapter();
  const { authorization, roleManagement } = createAuthorizationDependencies();
  const ownerStaffAdminProvision = createOwnerStaffAdminProvision(environment);
  const authentication = createAuthenticationModuleForRuntime(
    environment,
    rateLimiter,
    roleManagement,
  );
  const ownerInternalRouter = createOwnerInternalRouter({
    service: ownerStaffAdminProvision,
    limiter: rateLimiter,
    privacyHashSecret:
      environment.AUTH_PRIVACY_HASH_SECRET ??
      "cleanora-owner-rate-limit-subject-hash",
  });
  const customersRouter =
    authentication === undefined
      ? undefined
      : (() => {
          assertCustomersRuntimeEnvironment(environment);
          const unitOfWork = new PrismaCustomersUnitOfWork(
            createPrismaGeneralTransactionalAuditWriter,
            createPrismaPrivilegedAuditWriter,
          );
          const denialAudit = createPrismaDenialAuditWriter();
          const privacyRepository = new PrismaPrivacyRequestRepository();
          const mediaSelection = createMediaStoragePort(environment);
          const pendingUploads = createMediaPendingUploadPort();
          const profileRepository = new PrismaProfileRepository();
          const processor = new SharpProfileImageProcessor();
          return createCustomersRouter({
            authenticateAccess: authentication.authenticateAccess,
            profiles: new ProfileService(
              unitOfWork,
              profileRepository,
              denialAudit,
            ),
            profileImages: new ProfileImageService(
              unitOfWork,
              mediaSelection.storage,
              processor,
              pendingUploads,
              profileRepository,
              denialAudit,
              environment.CLOUDINARY_PROFILE_IMAGE_FOLDER,
              mediaSelection.signedUrlTtlSeconds,
            ),
            addresses: new AddressService(
              unitOfWork,
              new PrismaAddressRepository(),
              {
                resolveActiveCountry: async (countryCode) => {
                  return { id: await getActiveCountryIdByCode(countryCode) };
                },
              },
              denialAudit,
            ),
            preferences: new PreferencesService(
              unitOfWork,
              new PrismaPreferencesRepository(),
              new IdentityContactRead(authentication.identityContactReader),
              denialAudit,
            ),
            privacyRequests: new PrivacyRequestService(
              unitOfWork, privacyRepository, environment.PRIVACY_REQUEST_TERMINAL_RETENTION_DAYS, denialAudit,
            ),
          });
        })();
  const privacyRepository =
    authentication === undefined ? undefined : new PrismaPrivacyRequestRepository();
  const privacyProcessor =
    authentication === undefined ? undefined : new PrivacyProcessorService(
      new PrismaCustomersUnitOfWork(
        createPrismaGeneralTransactionalAuditWriter, createPrismaPrivilegedAuditWriter,
      ),
      privacyRepository!, environment.PRIVACY_REQUEST_TERMINAL_RETENTION_DAYS!,
    );
  const privacyPrivileged =
    authentication === undefined ? undefined : new PrivacyPrivilegedService(
      new PrismaCustomersUnitOfWork(
        createPrismaGeneralTransactionalAuditWriter, createPrismaPrivilegedAuditWriter,
      ),
      privacyRepository!, authorization,
    );
  const startCustomerMaintenanceTasks =
    authentication === undefined
      ? undefined
      : (): (() => void) => {
          assertCustomersRuntimeEnvironment(environment);
          const mediaSelection = createMediaStoragePort(environment);
          const stopPrivacy = startPrivacyRetentionSweep(
            new PrivacyRetentionSweep(
              new PrismaCustomersUnitOfWork(
                createPrismaGeneralTransactionalAuditWriter,
                createPrismaPrivilegedAuditWriter,
              ),
              privacyRepository!,
            ),
            logger,
          );
          const stopMedia = startMediaCleanupSweep(
            new MediaCleanupService(
              new PrismaMediaRepository(),
              mediaSelection.storage,
            ),
            logger,
          );
          return (): void => {
            stopPrivacy();
            stopMedia();
          };
        };

  const providersComposition =
    authentication === undefined
      ? undefined
      : (() => {
          assertR1P06RuntimeEnvironment(environment);
          const payoutKeyRings = parsePayoutKeyRings({
            PAYOUT_DATA_ENCRYPTION_KEYS_JSON: environment.PAYOUT_DATA_ENCRYPTION_KEYS_JSON,
            PAYOUT_DATA_ENCRYPTION_ACTIVE_KEY_ID: environment.PAYOUT_DATA_ENCRYPTION_ACTIVE_KEY_ID,
            PAYOUT_LOOKUP_HMAC_KEYS_JSON: environment.PAYOUT_LOOKUP_HMAC_KEYS_JSON,
            PAYOUT_LOOKUP_HMAC_ACTIVE_KEY_ID: environment.PAYOUT_LOOKUP_HMAC_ACTIVE_KEY_ID,
          });
          const scannerUrl = new URL(environment.PROVIDER_VERIFICATION_SCANNER_PROVIDER);
          const createTransactionalStaffPermissionAuthorizer = (transaction: unknown) =>
            new PrismaR1P06StaffPermissionAuthorizer(
              transaction as ConstructorParameters<typeof PrismaR1P06StaffPermissionAuthorizer>[0],
            );
          const createTransactionalProofUseAuthorizer = (transaction: unknown) =>
            new PrismaAuthenticationProofUseAuthorizer(
              transaction as ConstructorParameters<typeof PrismaAuthenticationProofUseAuthorizer>[0],
            );
          const createTransactionalAcceptedRevealAuthorizer = (transaction: unknown) =>
            new PrismaAcceptedPayoutRevealAuthorizer(
              transaction as ConstructorParameters<typeof PrismaAcceptedPayoutRevealAuthorizer>[0],
            );
          const verificationRepository = new PrismaProviderVerificationRepository(
            database.client,
            createPrismaPrivilegedAuditWriter,
            createTransactionalStaffPermissionAuthorizer,
            createTransactionalProviderVerificationEvidenceAuthorizer,
          );
          const payoutRepository = new PrismaProviderPayoutRepository(
            database.client,
            createPrismaPrivilegedAuditWriter,
            createTransactionalStaffPermissionAuthorizer,
            createTransactionalProofUseAuthorizer,
            createTransactionalAcceptedRevealAuthorizer,
            createProviderPayoutHolderAuthorityReader,
            (transaction) => new PrismaPayoutRevealAuditGate(transaction),
          );
          const payoutRegistry = new PrismaPayoutRegistryRepository(database.client);
          const staffPermissions = new PrismaR1P06StaffPermissionAuthorizer(database.client);
          const authorizeR1P06Staff = (
            actorUserId: string,
            permission: "providers.verification.documents.review" | "providers.verification.policies.manage" | "providers.payout-destinations.verify",
          ): Promise<boolean> => staffPermissions.authorize(actorUserId, permission);
          const proofVerifier = new ProviderSensitiveActionProofVerifier(
            new PrismaAuthenticationProofConsumption(environment.AUTH_VERIFIER_SECRET!, database.client),
          );
          const evidence = createProviderVerificationEvidencePort({
            environment,
            scanner: new ClamAvVerificationMalwareScanner(
              scannerUrl.hostname,
              Number(scannerUrl.port),
              10_000,
            ),
            database: database.client,
          });
          const unitOfWork = new PrismaProvidersUnitOfWork(
            createPrismaGeneralTransactionalAuditWriter,
            createPrismaPrivilegedAuditWriter,
            createPrismaProviderIdentityAuthorityWriterFactory,
            (transaction) =>
              adaptProviderIdentityReader(
                createPrismaProviderIdentityReader(transaction),
              ),
            (transaction) =>
              adaptProviderApplicantProfileReader(
                createProviderApplicantProfileReader(transaction),
              ),
            (transaction) =>
              adaptProviderActiveCountryReader(
                createTransactionalActiveCountryReader(transaction),
              ),
            (transaction) =>
              new AuthorizationService(new AuthorizationRepository(transaction)),
            (transaction) => createProviderMediaStatusReader(transaction),
          );
          const providerRepository = new PrismaProviderRepository(database.client);
          const identityReader = adaptProviderIdentityReader(
            createPrismaProviderIdentityReader(database.client),
          );
          const applicantProfiles = adaptProviderApplicantProfileReader(
            createProviderApplicantProfileReader(database.client),
          );
          const denialAudit = createPrismaDenialAuditWriter();
          const r1p06DenialAudit = new ProviderDenialAuditService(denialAudit);
          const mediaReader = createProviderMediaStatusReader(database.client);
          const activeCountries = adaptProviderActiveCountryReader(
            createTransactionalActiveCountryReader(database.client),
          );
          const operationalAvailability =
            new ProviderOperationalAvailabilityService({
              runInReadTransaction: (work) =>
                withProviderAvailabilityReadTransaction(work),
            });
          const projections = new ProviderProjectionService({
            providers: providerRepository,
            identityReader,
            applicantProfiles,
            mediaReader,
            activeCountries,
            denialAudit,
            verificationFacts: {
              async read(provider) {
                const profile = await providerRepository.getProfile(provider.id);
                const policy = provider.kind === "REGISTERED_COMPANY" && profile?.countryId !== null && profile?.countryId !== undefined
                  ? await verificationRepository.readEffectivePolicy({ countryId: profile.countryId, providerKind: "REGISTERED_COMPANY", now: new Date() })
                  : null;
                const effectiveApprovedTypeCodes = await verificationRepository.listEffectiveDocumentTypeCodes(provider.id, new Date());
                const truth = deriveDocumentVerificationTruth({
                  providerKind: provider.kind,
                  applicationStatus: provider.applicationStatus,
                  effectivePolicyPresent: provider.kind === "INDIVIDUAL_TEAM" || policy !== null,
                  requiredTypeCodes: policy?.items.filter((item) => item.isRequired).map((item) => item.documentType.code) ?? [],
                  effectiveApprovedTypeCodes,
                });
                return {
                  documentsVerified: {
                    applicable: truth.applicable,
                    status: truth.status,
                    satisfied: truth.satisfied,
                    blockerCodes: truth.blockerCodes,
                  },
                  payoutDestinationReady: await payoutRepository.isPayoutDestinationReady(provider.id),
                };
              },
            },
            servicesReadyFacts: {
              async read(providerId) {
                const reader = servicesReadyFactsHolder.current;
                if (reader === null) {
                  return null;
                }
                const facts = await reader.getServicesReady(providerId);
                if (facts === null) {
                  return null;
                }
                return {
                  satisfied: facts.servicesReady,
                  blockerCodes: facts.blockerCodes,
                };
              },
            },
            availabilityReadyFacts: {
              async read(providerId) {
                return operationalAvailability.getProviderAvailabilityReadiness(
                  providerId,
                );
              },
            },
          });
          const applications = new ProviderApplicationService({
            unitOfWork,
            providers: providerRepository,
            identityReader,
            applicantProfiles,
            denialAudit,
            mediaReader,
            projections,
          });
          const profiles = new ProviderProfileService({
            unitOfWork,
            providers: providerRepository,
            identityReader,
            activeCountries,
            denialAudit,
            projections,
          });
          const mediaSelection = createMediaStoragePort(environment);
          const media = new ProviderMediaService({
            unitOfWork,
            providers: providerRepository,
            media: createProviderMediaPort(mediaSelection.storage, database.client),
            denialAudit,
            identityReader,
            mediaUsage: new PrismaProviderMediaRepository(
              mediaReader,
              database.client,
            ),
            mediaReader,
            projections,
            signedUrlTtlSeconds: mediaSelection.signedUrlTtlSeconds,
            mediaFolder:
              environment.CLOUDINARY_PROFILE_IMAGE_FOLDER ?? "cleanora-providers",
          });
          const reviewQuery = new ProviderReviewQueryService({
            authorization,
            reviewRepository: new PrismaProviderReviewRepository(database.client),
            providers: providerRepository,
            identityReader,
            applicantProfiles,
            mediaReader,
            projections,
            denialAudit,
          });
          const approval = new ProviderApprovalService({
            unitOfWork,
            providers: providerRepository,
            emailOutbox: new PrismaProviderEmailOutboxRepository(database.client),
            authorization,
            identityReader,
            applicantProfiles,
            denialAudit,
            projections,
          });
          const review = new ProviderReviewService({
            unitOfWork,
            providers: providerRepository,
            authorization,
            identityReader,
            applicantProfiles,
            denialAudit,
            projections,
          });
          const lifecycle = new ProviderLifecycleService({
            unitOfWork,
            providers: providerRepository,
            authorization,
            identityReader,
            applicantProfiles,
            denialAudit,
            projections,
          });
          const providerRuntime = resolveProviderRuntimeConfig(environment);
          const invitationEmailTransport = environment.EMAIL_AUTH_ENABLED
            ? createNodemailerEmailAdapter({
                host: environment.SMTP_HOST!,
                port: environment.SMTP_PORT!,
                secure: environment.SMTP_SECURE!,
                requireTls: environment.SMTP_REQUIRE_TLS!,
                user: environment.SMTP_USER!,
                password: environment.SMTP_PASSWORD!,
                fromName: environment.SMTP_FROM_NAME!,
                fromEmail: environment.SMTP_FROM_EMAIL!,
                connectionTimeoutMilliseconds:
                  environment.SMTP_CONNECTION_TIMEOUT_MS!,
                socketTimeoutMilliseconds: environment.SMTP_SOCKET_TIMEOUT_MS!,
              })
            : new UnavailableEmailAdapter();
          const workforceUnitOfWork = new PrismaProvidersWorkforceUnitOfWork(
            createPrismaWorkerIdentityReaderFactory,
            createPrismaWorkerIdentityAuthorityWriterFactory,
            createPrismaWorkerProofUseAuthorizerFactory,
            createTransactionalWorkerAvatarAuthorizer,
            createPrismaGeneralTransactionalAuditWriter,
          );
          const workerRecentProof = new WorkerSensitiveActionProofVerifier(
            new PrismaAuthenticationProofConsumption(environment.AUTH_VERIFIER_SECRET!, database.client),
          );
          const workerInvitationProof = new HmacWorkerInvitationProofAdapter(
            environment.AUTH_VERIFIER_SECRET!,
          );
          const workerAvatar = createWorkerAvatarPort({
            environment,
            database: database.client,
          });
          const workerIdentityOnboarding = createWorkerInvitationIdentityOnboarding({
            passwordHasher: new Argon2PasswordHasherAdapter(),
            tokens: new JwtTokenServiceAdapter({
              accessSecret: environment.JWT_ACCESS_SECRET!,
              refreshSecret: environment.JWT_REFRESH_SECRET!,
              issuer: environment.JWT_ISSUER,
              audience: environment.JWT_AUDIENCE,
              accessTtlSeconds: environment.JWT_ACCESS_TTL_SECONDS,
            }),
            verifier: new CryptoVerifierAdapter(environment.AUTH_VERIFIER_SECRET!),
            email: new AuthenticationEmailAdapter(invitationEmailTransport),
            accessTtlSeconds: environment.JWT_ACCESS_TTL_SECONDS,
            refreshTtlSeconds: environment.JWT_REFRESH_TTL_SECONDS,
          });
          const workforce = new ProviderWorkforceService({ unitOfWork: workforceUnitOfWork });
          const workforceQueries = new ProviderWorkforceQueryService(workforceUnitOfWork, workerAvatar);
          const workforceMedia = new ProviderWorkforceMediaService({ unitOfWork: workforceUnitOfWork, avatar: workerAvatar });
          const workforceLifecycle = new ProviderWorkforceLifecycleService({ unitOfWork: workforceUnitOfWork, recentProof: workerRecentProof, denialAudit });
          const workforceInvitations = new ProviderWorkforceInvitationService({ unitOfWork: workforceUnitOfWork, recentProof: workerRecentProof, invitationProof: workerInvitationProof, denialAudit });
          const workforceInvitationQueries = new ProviderWorkforceInvitationQueryService({ unitOfWork: workforceUnitOfWork, invitationProof: workerInvitationProof });
          const workforceOnboarding = new ProviderWorkforceOnboardingService({ unitOfWork: workforceUnitOfWork, invitationProof: workerInvitationProof, onboarding: workerIdentityOnboarding });
          const workforceAcceptance = new ProviderWorkforceInvitationAcceptanceService({ unitOfWork: workforceUnitOfWork, invitationProof: workerInvitationProof });
          const workforceAccess = new ProviderWorkforceAccessService({ unitOfWork: workforceUnitOfWork, recentProof: workerRecentProof, invitationProof: workerInvitationProof, denialAudit });
          const workforceAuthority = new ProviderWorkforceAuthorityService({ unitOfWork: workforceUnitOfWork, recentProof: workerRecentProof, denialAudit });
          const teams = new ProviderTeamService({ unitOfWork: workforceUnitOfWork });
          const teamMemberships = new ProviderTeamMembershipService({ unitOfWork: workforceUnitOfWork });
          const teamSupervisors = new ProviderTeamSupervisorService({ unitOfWork: workforceUnitOfWork });
          const teamQueries = new ProviderTeamQueryService(workforceUnitOfWork);
          const workforceReadiness = new ProviderWorkforceReadinessService(workforceUnitOfWork);
          const workerSelf = new ProviderWorkerSelfService({ unitOfWork: workforceUnitOfWork, avatar: workerAvatar });
          const workforceNotificationRepository = new PrismaProviderWorkforceNotificationRepository(
            database.client,
          );
          const workforceNotificationReader = new PrismaProviderWorkforceRepository(database.client);
          const workforceNotificationDispatcher = new ProviderWorkforceNotificationDispatcher(
            workforceNotificationRepository,
            new ProviderWorkforceEmailDeliveryAdapter({
              email: invitationEmailTransport,
              identityReader: createPrismaWorkerIdentityReaderFactory(database.client),
              invitationProof: workerInvitationProof,
              readInvitation: (invitationId) => workforceNotificationReader.getInvitation(invitationId),
              invitationAcceptPath: `${environment.API_PREFIX}/worker-invitations/accept`,
            }),
          );
          const workforceHttpService = {
            createWorkerDraft: workforce.createWorkerDraft.bind(workforce),
            replaceWorkerProfile: workforce.replaceWorkerProfile.bind(workforce),
            listWorkers: workforceQueries.listWorkers.bind(workforceQueries),
            getWorker: workforceQueries.getWorker.bind(workforceQueries),
            listWorkerHistory: workforceQueries.listWorkerHistory.bind(workforceQueries),
            upload: workforceMedia.upload.bind(workforceMedia),
            remove: workforceMedia.remove.bind(workforceMedia),
            transitionWorkerLifecycle: workforceLifecycle.transition.bind(workforceLifecycle),
            issueWorkerInvitation: workforceInvitations.issue.bind(workforceInvitations),
            resendWorkerInvitation: workforceInvitations.resend.bind(workforceInvitations),
            resetWorkerAccess: workforceAccess.reset.bind(workforceAccess),
            revokeWorkerAccess: workforceAccess.revoke.bind(workforceAccess),
            changeWorkerAdminMembership: workforceAuthority.change.bind(workforceAuthority),
            createTeamDraft: teams.createDraft.bind(teams),
            replaceTeamName: teams.replaceName.bind(teams),
            transitionTeamLifecycle: teams.transition.bind(teams),
            changeTeamMembership: teamMemberships.change.bind(teamMemberships),
            changeTeamSupervisor: teamSupervisors.change.bind(teamSupervisors),
            listTeams: teamQueries.list.bind(teamQueries),
            getTeam: teamQueries.get.bind(teamQueries),
            listTeamHistory: teamQueries.history.bind(teamQueries),
            getWorkforceReadiness: workforceReadiness.getForActor.bind(workforceReadiness),
          };
          const invitationEmail = new ProviderInvitationEmailAdapter(
            invitationEmailTransport,
            `${environment.API_PREFIX}/provider-admin-invitations/accept`,
          );
          const providerEmailDispatcher = new ProviderEmailDispatcher({
            outbox: new PrismaProviderEmailOutboxRepository(database.client),
            identityReader,
            emailDelivery: new ProviderEmailDeliveryAdapter(invitationEmailTransport),
            config: {
              batchSize: providerRuntime.emailOutboxBatchSize,
              leaseSeconds: providerRuntime.emailOutboxLeaseSeconds,
            },
          });
          const invitationTokenSecret = environment.AUTH_VERIFIER_SECRET!;
          const membership = new ProviderMembershipService({
            unitOfWork,
            providers: providerRepository,
            identityReader,
            denialAudit,
            invitationEmail,
            invitationTokenSecret,
            invitationTokenBytes: providerRuntime.invitationTokenBytes,
            invitationTtlHours: providerRuntime.invitationTtlHours,
          });
          const invitationOnboardingIdentity =
            createProviderInvitationIdentityOnboarding({
              passwordHasher: new Argon2PasswordHasherAdapter(),
              tokens: new JwtTokenServiceAdapter({
                accessSecret: environment.JWT_ACCESS_SECRET!,
                refreshSecret: environment.JWT_REFRESH_SECRET!,
                issuer: environment.JWT_ISSUER,
                audience: environment.JWT_AUDIENCE,
                accessTtlSeconds: environment.JWT_ACCESS_TTL_SECONDS,
              }),
              verifier: new CryptoVerifierAdapter(
                environment.AUTH_VERIFIER_SECRET!,
              ),
              email: new AuthenticationEmailAdapter(invitationEmailTransport),
              accessTtlSeconds: environment.JWT_ACCESS_TTL_SECONDS,
              refreshTtlSeconds: environment.JWT_REFRESH_TTL_SECONDS,
            });
          const acceptance = new ProviderInvitationAcceptanceService({
            unitOfWork,
            providers: providerRepository,
            identityReader,
            denialAudit,
            invitationTokenSecret,
            invitationOnboarding: invitationOnboardingIdentity,
          });
          const invitationOnboarding = new ProviderInvitationOnboardingService({
            providers: providerRepository,
            acceptance,
            invitationOnboarding: invitationOnboardingIdentity,
          });
          const documentService = new ProviderDocumentService(
            verificationRepository,
            evidence,
            () => new Date(),
            r1p06DenialAudit,
          );
          const documentReviews = new ProviderDocumentReviewService(
            verificationRepository,
            evidence,
            authorizeR1P06Staff,
            () => new Date(),
            r1p06DenialAudit,
          );
          const documentReviewQueries = new ProviderDocumentReviewQueryService(
            verificationRepository,
            evidence,
            authorizeR1P06Staff,
            r1p06DenialAudit,
          );
          const documentPolicies = new ProviderDocumentPolicyService(
            verificationRepository,
            authorizeR1P06Staff,
            () => new Date(),
            r1p06DenialAudit,
          );
          const documentHistory = new ProviderVerificationHistoryService(verificationRepository, r1p06DenialAudit);
          const verificationQueries = new ProviderVerificationQueryService(
            verificationRepository,
            payoutRepository,
            r1p06DenialAudit,
          );
          const payoutConflicts = new ProviderPayoutConflictService(
            payoutRepository,
            authorizeR1P06Staff,
            () => new Date(),
            r1p06DenialAudit,
          );
          const payoutHolderReader = createProviderPayoutHolderAuthorityReader(database.client);
          const payoutDestinations = new ProviderPayoutDestinationService(
            payoutRepository,
            payoutRegistry,
            payoutHolderReader,
            proofVerifier,
            payoutConflicts,
            payoutKeyRings,
            () => new Date(),
            r1p06DenialAudit,
          );
          const payoutPrimary = new ProviderPayoutPrimaryService(
            payoutRepository,
            proofVerifier,
            () => new Date(),
            r1p06DenialAudit,
          );
          const payoutHistory = new ProviderPayoutHistoryService(payoutRepository, r1p06DenialAudit);
          const payoutReviewQueries = new ProviderPayoutReviewQueryService(
            payoutRepository,
            authorizeR1P06Staff,
            r1p06DenialAudit,
          );
          const payoutRevealAudit = new PrismaPayoutRevealAuditGate(database.client);
          const payoutReveal = new ProviderPayoutRevealService(
            payoutRepository,
            proofVerifier,
            payoutRevealAudit,
            authorizeR1P06Staff,
            payoutKeyRings,
          );
          const payoutVerification = new ProviderPayoutVerificationService(
            payoutRepository,
            authorizeR1P06Staff,
            async ({ attemptId, actorUserId, providerId, destinationVersionId, expectedVersion, purpose }) => {
              const accepted = await database.client.auditLog.findFirst({
                where: {
                  id: attemptId,
                  actorId: actorUserId,
                  action: "PROVIDER_PAYOUT_REVEAL_ACCEPTED",
                  targetType: "PROVIDER_PAYOUT_DESTINATION_VERSION",
                  targetId: destinationVersionId,
                  AND: [
                    { context: { path: ["providerId"], equals: providerId } },
                    { context: { path: ["expectedVersion"], equals: expectedVersion } },
                    { context: { path: ["purpose"], equals: purpose } },
                    { context: { path: ["outcome"], equals: "ACCEPTED" } },
                  ],
                },
                select: { id: true },
              });
              return accepted !== null;
            },
            payoutHolderReader,
            payoutKeyRings,
            () => new Date(),
            r1p06DenialAudit,
          );
          const documentExpiry = new ProviderDocumentExpirySweep(verificationRepository);
          let policyActivationCursor: string | null = null;
          const policyActivation = new ProviderPolicyActivationSweep(async ({ cursor, limit }) =>
            verificationRepository.activateEffectivePolicyBatch({ cursor, limit, now: new Date() }),
          );
          return {
            r1p06ReadinessProbe: {
              name: "r1-p06-sensitive-data-configuration",
              check: async (): Promise<void> => {
                assertR1P06RuntimeEnvironment(environment);
                const [identifierKeyRows, holderKeyRows, lookupRows] = await Promise.all([
                  database.client.providerPayoutDestinationVersion.findMany({
                    distinct: ["identifierEncryptionKeyId"],
                    select: { identifierEncryptionKeyId: true },
                  }),
                  database.client.providerPayoutDestinationVersion.findMany({
                    distinct: ["holderNameEncryptionKeyId"],
                    select: { holderNameEncryptionKeyId: true },
                  }),
                  database.client.providerPayoutLookupFingerprint.findMany({
                    distinct: ["lookupKeyId"], select: { lookupKeyId: true },
                  }),
                ]);
                assertReferencedPayoutKeysAvailable({
                  rings: payoutKeyRings,
                  encryptionKeyIds: [...new Set([
                    ...identifierKeyRows.map((row) => row.identifierEncryptionKeyId),
                    ...holderKeyRows.map((row) => row.holderNameEncryptionKeyId),
                  ])],
                  lookupKeyIds: lookupRows.map((row) => row.lookupKeyId),
                });
              },
            },
            providerOperationalAvailabilityReader:
              createProviderOperationalAvailabilityReader(
                operationalAvailability,
              ),
            startProviderBackgroundTasks: (): (() => void) => {
              const stopEmail = startProviderEmailDispatcher(providerEmailDispatcher, logger);
              const stopWorkforceEmail = startProviderWorkforceNotificationDispatcher(
                workforceNotificationDispatcher,
                logger,
              );
              const expiryTimer = setInterval(() => {
                void documentExpiry.runBatch().catch((error: unknown) => {
                  logger.error("Provider document expiry sweep failed", {
                    errorName: error instanceof Error ? error.name : "UnknownError",
                  });
                });
              }, 60_000);
              const policyActivationTimer = setInterval(() => {
                void policyActivation.runBatch(policyActivationCursor).then((result) => {
                  policyActivationCursor = result.nextCursor;
                }).catch((error: unknown) => {
                  logger.error("Provider policy activation sweep failed", {
                    errorName: error instanceof Error ? error.name : "UnknownError",
                  });
                });
              }, 60_000);
              expiryTimer.unref();
              policyActivationTimer.unref();
              return (): void => {
                clearInterval(expiryTimer);
                clearInterval(policyActivationTimer);
                stopWorkforceEmail();
                stopEmail();
              };
            },
            providersRouter: createProvidersRouter({
              authenticateAccess: authentication.authenticateAccess,
              applications,
              profiles,
              media,
              projections,
              membership,
              verification: {
                documents: documentService,
                history: documentHistory,
                queries: verificationQueries,
              },
              payout: {
                destinations: payoutDestinations,
                primary: payoutPrimary,
                history: payoutHistory,
              },
            }),
            providerWorkforceRouter: createProviderWorkforceRouter({
              authenticateAccess: authentication.authenticateAccess,
              service: workforceHttpService,
            }),
            providerWorkerSelfRouter: createProviderWorkerSelfRouter({
              authenticateAccess: authentication.authenticateAccess,
              service: workerSelf,
            }),
            providerWorkforceInvitationRouter: createProviderWorkforceInvitationRouter({
              authenticateAccess: authentication.authenticateAccess,
              service: {
                query: workforceInvitationQueries,
                onboarding: workforceOnboarding,
                acceptance: workforceAcceptance,
              },
            }),
            staffProvidersRouter: createStaffProvidersRouter({
              authenticateAccess: authentication.authenticateAccess,
              reviewQuery,
              approval,
              review,
              lifecycle,
              verification: {
                reviews: documentReviews,
                reviewQueries: documentReviewQueries,
                policies: documentPolicies,
              },
              payout: {
                reviewQueries: payoutReviewQueries,
                reveal: payoutReveal,
                verification: payoutVerification,
                conflicts: payoutConflicts,
              },
            }),
            providerAdminInvitationRouter: createProviderAdminInvitationRouter({
              authenticateAccess: authentication.authenticateAccess,
              rateLimiter,
              privacyHashSecret: environment.AUTH_PRIVACY_HASH_SECRET!,
              acceptance,
              onboarding: invitationOnboarding,
            }),
          };
        })();
  const startCustomersBackgroundTasks =
    startCustomerMaintenanceTasks === undefined && providersComposition === undefined
      ? undefined
      : (): (() => void) => {
          const stopCustomer = startCustomerMaintenanceTasks?.();
          const stopProvider = providersComposition?.startProviderBackgroundTasks();
          return (): void => {
            stopProvider?.();
            stopCustomer?.();
          };
        };
  const providersRouter = providersComposition?.providersRouter;
  const staffProvidersRouter = providersComposition?.staffProvidersRouter;
  const providerAdminInvitationRouter =
    providersComposition?.providerAdminInvitationRouter;
  const providerWorkforceRouter = providersComposition?.providerWorkforceRouter;
  const providerWorkerSelfRouter = providersComposition?.providerWorkerSelfRouter;
  const providerWorkforceInvitationRouter = providersComposition?.providerWorkforceInvitationRouter;
  const providerOperationalAvailabilityReader =
    providersComposition?.providerOperationalAvailabilityReader;

  // Shared Catalog service for public definition reads and Providers UoW binding.
  const catalogRepository = new PrismaCatalogRepository(
    database.client,
    createTransactionalActiveCountryReader,
    createPrismaPrivilegedAuditWriter,
    createTransactionalCatalogServiceImageAuthorizer,
    createTransactionalCatalogServiceMediaFactsReader,
  );
  const catalogService = new CatalogService({
    authorization,
    logger,
    repository: catalogRepository,
  });
  const catalogDefinitionReader = createCatalogDefinitionReader(catalogService);

  let providerServicesReadyFactsReader:
    | ProviderServicesReadyFactsReader
    | undefined;
  let providerServiceSnapshotReader: ProviderServiceSnapshotReader | undefined;

  let staffProviderServiceRouter: ReturnType<
    typeof createStaffProviderServiceRouter
  > | undefined;

  const providerServiceRouter =
    authentication === undefined
      ? undefined
      : (() => {
          const createCatalogReader =
            createTransactionalCatalogDefinitionReaderFactory((transaction) =>
              catalogService.forTransaction(transaction),
            );
          const outerStaffAuthorizer = new PrismaProviderServiceStaffAuthorizer(
            database.client as ConstructorParameters<
              typeof PrismaProviderServiceStaffAuthorizer
            >[0],
          );
          const providerServiceUnitOfWork = new PrismaProviderServiceUnitOfWork(
            createCatalogReader,
            (transaction) =>
              createTransactionalProviderServicePricingPolicyReader(transaction),
            (transaction) =>
              new PrismaProviderServiceStaffAuthorizer(
                transaction as ConstructorParameters<
                  typeof PrismaProviderServiceStaffAuthorizer
                >[0],
              ),
            createPrismaGeneralTransactionalAuditWriter,
            database.client,
          );
          const providerServiceIdentityReader =
            createPrismaProviderIdentityReader(database.client);
          const providerServiceCommands = new ProviderServiceService({
            unitOfWork: providerServiceUnitOfWork,
            identityReader: providerServiceIdentityReader,
            staffAuthorizer: outerStaffAuthorizer,
          });
          const providerServiceQueries = new ProviderServiceQueryService({
            unitOfWork: providerServiceUnitOfWork,
            identityReader: providerServiceIdentityReader,
            staffAuthorizer: outerStaffAuthorizer,
          });
          providerServicesReadyFactsReader =
            createProviderServicesReadyFactsReader(providerServiceQueries);
          servicesReadyFactsHolder.current = providerServicesReadyFactsReader;
          providerServiceSnapshotReader = createProviderServiceSnapshotReader(
            new ProviderServiceSnapshotService({
              unitOfWork: providerServiceUnitOfWork,
            }),
          );
          staffProviderServiceRouter = createStaffProviderServiceRouter({
            authenticateAccess: authentication.authenticateAccess,
            service: {
              decidePriceProposal:
                providerServiceCommands.decidePriceProposal.bind(
                  providerServiceCommands,
                ),
              listStaffPendingPriceProposals:
                providerServiceQueries.listStaffPendingPriceProposals.bind(
                  providerServiceQueries,
                ),
              getStaffPendingPriceDossier:
                providerServiceQueries.getStaffPendingPriceDossier.bind(
                  providerServiceQueries,
                ),
            },
          });
          return createProviderServiceRouter({
            authenticateAccess: authentication.authenticateAccess,
            service: {
              createOffering:
                providerServiceCommands.createOffering.bind(
                  providerServiceCommands,
                ),
              replaceConfiguration:
                providerServiceCommands.replaceConfiguration.bind(
                  providerServiceCommands,
                ),
              proposePrice:
                providerServiceCommands.proposePrice.bind(
                  providerServiceCommands,
                ),
              applyLifecycle:
                providerServiceCommands.applyLifecycle.bind(
                  providerServiceCommands,
                ),
              list: providerServiceQueries.list.bind(providerServiceQueries),
              get: providerServiceQueries.get.bind(providerServiceQueries),
              listPriceHistory:
                providerServiceQueries.listPriceHistory.bind(
                  providerServiceQueries,
                ),
              listStatusHistory:
                providerServiceQueries.listStatusHistory.bind(
                  providerServiceQueries,
                ),
            },
          });
        })();

  const staffCatalogRouter =
    authentication === undefined
      ? undefined
      : createCatalogRouter({
          authenticateAccess: authentication.authenticateAccess,
          catalogService: new CatalogService({
            authorization,
            logger,
            catalogServiceImage: createCatalogServiceImagePort({
              environment,
              database: database.client,
            }),
            repository: catalogRepository,
          }),
        });

  // R1-P10 Batch A: Staff Configuration locality/time-zone management.
  const staffConfigurationLocalityRouter =
    authentication === undefined
      ? undefined
      : createLocalityRouter({
          authenticateAccess: authentication.authenticateAccess,
          localityService: new LocalityService({
            authorization,
            repository: createPrismaLocalityRepository(),
            runInTransaction: (work) =>
              withLocalityTransaction((tx, repository) =>
                work(repository, createPrismaGeneralTransactionalAuditWriter(tx)),
              ),
          }),
        });

  // R1-P10 Provider availability management.
  const providerAvailabilityRouter =
    authentication === undefined
      ? undefined
      : createProviderAvailabilityRouter({
          authenticateAccess: authentication.authenticateAccess,
          service: new ProviderAvailabilityService({
            // Repair item 2: no outer, full-client authority/locality
            // reader — every read/write unit of work supplies its own
            // transaction-bound repository and `LocalityReader` (see
            // `withProviderAvailabilityWriteTransaction`/`...ReadTransaction`).
            runInWriteTransaction: (work) =>
              withProviderAvailabilityWriteTransaction(work),
            runInReadTransaction: (work) =>
              withProviderAvailabilityReadTransaction(work),
          }),
          workerAvailabilityService: new ProviderWorkerAvailabilityService({
            runInWriteTransaction: (work) =>
              withProviderAvailabilityWriteTransaction(work),
            runInReadTransaction: (work) =>
              withProviderAvailabilityReadTransaction(work),
          }),
          capacityService: new ProviderCapacityService({
            runInWriteTransaction: (work) =>
              withProviderAvailabilityWriteTransaction(work),
            runInReadTransaction: (work) =>
              withProviderAvailabilityReadTransaction(work),
          }),
        });

  // R1-P11 Eligibility Engine — in-process only (zero new HTTP).
  const eligibilityUnitOfWork = new EligibilityUnitOfWork(database.client);
  const createEligibilityCatalogReader =
    createTransactionalCatalogDefinitionReaderFactory((transaction) =>
      catalogService.forTransaction(transaction),
    );
  const createEligibilityPricingReader =
    createTransactionalEligibilityPricingReaderFactory((transaction) =>
      createBoundEligibilityPricingReader(
        transaction,
        catalogService.forTransaction(transaction),
      ),
    );
  const createEligibilityLifecycleReader =
    createTransactionalEligibilityProviderLifecycleReaderFactory((transaction) =>
      createBoundEligibilityProviderLifecycleReader(transaction),
    );
  const createEligibilityAvailabilityReader =
    createTransactionalEligibilityAvailabilityReaderFactory((transaction) =>
      createBoundEligibilityAvailabilityReader(transaction),
    );
  const eligibilityApplicationService = createEligibilityApplicationService({
    unitOfWork: eligibilityUnitOfWork,
    clock: () => new Date(),
    createCatalogReader: createEligibilityCatalogReader,
    createActiveCountryReader: createTransactionalActiveCountryReader,
    createLocalityReader: createTransactionalLocalityReader,
    createCountryTimeZoneReader: createTransactionalCountryTimeZoneReader,
    createPricingReader: createEligibilityPricingReader,
    createLifecycleReader: createEligibilityLifecycleReader,
    createAvailabilityReader: createEligibilityAvailabilityReader,
  });

  return {
    database,
    logger,
    authorization,
    roleManagement,
    ownerStaffAdminProvision,
    privacyProcessor,
    privacyPrivileged,
    startCustomersBackgroundTasks,
    catalogDefinitionReader,
    providerServicesReadyFactsReader,
    providerServiceSnapshotReader,
    providerOperationalAvailabilityReader,
    eligibilityApplicationService,
    routes: {
      environment,
      logger,
      rateLimiter,
      databaseProbe: database.databaseProbe(),
      readinessProbes: [
        database.readinessProbe(),
        ...(providersComposition?.r1p06ReadinessProbe === undefined ? [] : [providersComposition.r1p06ReadinessProbe]),
        ...(customersRouter === undefined
          ? []
          : [{
              name: "customers-runtime-configuration",
              check: async (): Promise<void> => {
                assertCustomersRuntimeEnvironment(environment);
              },
            }]),
      ],
      ownerInternalRouter,
      ...(authentication === undefined ? {} : { authenticationRouter: authentication.router }),
      ...(customersRouter === undefined ? {} : { customersRouter }),
      ...(providersRouter === undefined ? {} : { providersRouter }),
      ...(providerWorkforceRouter === undefined ? {} : { providerWorkforceRouter }),
      ...(providerServiceRouter === undefined ? {} : { providerServiceRouter }),
      ...(staffProviderServiceRouter === undefined
        ? {}
        : { staffProviderServiceRouter }),
      ...(providerWorkerSelfRouter === undefined ? {} : { providerWorkerSelfRouter }),
      ...(providerWorkforceInvitationRouter === undefined
        ? {}
        : { providerWorkforceInvitationRouter }),
      ...(staffProvidersRouter === undefined ? {} : { staffProvidersRouter }),
      ...(providerAdminInvitationRouter === undefined
        ? {}
        : { providerAdminInvitationRouter }),
      ...(staffCatalogRouter === undefined
        ? {}
        : { staffCatalogRouter }),
      ...(staffConfigurationLocalityRouter === undefined
        ? {}
        : { staffConfigurationLocalityRouter }),
      ...(providerAvailabilityRouter === undefined
        ? {}
        : { providerAvailabilityRouter }),
    },
  };
}
