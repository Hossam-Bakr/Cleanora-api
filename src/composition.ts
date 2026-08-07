import type { Router } from "express";

import { APPLICATION_NAME } from "#config/constants";
import type { AppEnvironment } from "#config/env";
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

function createAuthenticationRouter(
  environment: AppEnvironment,
  rateLimiter: RateLimiterPort,
  roleManagement: RoleManagementService,
): Router | undefined {
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

  return authentication.router;
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
  const authenticationRouter = createAuthenticationRouter(
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

  return {
    database,
    logger,
    authorization,
    roleManagement,
    ownerStaffAdminProvision,
    routes: {
      environment,
      logger,
      rateLimiter,
      databaseProbe: database.databaseProbe(),
      readinessProbes: [database.readinessProbe()],
      ownerInternalRouter,
      ...(authenticationRouter === undefined ? {} : { authenticationRouter }),
    },
  };
}
