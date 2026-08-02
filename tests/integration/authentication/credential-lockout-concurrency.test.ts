import type { PrismaClient } from '../../../src/generated/prisma/client.js';
import { bindPrismaClient, resetPrismaClientForTests } from '../../../src/database/prisma.js';
import { CredentialRepository } from '../../../src/modules/authentication/infrastructure/auth.repository.js';

describe('credential lockout concurrency', () => {
  afterEach(() => resetPrismaClientForTests('test'));

  it('does not lose parallel failure increments and locks at the configured threshold', async () => {
    const state = { attempts: 0, lockedUntil: null as Date | null };
    const queryRaw = vi.fn(async () => {
      state.attempts += 1;
      if (state.attempts >= 5) state.lockedUntil = new Date(Date.now() + 60_000);
      return [{ failed_login_attempts: state.attempts, locked_until: state.lockedUntil }];
    });
    const findUnique = vi.fn();
    bindPrismaClient({ $queryRaw: queryRaw, userCredential: { findUnique } } as unknown as PrismaClient);
    const repository = new CredentialRepository();

    await Promise.all(Array.from({ length: 5 }, () => repository.failure('user-1', new Date(), { maxFailures: 5, windowSeconds: 900, lockSeconds: 60 })));
    expect(state.attempts).toBe(5);
    expect(state.lockedUntil).toBeInstanceOf(Date);
    expect(queryRaw).toHaveBeenCalledTimes(5);
    expect(findUnique).not.toHaveBeenCalled();
  });
});
