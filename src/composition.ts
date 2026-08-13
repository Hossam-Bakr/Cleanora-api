import { APPLICATION_NAME } from "#config/constants";
import {
  assertCustomersRuntimeEnvironment,
  resolveProviderRuntimeConfig,
  type AppEnvironment,
} from "#config/env";
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
  createAuthenticationModule,
  createAuthenticationPolicy,
} from "#modules/authentication/auth.module";
import { AuthorizationService } from "#modules/authentication/authorization.service";
import { AuthorizationRepository } from "#modules/authentication/infrastructure/authorization.repository";
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
} from "#modules/media/infrastructure/media-provider.factory";
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
} from "#modules/configuration/configuration.public";
import {
  createPrismaProviderIdentityAuthorityWriterFactory,
  createPrismaProviderIdentityReader,
  createProviderInvitationIdentityOnboarding,
} from "#modules/authentication/authentication.factories";
import { createProviderApplicantProfileReader } from "#modules/customers/customers.public";
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
          const mediaReader = createProviderMediaStatusReader(database.client);
          const activeCountries = adaptProviderActiveCountryReader(
            createTransactionalActiveCountryReader(database.client),
          );
          const projections = new ProviderProjectionService({
            providers: providerRepository,
            identityReader,
            applicantProfiles,
            mediaReader,
            activeCountries,
            denialAudit,
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
          return {
            startProviderBackgroundTasks: (): (() => void) =>
              startProviderEmailDispatcher(providerEmailDispatcher, logger),
            providersRouter: createProvidersRouter({
              authenticateAccess: authentication.authenticateAccess,
              applications,
              profiles,
              media,
              projections,
              membership,
            }),
            staffProvidersRouter: createStaffProvidersRouter({
              authenticateAccess: authentication.authenticateAccess,
              reviewQuery,
              approval,
              review,
              lifecycle,
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

  return {
    database,
    logger,
    authorization,
    roleManagement,
    ownerStaffAdminProvision,
    privacyProcessor,
    privacyPrivileged,
    startCustomersBackgroundTasks,
    routes: {
      environment,
      logger,
      rateLimiter,
      databaseProbe: database.databaseProbe(),
      readinessProbes: [
        database.readinessProbe(),
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
      ...(staffProvidersRouter === undefined ? {} : { staffProvidersRouter }),
      ...(providerAdminInvitationRouter === undefined
        ? {}
        : { providerAdminInvitationRouter }),
    },
  };
}
