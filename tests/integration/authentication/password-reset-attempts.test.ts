import type { PrismaClient } from '../../../src/generated/prisma/client.js';
import { bindPrismaClient, resetPrismaClientForTests } from '../../../src/integrations/database/index.js';
import { AuthenticationService } from '../../../src/modules/authentication/application/authentication.service.js';

function service() {
  return new AuthenticationService({
    passwordHasher: { hash: async () => 'new-hash', verify: async () => true, dummyVerify: async () => undefined },
    tokens: { issueAccess: () => ({ token: 'access', expiresAt: new Date() }), issueRefresh: (_claims, expiresAt) => ({ token: 'refresh', expiresAt }), verifyAccess: () => ({ userId: 'user-1', sessionId: 'session-1', credentialVersion: 1 }), verifyRefresh: () => ({ userId: 'user-1', sessionId: 'session-1', credentialVersion: 1, rotationCounter: 0, jwtId: 'jwt' }) },
    verifier: { randomOtp: () => '123456', randomSecret: () => 'secret', verifyOtp: () => 'otp', verifyReset: (_id, secret) => secret, verifyRefresh: () => 'refresh', hashDestination: () => 'a'.repeat(64), equals: (left, right) => left === right },
    sms: { send: async () => undefined }, email: { send: async () => undefined }, accessTtlSeconds: 900, refreshTtlSeconds: 3600, privacyHashSecret: 'privacy-test-secret'
  });
}

describe('password-reset attempt limits', () => {
  afterEach(() => resetPrismaClientForTests('test'));

  it('atomically exhausts the token under parallel invalid attempts', async () => {
    const state = { id: 'reset-1', userId: 'user-1', tokenVerifier: 'correct-secret', status: 'ACTIVE', attemptCount: 0, maxAttempts: 5, expiresAt: new Date(Date.now() + 60_000) };
    const queryRaw = vi.fn(async () => {
      if (state.status !== 'ACTIVE' || state.attemptCount >= state.maxAttempts) return [];
      state.attemptCount += 1;
      if (state.attemptCount >= state.maxAttempts) state.status = 'EXHAUSTED';
      return [{ attempt_count: state.attemptCount }];
    });
    bindPrismaClient({ passwordResetToken: { findUnique: vi.fn(async () => ({ ...state })) }, $queryRaw: queryRaw } as unknown as PrismaClient);

    const attempts = await Promise.allSettled(Array.from({ length: 5 }, () => service().resetPassword('reset-1.wrong-secret', 'a-secure-long-password')));
    expect(attempts.every((result) => result.status === 'rejected')).toBe(true);
    expect(state).toMatchObject({ attemptCount: 5, status: 'EXHAUSTED' });
    await expect(service().resetPassword('reset-1.correct-secret', 'a-secure-long-password')).rejects.toMatchObject({ code: 'AUTH_PASSWORD_RESET_FAILED' });
    expect(queryRaw).toHaveBeenCalledTimes(5);
  });

  it.each([
    { status: 'CONSUMED', attemptCount: 0, expiresAt: new Date(Date.now() + 60_000) },
    { status: 'ACTIVE', attemptCount: 5, expiresAt: new Date(Date.now() + 60_000) },
    { status: 'ACTIVE', attemptCount: 0, expiresAt: new Date(Date.now() - 1) }
  ])('rejects consumed, exhausted, or expired tokens consistently', async (override) => {
    const queryRaw = vi.fn();
    bindPrismaClient({ passwordResetToken: { findUnique: vi.fn(async () => ({ id: 'reset-1', userId: 'user-1', tokenVerifier: 'correct-secret', maxAttempts: 5, ...override })) }, $queryRaw: queryRaw } as unknown as PrismaClient);
    await expect(service().resetPassword('reset-1.correct-secret', 'a-secure-long-password')).rejects.toMatchObject({ code: 'AUTH_PASSWORD_RESET_FAILED' });
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('rejects malformed tokens without attempting persistence', async () => {
    const findUnique = vi.fn();
    bindPrismaClient({ passwordResetToken: { findUnique } } as unknown as PrismaClient);
    await expect(service().resetPassword('malformed', 'a-secure-long-password')).rejects.toMatchObject({ code: 'AUTH_PASSWORD_RESET_FAILED' });
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('consumes one valid token once and performs the reset transaction', async () => {
    const reset = { id: 'reset-1', userId: 'user-1', tokenVerifier: 'correct-secret', status: 'ACTIVE', attemptCount: 0, maxAttempts: 5, expiresAt: new Date(Date.now() + 60_000) };
    const transaction = { passwordResetToken: { updateMany: vi.fn(async () => ({ count: 1 })) }, userCredential: { update: vi.fn(async () => ({})) }, userSession: { updateMany: vi.fn(async () => ({ count: 1 })) }, authEvent: { create: vi.fn(async () => ({})) } };
    bindPrismaClient({ passwordResetToken: { findUnique: vi.fn(async () => reset) }, auditLog: { create: vi.fn(async () => ({ id: 'audit-1', actorType: 'USER', actorId: 'user-1', action: 'AUTH_PASSWORD_RESET_ATTEMPTED', targetType: 'USER', targetId: 'user-1', reason: null, context: null, requestId: null, createdAt: new Date() })) }, $transaction: vi.fn(async (work: (value: typeof transaction) => unknown) => work(transaction)) } as unknown as PrismaClient);
    await expect(service().resetPassword('reset-1.correct-secret', 'a-secure-long-password')).resolves.toEqual({ passwordReset: true, nextAction: 'LOGIN' });
    expect(transaction.passwordResetToken.updateMany).toHaveBeenCalledOnce();
  });
});
