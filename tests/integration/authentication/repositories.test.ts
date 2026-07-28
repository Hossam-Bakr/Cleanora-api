import type { PrismaClient } from '../../../src/generated/prisma/client.js';
import {
  bindPrismaClient,
  resetPrismaClientForTests
} from '../../../src/integrations/database/index.js';
import { AuthenticationTransactionRepository } from '../../../src/modules/authentication/infrastructure/authentication-transaction.repository.js';
import { PasswordResetRepository } from '../../../src/modules/authentication/infrastructure/password-reset.repository.js';
import { AuthEventRepository } from '../../../src/modules/authentication/infrastructure/auth-event.repository.js';

describe('authentication repository conditional mutations', () => {
  afterEach(() => resetPrismaClientForTests('test'));

  it('supersedes an open reset before creating a pending-delivery reset', async () => {
    const calls: string[] = [];
    const transaction = {
      passwordResetToken: {
        updateMany: vi.fn(async () => {
          calls.push('supersede');
          return { count: 1 };
        }),
        create: vi.fn(async ({ data }: { data: object }) => {
          calls.push('create');
          return data;
        })
      }
    };
    const client = {
      $transaction: vi.fn(async (work: (value: typeof transaction) => unknown) => work(transaction))
    } as unknown as PrismaClient;
    bindPrismaClient(client);

    await new PasswordResetRepository().create({
      id: 'reset-1',
      userId: 'user-1',
      channel: 'SMS',
      destinationHash: 'a'.repeat(64),
      verifier: 'b'.repeat(64),
      expiresAt: new Date(Date.now() + 60_000),
      resendAt: new Date(Date.now() + 30_000),
      maxAttempts: 5
    });

    expect(calls).toEqual(['supersede', 'create']);
    expect(transaction.passwordResetToken.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'user-1', status: { in: ['PENDING_DELIVERY', 'ACTIVE'] } }
    }));
    expect(transaction.passwordResetToken.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.not.objectContaining({ status: 'ACTIVE', deliveredAt: expect.anything() })
    }));
  });

  it('maps a stale password-change rotation to the stable refresh error', async () => {
    const transaction = {
      userCredential: { update: vi.fn(async () => ({})) },
      userSession: {
        updateMany: vi.fn()
          .mockResolvedValueOnce({ count: 1 })
          .mockResolvedValueOnce({ count: 0 })
      },
      authEvent: { create: vi.fn(async () => ({})) }
    };
    const client = {
      $transaction: vi.fn(async (work: (value: typeof transaction) => unknown) => work(transaction))
    } as unknown as PrismaClient;
    bindPrismaClient(client);

    await expect(new AuthenticationTransactionRepository().changePassword({
      userId: 'user-1',
      sessionId: 'session-1',
      passwordHash: 'hash',
      expectedVerifier: 'old',
      nextVerifier: 'new',
      nextCredentialVersion: 2
    })).rejects.toMatchObject({ code: 'AUTH_REFRESH_TOKEN_INVALID', statusCode: 401 });
    expect(transaction.authEvent.create).not.toHaveBeenCalled();
  });

  it('removes only a new unverified identity after signup delivery fails', async () => {
    const calls: string[] = [];
    const transaction = {
      otpCode: { deleteMany: vi.fn(async () => { calls.push('challenge'); return { count: 1 }; }) },
      user: {
        findFirst: vi.fn(async () => ({ id: 'user-1' })),
        delete: vi.fn(async () => { calls.push('user'); return {}; })
      },
      userCredential: { deleteMany: vi.fn(async () => { calls.push('credential'); return { count: 1 }; }) }
    };
    const client = {
      $transaction: vi.fn(async (work: (value: typeof transaction) => unknown) => work(transaction))
    } as unknown as PrismaClient;
    bindPrismaClient(client);

    await new AuthenticationTransactionRepository().rollbackFailedSignup('user-1', 'challenge-1');

    expect(transaction.otpCode.deleteMany).toHaveBeenCalledWith({ where: { id: 'challenge-1', userId: 'user-1', status: 'DELIVERY_FAILED' } });
    expect(transaction.user.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 'user-1', verifiedCategories: { isEmpty: true }, sessions: { none: {} }, socialAccounts: { none: {} } }) }));
    expect(calls).toEqual(['challenge', 'credential', 'user']);
  });

  it('stores domain-separated hashes instead of raw request evidence', async () => {
    const create = vi.fn(async ({ data }: { data: Record<string, unknown> }) => data);
    bindPrismaClient({ authEvent: { create } } as unknown as PrismaClient);

    await new AuthEventRepository('privacy-test-secret').append({
      eventType: 'LOGIN_FAILED',
      outcome: 'FAILED',
      identifier: '+201000000000',
      ip: '203.0.113.10',
      userAgent: 'secret-agent-value'
    });

    const data = create.mock.calls[0]?.[0].data;
    expect(data).not.toHaveProperty('identifier');
    expect(data).not.toHaveProperty('ip');
    expect(data).not.toHaveProperty('userAgent');
    expect(data?.['identifierHash']).toMatch(/^[a-f0-9]{64}$/);
    expect(data?.['ipHash']).toMatch(/^[a-f0-9]{64}$/);
    expect(data?.['userAgentHash']).toMatch(/^[a-f0-9]{64}$/);
    expect(new Set([data?.['identifierHash'], data?.['ipHash'], data?.['userAgentHash']]).size).toBe(3);
  });

  it('does not update identity or write success events when OTP consumption loses a race', async () => {
    const now = new Date();
    const transaction = {
      otpCode: {
        findFirst: vi.fn(async () => ({ id: 'challenge-1', userId: 'user-1', accountCategory: 'INDIVIDUAL', purpose: 'CATEGORY_VERIFICATION', channel: 'SMS', status: 'ACTIVE', expiresAt: new Date(now.getTime() + 60_000) })),
        updateMany: vi.fn(async () => ({ count: 0 }))
      },
      user: { findUnique: vi.fn(async () => ({ id: 'user-1', phoneE164: '+201000000000', emailNormalized: null, accountCategories: ['INDIVIDUAL'], verifiedCategories: [], status: 'ACTIVE', suspendedUntil: null, statusChangedAt: now, phoneVerifiedAt: null, emailVerifiedAt: null, createdAt: now, updatedAt: now })), update: vi.fn() },
      authEvent: { create: vi.fn() }
    };
    bindPrismaClient({ $transaction: vi.fn(async (work: (value: typeof transaction) => unknown) => work(transaction)) } as unknown as PrismaClient);

    await expect(new AuthenticationTransactionRepository().completeVerification('challenge-1')).resolves.toBe(false);
    expect(transaction.user.update).not.toHaveBeenCalled();
    expect(transaction.authEvent.create).not.toHaveBeenCalled();
  });

  it('revalidates stored enrollment before consuming or appending a category', async () => {
    const now = new Date();
    const transaction = {
      otpCode: { findFirst: vi.fn(async () => ({ id: 'challenge-1', userId: 'user-1', accountCategory: 'WORKER', purpose: 'CATEGORY_VERIFICATION', channel: 'SMS', status: 'ACTIVE', expiresAt: new Date(now.getTime() + 60_000) })), updateMany: vi.fn() },
      user: { findUnique: vi.fn(async () => ({ id: 'user-1', phoneE164: '+201000000000', emailNormalized: null, accountCategories: ['INDIVIDUAL'], verifiedCategories: [], status: 'ACTIVE', suspendedUntil: null, statusChangedAt: now, phoneVerifiedAt: null, emailVerifiedAt: null, createdAt: now, updatedAt: now })), update: vi.fn() },
      authEvent: { create: vi.fn() }
    };
    bindPrismaClient({ $transaction: vi.fn(async (work: (value: typeof transaction) => unknown) => work(transaction)) } as unknown as PrismaClient);

    await expect(new AuthenticationTransactionRepository().completeVerification('challenge-1')).rejects.toMatchObject({ code: 'AUTH_VERIFICATION_FAILED' });
    expect(transaction.otpCode.updateMany).not.toHaveBeenCalled();
    expect(transaction.user.update).not.toHaveBeenCalled();
    expect(transaction.authEvent.create).not.toHaveBeenCalled();
  });
});
