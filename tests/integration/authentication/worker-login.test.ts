import type { PrismaClient } from '../../../src/generated/prisma/client.js';
import { bindPrismaClient, resetPrismaClientForTests } from '../../../src/integrations/database/index.js';
import { AuthenticationService } from '../../../src/modules/authentication/application/authentication.service.js';
import { workerFixture } from '../../helpers/authentication/worker-fixture.js';

describe('existing worker authentication', () => {
  afterEach(() => resetPrismaClientForTests('test'));

  it('logs in a provisioned verified worker but rejects worker self-signup', async () => {
    const worker = workerFixture();
    const client = {
      user: { findUnique: vi.fn(async () => worker) },
      userCredential: {
        findUnique: vi.fn(async () => ({ userId: worker.id, passwordHash: 'stored', credentialVersion: 1, lockedUntil: null })),
        update: vi.fn(async () => ({}))
      },
      userSession: { create: vi.fn(async ({ data }: { data: object }) => data) },
      socialAccount: { findUnique: vi.fn(async () => null) },
      authEvent: { create: vi.fn(async ({ data }: { data: object }) => data) }
    } as unknown as PrismaClient;
    bindPrismaClient(client);
    const service = new AuthenticationService({
      passwordHasher: { hash: async () => 'stored', verify: async (_hash, password) => password === 'correct-password', dummyVerify: async () => undefined },
      tokens: {
        issueAccess: () => ({ token: 'access', expiresAt: new Date(Date.now() + 60_000) }),
        issueRefresh: (_claims, expiresAt) => ({ token: 'refresh', expiresAt }),
        verifyAccess: () => ({ userId: worker.id, sessionId: 'session', credentialVersion: 1 }),
        verifyRefresh: () => ({ userId: worker.id, sessionId: 'session', credentialVersion: 1, rotationCounter: 0, jwtId: 'jwt' })
      },
      verifier: { randomOtp: () => '123456', randomSecret: () => 'secret', verifyOtp: () => 'otp', verifyReset: () => 'reset', verifyRefresh: () => 'refresh-verifier', hashDestination: () => 'a'.repeat(64), equals: (left, right) => left === right },
      email: { send: async () => undefined },
      accessTtlSeconds: 900,
      refreshTtlSeconds: 3600,
      privacyHashSecret: 'privacy-test-secret'
    });

    const login = await service.login(worker.phoneE164, 'correct-password');
    expect(login.principal).toMatchObject({ userId: worker.id, accountCategories: ['WORKER'], verificationOnly: false });
    await expect(service.signup({ accountCategory: 'WORKER', phone: worker.phoneE164, password: 'Correct-password-123!' })).rejects.toMatchObject({ code: 'AUTH_ACCOUNT_CATEGORY_NOT_ALLOWED' });
  });
});
