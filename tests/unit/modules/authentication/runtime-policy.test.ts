import { AuthenticationService } from '../../../../src/modules/authentication/application/authentication.service.js';

describe('runtime authentication configuration', () => {
  it('reads endpoint limits from the injected typed configuration port', async () => {
    const endpointLimits = vi.fn(async () => ({ signupPer15Minutes: 7, loginPer15Minutes: 11 }));
    const service = new AuthenticationService({
      passwordHasher: { hash: async () => 'hash', verify: async () => true, dummyVerify: async () => undefined },
      tokens: { issueAccess: () => ({ token: 'access', expiresAt: new Date() }), issueRefresh: (_claims, expiresAt) => ({ token: 'refresh', expiresAt }), verifyAccess: () => ({ userId: 'user', sessionId: 'session', credentialVersion: 1 }), verifyRefresh: () => ({ userId: 'user', sessionId: 'session', credentialVersion: 1, rotationCounter: 0, jwtId: 'jwt' }) },
      verifier: { randomOtp: () => '123456', randomSecret: () => 'secret', verifyOtp: () => 'otp', verifyReset: () => 'reset', verifyRefresh: () => 'refresh', hashDestination: () => 'a'.repeat(64), equals: (left, right) => left === right },
      email: { send: async () => undefined },
      accessTtlSeconds: 900,
      refreshTtlSeconds: 3600,
      privacyHashSecret: 'privacy-test-secret',
      policy: {
        signIn: async () => ({ maxFailures: 3, windowSeconds: 30, lockSeconds: 60 }),
        verification: async () => ({ ttlSeconds: 120, maxAttempts: 4, resendSeconds: 20 }),
        recovery: async () => ({ ttlSeconds: 300, maxAttempts: 4 }),
        endpointLimits
      }
    });

    await expect(service.endpointLimits()).resolves.toEqual({ signupPer15Minutes: 7, loginPer15Minutes: 11 });
    expect(endpointLimits).toHaveBeenCalledOnce();
  });
});
