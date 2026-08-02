import type { PrismaClient } from '../../../src/generated/prisma/client.js';
import { bindPrismaClient, resetPrismaClientForTests } from '../../../src/database/prisma.js';
import { AuthenticationService } from '../../../src/modules/authentication/auth.service.js';
import { OtpRepository } from '../../../src/modules/authentication/infrastructure/auth.repository.js';

const input = { id: 'new-challenge', userId: 'user-1', category: 'INDIVIDUAL' as const, purpose: 'CATEGORY_VERIFICATION' as const, channel: 'EMAIL' as const, destinationHash: 'a'.repeat(64), verifier: 'b'.repeat(64), expiresAt: new Date(Date.now() + 600_000), resendAt: new Date(Date.now() + 60_000), maxAttempts: 5 };

describe('OTP resend cooldown', () => {
  afterEach(() => resetPrismaClientForTests('test'));

  it('returns the open challenge inside cooldown without superseding or creating', async () => {
    const current = { id: 'current-challenge', resendAvailableAt: new Date(Date.now() + 30_000), expiresAt: new Date(Date.now() + 300_000) };
    const transaction = { otpCode: { findFirst: vi.fn(async () => current), updateMany: vi.fn(), create: vi.fn() } };
    bindPrismaClient({ $transaction: vi.fn(async (work: (value: typeof transaction) => unknown) => work(transaction)) } as unknown as PrismaClient);

    await expect(new OtpRepository().create(input)).resolves.toEqual({ challenge: current, created: false });
    expect(transaction.otpCode.updateMany).not.toHaveBeenCalled();
    expect(transaction.otpCode.create).not.toHaveBeenCalled();
  });

  it('treats expiry and cooldown separately and atomically replaces an eligible challenge', async () => {
    const calls: string[] = [];
    const created = { id: input.id };
    const transaction = { otpCode: {
      findFirst: vi.fn(async () => null),
      updateMany: vi.fn(async () => { calls.push('supersede'); return { count: 1 }; }),
      create: vi.fn(async () => { calls.push('create'); return created; })
    } };
    const transact = vi.fn(async (work: (value: typeof transaction) => unknown) => work(transaction));
    bindPrismaClient({ $transaction: transact } as unknown as PrismaClient);

    await expect(new OtpRepository().create(input)).resolves.toEqual({ challenge: created, created: true });
    expect(calls).toEqual(['supersede', 'create']);
    expect(transact).toHaveBeenCalledOnce();
  });

  it('does not invoke the provider for a request rejected by cooldown', async () => {
    const now = new Date();
    const user = { id: 'user-1', phoneE164: '+201000000000', emailNormalized: 'user@example.test', accountCategories: ['INDIVIDUAL'], verifiedCategories: [], status: 'ACTIVE', suspendedUntil: null, statusChangedAt: now, phoneVerifiedAt: null, emailVerifiedAt: null, createdAt: now, updatedAt: now };
    const current = { id: 'current-challenge', resendAvailableAt: new Date(now.getTime() + 30_000), expiresAt: new Date(now.getTime() + 300_000) };
    const transaction = { otpCode: { findFirst: vi.fn(async () => current), updateMany: vi.fn(), create: vi.fn() } };
    bindPrismaClient({ user: { findUnique: vi.fn(async () => user) }, $transaction: vi.fn(async (work: (value: typeof transaction) => unknown) => work(transaction)) } as unknown as PrismaClient);
    const send = vi.fn(async () => undefined);
    const service = new AuthenticationService({
      passwordHasher: { hash: async () => 'hash', verify: async () => true, dummyVerify: async () => undefined },
      tokens: { issueAccess: () => ({ token: 'access', expiresAt: now }), issueRefresh: (_claims, expiresAt) => ({ token: 'refresh', expiresAt }), verifyAccess: () => ({ userId: user.id, sessionId: 'session', credentialVersion: 1 }), verifyRefresh: () => ({ userId: user.id, sessionId: 'session', credentialVersion: 1, rotationCounter: 0, jwtId: 'jwt' }) },
      verifier: { randomOtp: () => '123456', randomSecret: () => 'secret', verifyOtp: () => 'otp-verifier', verifyReset: () => 'reset', verifyRefresh: () => 'refresh', hashDestination: () => 'a'.repeat(64), equals: (left, right) => left === right },
      email: { send }, accessTtlSeconds: 900, refreshTtlSeconds: 3600, privacyHashSecret: 'privacy-test-secret'
    });

    await expect(service.requestVerification({ userId: user.id, category: 'INDIVIDUAL' })).resolves.toMatchObject({ accepted: true, challengeId: current.id, nextAction: 'VERIFY_ACCOUNT' });
    expect(send).not.toHaveBeenCalled();
  });

  it('leaves one usable challenge when replacement requests run concurrently', async () => {
    let open: { id: string; resendAvailableAt: Date; expiresAt: Date } | null = null;
    let chain = Promise.resolve();
    const transaction = { otpCode: {
      findFirst: vi.fn(async () => open),
      updateMany: vi.fn(async () => ({ count: open === null ? 0 : 1 })),
      create: vi.fn(async ({ data }: { data: typeof input }) => {
        open = { id: data.id, resendAvailableAt: data.resendAt, expiresAt: data.expiresAt };
        return open;
      })
    } };
    const transact = vi.fn((work: (value: typeof transaction) => unknown) => {
      const result = chain.then(() => work(transaction));
      chain = result.then(() => undefined, () => undefined);
      return result;
    });
    bindPrismaClient({ $transaction: transact } as unknown as PrismaClient);
    const repository = new OtpRepository();

    const results = await Promise.all([
      repository.create({ ...input, id: 'challenge-a' }),
      repository.create({ ...input, id: 'challenge-b' })
    ]);
    expect(results.filter((result) => result.created)).toHaveLength(1);
    expect(results[0]?.challenge.id).toBe(results[1]?.challenge.id);
    expect(transaction.otpCode.create).toHaveBeenCalledOnce();
  });
});
