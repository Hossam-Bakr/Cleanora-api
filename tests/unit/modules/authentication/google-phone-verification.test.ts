import { AuthenticationService } from '../../../../src/modules/authentication/application/authentication.service.js';

function createService(): AuthenticationService {
  return new AuthenticationService({
    passwordHasher: {
      hash: async () => 'hash',
      verify: async () => true,
      dummyVerify: async () => undefined,
    },
    tokens: {
      issueAccess: () => ({ token: 'access', expiresAt: new Date() }),
      issueRefresh: (_claims, expiresAt) => ({ token: 'refresh', expiresAt }),
      verifyAccess: () => ({
        userId: 'user-1',
        sessionId: 'session-1',
        credentialVersion: 1,
      }),
      verifyRefresh: () => ({
        userId: 'user-1',
        sessionId: 'session-1',
        credentialVersion: 1,
        rotationCounter: 0,
        jwtId: 'jwt',
      }),
    },
    verifier: {
      randomOtp: () => '123456',
      randomSecret: () => 'secret',
      verifyOtp: () => 'otp',
      verifyReset: () => 'reset',
      verifyRefresh: () => 'refresh',
      hashDestination: () => 'a'.repeat(64),
      equals: (left, right) => left === right,
    },
    sms: { send: async () => undefined },
    email: { send: async () => undefined },
    accessTtlSeconds: 900,
    refreshTtlSeconds: 3600,
    privacyHashSecret: 'privacy-test-secret',
    policy: {
      signIn: async () => ({
        maxFailures: 3,
        windowSeconds: 30,
        lockSeconds: 60,
      }),
      verification: async () => ({
        ttlSeconds: 120,
        maxAttempts: 4,
        resendSeconds: 20,
      }),
      recovery: async () => ({ ttlSeconds: 300, maxAttempts: 4 }),
      endpointLimits: async () => ({
        signupPer15Minutes: 7,
        loginPer15Minutes: 11,
      }),
    },
  });
}

const verificationOnlyPrincipal = {
  userId: 'user-1',
  sessionId: 'session-1',
  accountCategories: ['INDIVIDUAL'],
  verifiedCategories: [],
  pendingCategories: ['INDIVIDUAL'],
  status: 'ACTIVE',
  verificationOnly: true,
} as const;

describe('Google phone verification boundary', () => {
  it.each([
    ['COMPANY', 'CATEGORY_VERIFICATION', 'EMAIL'],
    ['INDIVIDUAL', 'OPTIONAL_INDIVIDUAL_EMAIL_VERIFICATION', 'EMAIL'],
    ['INDIVIDUAL', 'CATEGORY_VERIFICATION', 'EMAIL'],
  ] as const)(
    'rejects an unrelated %s/%s/%s challenge before identity mutation',
    async (accountCategory, purpose, channel) => {
      const service = createService();
      Object.defineProperty(service, 'otps', {
        value: {
          find: vi.fn(async () => ({
            id: 'challenge-1',
            userId: 'user-1',
            accountCategory,
            purpose,
            channel,
            destinationHash: 'a'.repeat(64),
            codeVerifier: 'otp',
            status: 'ACTIVE',
            expiresAt: new Date(Date.now() + 60_000),
            attemptCount: 0,
            maxAttempts: 5,
          })),
        },
      });

      await expect(
        service.verifyGooglePhone(verificationOnlyPrincipal, {
          challengeId: 'challenge-1',
          code: '123456',
        }),
      ).rejects.toMatchObject({ code: 'AUTH_VERIFICATION_FAILED' });
    },
  );
});
