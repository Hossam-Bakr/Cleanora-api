import { randomUUID } from 'node:crypto';
import { createTestApp } from '../create-test-app.js';
import { createAuthenticationModule } from "../../../src/modules/authentication/auth.module.js";
import { Argon2PasswordHasherAdapter } from '../../../src/integrations/authentication/argon2-password-hasher.adapter.js';
import { CryptoVerifierAdapter } from '../../../src/integrations/authentication/crypto-verifier.adapter.js';
import { JwtTokenServiceAdapter } from '../../../src/integrations/authentication/jwt-token-service.adapter.js';
import { MemoryGoogleTransactionStoreAdapter } from '../../../src/integrations/authentication/memory-google-transaction-store.adapter.js';
import { createTestEnvironment } from '../test-environment.js';
import { TestLogger } from '../test-logger.js';
import { startTestDatabaseLifecycle, stopTestDatabaseLifecycle } from '../test-database-lifecycle.js';
import { requireApprovedTestDatabaseUrl } from '../resolve-test-database-url.js';
import { DeterministicAuthenticationInbox } from './deterministic-delivery.js';
import { DeterministicGoogleAdapter } from './deterministic-google.adapter.js';
import { createPrismaCustomerSignupProfileWriter } from '../../../src/modules/customers/infrastructure/prisma-customer-signup-profile.writer.js';

export async function startAuthenticationTestApp(options: {
  readonly now?: () => Date;
} = {}) {
  const database = await startTestDatabaseLifecycle();
  const email = new DeterministicAuthenticationInbox();
  const google = new DeterministicGoogleAdapter();
  const { url: testDatabaseUrl } = requireApprovedTestDatabaseUrl();
  const environment = createTestEnvironment({ AUTH_ENABLED: true, EMAIL_AUTH_ENABLED: true, SMS_AUTH_ENABLED: false, GOOGLE_AUTH_ENABLED: true, DATABASE_URL: testDatabaseUrl });
  const rateLimiter = { consume: async () => ({ allowed: true, remaining: 1_000 }) };
  const authentication = createAuthenticationModule({
    trustedOrigins: environment.CORS_ORIGINS,
    cookie: { name: environment.AUTH_REFRESH_COOKIE_NAME, path: environment.AUTH_REFRESH_COOKIE_PATH, secure: false, sameSite: 'lax' },
    passwordHasher: new Argon2PasswordHasherAdapter(),
    tokens: new JwtTokenServiceAdapter({ accessSecret: environment.JWT_ACCESS_SECRET!, refreshSecret: environment.JWT_REFRESH_SECRET!, issuer: environment.JWT_ISSUER, audience: environment.JWT_AUDIENCE, accessTtlSeconds: environment.JWT_ACCESS_TTL_SECONDS }),
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
    ...(options.now === undefined ? {} : { now: options.now }),
  });
  const logger = new TestLogger();
  const app = createTestApp({
    environment,
    logger,
    rateLimiter,
    authenticationRouter: authentication.router,
  });
  return {
    app,
    database,
    prisma: database.client,
    email,
    google,
    logger,
    stop: () => stopTestDatabaseLifecycle(database)
  };
}

export function uniqueIdentity(label = 'user') {
  // Egypt mobile E.164: +201 + 9 digits derived from UUID hex so suite-wide collisions cannot occur.
  const id = randomUUID();
  const hex = id.replace(/-/gu, "");
  const nineDigits = (BigInt(`0x${hex.slice(0, 13)}`) % 1_000_000_000n)
    .toString()
    .padStart(9, "0");
  return {
    phone: `+201${nineDigits}`,
    email: `${label}-${id}@example.test`,
    password: "Correct-password-123!",
  };
}
