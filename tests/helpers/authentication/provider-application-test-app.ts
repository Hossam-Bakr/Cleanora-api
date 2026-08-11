import type { Express } from "express";

import { createTestApp } from "../create-test-app.js";
import { createAuthenticationModule } from "../../../src/modules/authentication/auth.module.js";
import { Argon2PasswordHasherAdapter } from "../../../src/integrations/authentication/argon2-password-hasher.adapter.js";
import { CryptoVerifierAdapter } from "../../../src/integrations/authentication/crypto-verifier.adapter.js";
import { JwtTokenServiceAdapter } from "../../../src/integrations/authentication/jwt-token-service.adapter.js";
import { MemoryGoogleTransactionStoreAdapter } from "../../../src/integrations/authentication/memory-google-transaction-store.adapter.js";
import { createTestEnvironment } from "../test-environment.js";
import { TestLogger } from "../test-logger.js";
import {
  startTestDatabaseLifecycle,
  stopTestDatabaseLifecycle,
} from "../test-database-lifecycle.js";
import { requireApprovedTestDatabaseUrl } from "../resolve-test-database-url.js";
import { DeterministicAuthenticationInbox } from "./deterministic-delivery.js";
import { DeterministicGoogleAdapter } from "./deterministic-google.adapter.js";
import { createPrismaCustomerSignupProfileWriter } from "../../../src/modules/customers/infrastructure/prisma-customer-signup-profile.writer.js";
import { createPrismaProviderIdentityReader } from "../../../src/modules/authentication/authentication.factories.js";
import { createPrismaProviderIdentityAuthorityWriterFactory } from "../../../src/modules/authentication/authentication.factories.js";
import { createProviderApplicantProfileReader } from "../../../src/modules/customers/customers.public.js";
import { createPrismaDenialAuditWriter } from "../../../src/modules/admin/infrastructure/prisma-denial-audit.writer.js";
import { createPrismaGeneralTransactionalAuditWriter } from "../../../src/modules/admin/infrastructure/prisma-general-transactional-audit.writer.js";
import { createPrismaPrivilegedAuditWriter } from "../../../src/modules/admin/infrastructure/prisma-privileged-audit.writer.js";
import { AuthorizationService } from "../../../src/modules/authentication/authorization.service.js";
import { AuthorizationRepository } from "../../../src/modules/authentication/infrastructure/authorization.repository.js";
import { PrismaProvidersUnitOfWork } from "../../../src/modules/providers/infrastructure/prisma-providers.unit-of-work.js";
import { PrismaProviderRepository } from "../../../src/modules/providers/infrastructure/prisma-provider.repository.js";
import { PrismaProviderEmailOutboxRepository } from "../../../src/modules/providers/infrastructure/prisma-provider-email-outbox.repository.js";
import { PrismaProviderReviewRepository } from "../../../src/modules/providers/infrastructure/prisma-provider-review.repository.js";
import { PrismaProviderMediaRepository } from "../../../src/modules/providers/infrastructure/prisma-provider-media.repository.js";
import { getPrismaClient } from "../../../src/database/prisma.js";
import { ProviderApplicationService } from "../../../src/modules/providers/provider-application.service.js";
import { ProviderApprovalService } from "../../../src/modules/providers/provider-approval.service.js";
import { ProviderInvitationAcceptanceService } from "../../../src/modules/providers/provider-invitation-acceptance.service.js";
import { ProviderInvitationOnboardingService } from "../../../src/modules/providers/provider-invitation-onboarding.service.js";
import { ProviderMediaService } from "../../../src/modules/providers/provider-media.service.js";
import { ProviderMembershipService } from "../../../src/modules/providers/provider-membership.service.js";
import { ProviderProfileService } from "../../../src/modules/providers/provider-profile.service.js";
import { ProviderProjectionService } from "../../../src/modules/providers/provider-projection.service.js";
import { ProviderReviewQueryService } from "../../../src/modules/providers/provider-review-query.service.js";
import { ProviderReviewService } from "../../../src/modules/providers/provider-review.service.js";
import { ProviderLifecycleService } from "../../../src/modules/providers/provider-lifecycle.service.js";
import {
  createProviderAdminInvitationRouter,
  createProvidersRouter,
  createStaffProvidersRouter,
} from "../../../src/modules/providers/providers.routes.js";
import type { ProviderIdentityReaderPort } from "../../../src/modules/providers/domain/providers.ports.js";
import type { ProviderApplicantProfileReaderPort } from "../../../src/modules/providers/domain/providers.ports.js";
import type { ActiveCountryReaderPort } from "../../../src/modules/providers/domain/providers.ports.js";
import type { ProviderKind } from "../../../src/modules/providers/domain/providers.types.js";
import { uniqueIdentity } from "./test-authentication-app.js";
import { createActiveCountryReader } from "../../../src/modules/configuration/configuration.public.js";
import { AppError } from "../../../src/shared/errors/app-error.js";
import { FakeProviderMediaAdapter } from "../fake-provider-media.js";
import { FakeProviderEmailAdapter } from "../fake-provider-email.js";
import { resolveProviderRuntimeConfig } from "../../../src/config/env.js";
import { createProviderInvitationIdentityOnboarding } from "../../../src/modules/authentication/authentication.factories.js";

const request = require("supertest") as typeof import("supertest");

function adaptIdentityReader(
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

function adaptApplicantProfileReader(
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

export async function startProviderApplicationTestApp(options?: {
  readonly preferDirectMigrationUrl?: boolean;
}) {
  const database = await startTestDatabaseLifecycle({
    ...(options?.preferDirectMigrationUrl === true
      ? { preferDirectMigrationUrl: true }
      : {}),
  });
  const email = new DeterministicAuthenticationInbox();
  const google = new DeterministicGoogleAdapter();
  const { url: testDatabaseUrl } = requireApprovedTestDatabaseUrl();
  const environment = createTestEnvironment({
    AUTH_ENABLED: true,
    EMAIL_AUTH_ENABLED: true,
    SMS_AUTH_ENABLED: false,
    GOOGLE_AUTH_ENABLED: true,
    DATABASE_URL: testDatabaseUrl,
  });
  const rateLimiter = {
    consume: async () => ({ allowed: true, remaining: 1_000 }),
  };
  const authentication = createAuthenticationModule({
    trustedOrigins: environment.CORS_ORIGINS,
    cookie: {
      name: environment.AUTH_REFRESH_COOKIE_NAME,
      path: environment.AUTH_REFRESH_COOKIE_PATH,
      secure: false,
      sameSite: "lax",
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
    email,
    customerSignupProfiles: createPrismaCustomerSignupProfileWriter,
    accessTtlSeconds: environment.JWT_ACCESS_TTL_SECONDS,
    refreshTtlSeconds: environment.JWT_REFRESH_TTL_SECONDS,
    rateLimiter,
    googleIdentity: google,
    googleTransactions: new MemoryGoogleTransactionStoreAdapter(),
    googleProviderCallbackUri: environment.GOOGLE_REDIRECT_URI!,
    googleFrontendCallbackUri: environment.GOOGLE_FRONTEND_CALLBACK_URI!,
  });

  const unitOfWork = new PrismaProvidersUnitOfWork(
    createPrismaGeneralTransactionalAuditWriter,
    createPrismaPrivilegedAuditWriter,
    createPrismaProviderIdentityAuthorityWriterFactory,
    (transaction) =>
      adaptIdentityReader(createPrismaProviderIdentityReader(transaction)),
    (transaction) =>
      adaptApplicantProfileReader(
        createProviderApplicantProfileReader(transaction),
      ),
    (transaction) => ({
      async resolveActiveCountry(countryCode: string) {
        return transaction.country.findFirst({
          where: { code: countryCode, isActive: true },
          select: { id: true, code: true },
        });
      },
      async getById(countryId: string) {
        return transaction.country.findFirst({
          where: { id: countryId, isActive: true },
          select: { id: true, code: true },
        });
      },
    }),
    (transaction) =>
      new AuthorizationService(new AuthorizationRepository(transaction)),
    (transaction) => ({
      async getMediaStatus(mediaId) {
        const row = await transaction.mediaFile.findUnique({
          where: { id: mediaId },
        });
        return row === null
          ? null
          : {
              mediaId: row.id,
              status: row.status,
              contentType: row.contentType,
              byteSize: row.byteSize,
              width: row.width,
              height: row.height,
              hasReadyThumbnail:
                row.ownerType === "PROVIDER_GALLERY_VIDEO" &&
                row.status === "READY",
            };
      },
    }),
  );
  const providerRepository = new PrismaProviderRepository(getPrismaClient());
  const identityReader = adaptIdentityReader(
    createPrismaProviderIdentityReader(),
  );
  const applicantProfiles = adaptApplicantProfileReader(
    createProviderApplicantProfileReader(),
  );
  const denialAudit = createPrismaDenialAuditWriter();
  const activeCountries: ActiveCountryReaderPort = (() => {
    const reader = createActiveCountryReader();
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
  })();
  const mediaReader = {
    async getMediaStatus(mediaId: string) {
      const row = await getPrismaClient().mediaFile.findUnique({
        where: { id: mediaId },
        select: {
          id: true,
          status: true,
          contentType: true,
          byteSize: true,
          width: true,
          height: true,
        },
      });
      if (row === null) {
        return null;
      }
      return {
        mediaId: row.id,
        status: row.status,
        contentType: row.contentType,
        byteSize: row.byteSize,
        width: row.width,
        height: row.height,
        hasReadyThumbnail: row.status === "READY",
      };
    },
  };
  const projectionService = new ProviderProjectionService({
    providers: providerRepository,
    identityReader,
    applicantProfiles,
    mediaReader,
    activeCountries,
    denialAudit,
  });
  const applicationService = new ProviderApplicationService({
    unitOfWork,
    providers: providerRepository,
    identityReader,
    applicantProfiles,
    denialAudit,
    mediaReader,
    projections: projectionService,
  });

  const profileService = new ProviderProfileService({
    unitOfWork,
    providers: providerRepository,
    identityReader,
    activeCountries,
    denialAudit,
    projections: projectionService,
  });

  const mediaFake = new FakeProviderMediaAdapter();
  const mediaService = new ProviderMediaService({
    unitOfWork,
    providers: providerRepository,
    media: mediaFake,
    denialAudit,
    identityReader,
    mediaUsage: new PrismaProviderMediaRepository(mediaReader),
    mediaReader,
    projections: projectionService,
    signedUrlTtlSeconds: 300,
    mediaFolder: "test-providers",
  });

  const authorization = new AuthorizationService(new AuthorizationRepository());
  const reviewQuery = new ProviderReviewQueryService({
    authorization,
    reviewRepository: new PrismaProviderReviewRepository(),
    providers: providerRepository,
    identityReader,
    applicantProfiles,
    mediaReader,
    projections: projectionService,
    denialAudit,
  });
  const approvalService = new ProviderApprovalService({
    unitOfWork,
    providers: providerRepository,
    emailOutbox: new PrismaProviderEmailOutboxRepository(getPrismaClient()),
    authorization,
    identityReader,
    applicantProfiles,
    denialAudit,
    projections: projectionService,
  });
  const reviewService = new ProviderReviewService({
    unitOfWork,
    providers: providerRepository,
    authorization,
    identityReader,
    applicantProfiles,
    denialAudit,
    projections: projectionService,
  });
  const lifecycleService = new ProviderLifecycleService({
    unitOfWork,
    providers: providerRepository,
    authorization,
    identityReader,
    applicantProfiles,
    denialAudit,
    projections: projectionService,
  });

  const invitationEmailFake = new FakeProviderEmailAdapter();
  const providerRuntime = resolveProviderRuntimeConfig(environment);
  const invitationTokenSecret = environment.AUTH_VERIFIER_SECRET!;
  const membershipService = new ProviderMembershipService({
    unitOfWork,
    providers: providerRepository,
    identityReader,
    denialAudit,
    invitationEmail: invitationEmailFake,
    invitationTokenSecret,
    invitationTokenBytes: providerRuntime.invitationTokenBytes,
    invitationTtlHours: providerRuntime.invitationTtlHours,
  });
  const invitationOnboardingIdentity = createProviderInvitationIdentityOnboarding({
    passwordHasher: new Argon2PasswordHasherAdapter(),
    tokens: new JwtTokenServiceAdapter({
      accessSecret: environment.JWT_ACCESS_SECRET!,
      refreshSecret: environment.JWT_REFRESH_SECRET!,
      issuer: environment.JWT_ISSUER,
      audience: environment.JWT_AUDIENCE,
      accessTtlSeconds: environment.JWT_ACCESS_TTL_SECONDS,
    }),
    verifier: new CryptoVerifierAdapter(environment.AUTH_VERIFIER_SECRET!),
    email,
    accessTtlSeconds: environment.JWT_ACCESS_TTL_SECONDS,
    refreshTtlSeconds: environment.JWT_REFRESH_TTL_SECONDS,
  });
  const acceptanceService = new ProviderInvitationAcceptanceService({
    unitOfWork,
    providers: providerRepository,
    identityReader,
    denialAudit,
    invitationTokenSecret,
    invitationOnboarding: invitationOnboardingIdentity,
  });
  const invitationOnboardingService = new ProviderInvitationOnboardingService({
    providers: providerRepository,
    acceptance: acceptanceService,
    invitationOnboarding: invitationOnboardingIdentity,
  });

  const providersRouter = createProvidersRouter({
    authenticateAccess: authentication.authenticateAccess,
    applications: applicationService,
    profiles: profileService,
    media: mediaService,
    projections: projectionService,
    membership: membershipService,
  });
  const staffProvidersRouter = createStaffProvidersRouter({
    authenticateAccess: authentication.authenticateAccess,
    reviewQuery,
    approval: approvalService,
    review: reviewService,
    lifecycle: lifecycleService,
  });
  const providerAdminInvitationRouter = createProviderAdminInvitationRouter({
    authenticateAccess: authentication.authenticateAccess,
    rateLimiter,
    privacyHashSecret: environment.AUTH_PRIVACY_HASH_SECRET!,
    acceptance: acceptanceService,
    onboarding: invitationOnboardingService,
  });

  const logger = new TestLogger();
  const app = createTestApp({
    environment,
    logger,
    rateLimiter,
    authenticationRouter: authentication.router,
    providersRouter,
    staffProvidersRouter,
    providerAdminInvitationRouter,
  });

  return {
    app,
    database,
    prisma: database.client,
    email,
    mediaFake,
    invitationEmail: invitationEmailFake,
    logger,
    stop: () => stopTestDatabaseLifecycle(database),
  };
}

export async function signupAndLogin(
  app: Express,
  options: {
    readonly accountCategory: "INDIVIDUAL" | "COMPANY" | "ENGINEER";
    readonly label?: string;
    readonly emailInbox: DeterministicAuthenticationInbox;
    readonly profile?: Record<string, string>;
  },
): Promise<{
  readonly accessToken: string;
  readonly userId: string;
  readonly identity: ReturnType<typeof uniqueIdentity>;
}> {
  const identity = uniqueIdentity(options.label ?? options.accountCategory);
  const profile =
    options.profile ??
    (options.accountCategory === "COMPANY"
      ? {
          companyName: "Cleanora Co",
          representativeFullName: "Company Rep",
        }
      : options.accountCategory === "ENGINEER"
        ? {
            fullName: "Design Engineer",
            professionalTitle: "Civil",
          }
        : { fullName: "Individual Applicant" });

  const signup = await request(app)
    .post("/api/v1/auth/signup")
    .send({
      accountCategory: options.accountCategory,
      ...profile,
      phone: identity.phone,
      email: identity.email,
      password: identity.password,
    })
    .expect(202);

  const delivery = options.emailInbox.latest(identity.email);
  await request(app)
    .post("/api/v1/auth/otp/verify")
    .send({ challengeId: signup.body.data.challengeId, code: delivery!.value })
    .expect(200);

  const login = await request(app)
    .post("/api/v1/auth/login")
    .send({ phone: identity.phone, password: identity.password })
    .expect(200);

  return {
    accessToken: login.body.data.accessToken as string,
    userId: login.body.data.user.id as string,
    identity,
  };
}

export async function enrollCompanyCategory(
  app: Express,
  input: {
    readonly accessToken: string;
    readonly emailNormalized: string;
    readonly emailInbox: DeterministicAuthenticationInbox;
  },
): Promise<void> {
  const enrollment = await request(app)
    .post("/api/v1/auth/account-categories")
    .set("Authorization", `Bearer ${input.accessToken}`)
    .send({
      accountCategory: "COMPANY",
      companyName: "Dual Company",
      representativeFullName: "Dual Representative",
    })
    .expect(202);
  const delivery = input.emailInbox.latest(input.emailNormalized);
  await request(app)
    .post("/api/v1/auth/otp/verify")
    .send({
      challengeId: enrollment.body.data.challengeId,
      code: delivery!.value,
    })
    .expect(200);
}

export async function enrollIndividualCategory(
  app: Express,
  input: {
    readonly accessToken: string;
    readonly emailNormalized: string;
    readonly emailInbox: DeterministicAuthenticationInbox;
    readonly fullName?: string;
  },
): Promise<void> {
  const enrollment = await request(app)
    .post("/api/v1/auth/account-categories")
    .set("Authorization", `Bearer ${input.accessToken}`)
    .send({
      accountCategory: "INDIVIDUAL",
      fullName: input.fullName ?? "Recovered Individual",
    })
    .expect(202);
  const delivery = input.emailInbox.latest(input.emailNormalized);
  await request(app)
    .post("/api/v1/auth/otp/verify")
    .send({
      challengeId: enrollment.body.data.challengeId,
      code: delivery!.value,
    })
    .expect(200);
}

export type { ProviderKind };
