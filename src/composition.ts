import { APPLICATION_NAME } from "#config/constants";
import {
  assertCustomersRuntimeEnvironment,
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
import { createMediaPendingUploadPort, createMediaStoragePort } from "#modules/media/infrastructure/media-provider.factory";
import { SharpProfileImageProcessor } from "#modules/media/infrastructure/sharp-profile-image.processor";
import { PrismaMediaRepository } from "#modules/media/infrastructure/prisma-media.repository";
import {
  MediaCleanupService,
  startMediaCleanupSweep,
} from "#modules/media/infrastructure/media-cleanup.service";
import { getActiveCountryIdByCode } from "#modules/configuration/configuration.service";
import type { RouteDependencies } from "#routes/index";
import {
  createApplicationLogger,
  type Logger,
} from "#shared/logger";

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
  const startCustomersBackgroundTasks =
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
    },
  };
}
