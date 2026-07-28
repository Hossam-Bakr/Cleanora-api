/** Build the smallest persistence-shaped worker identity used by login tests. */
export function workerFixture() {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: 'worker-user-1',
    phoneE164: '+201000000001',
    emailNormalized: null,
    accountCategories: ['WORKER'],
    verifiedCategories: ['WORKER'],
    status: 'ACTIVE',
    suspendedUntil: null,
    statusChangedAt: now,
    phoneVerifiedAt: now,
    emailVerifiedAt: null,
    createdAt: now,
    updatedAt: now
  } as const;
}

/** Provision a worker directly through the controlled test fixture, never a public route. */
export async function provisionWorker(prisma: PrismaClient) {
  const suffix = `${Date.now()}${randomInt(100_000, 999_999)}`.slice(-10);
  const phone = `+201${suffix.slice(-9)}`;
  const password = 'Worker-password-123!';
  const passwordHash = await new Argon2PasswordHasherAdapter().hash(password);
  const user = await prisma.$transaction(async (transaction) => {
    const created = await transaction.user.create({ data: { phoneE164: phone, accountCategories: ['WORKER'], verifiedCategories: ['WORKER'], phoneVerifiedAt: new Date() } });
    await transaction.userCredential.create({ data: { userId: created.id, passwordHash } });
    return created;
  });
  return { user, phone, password };
}
import { randomInt } from 'node:crypto';
import type { PrismaClient } from '../../../src/generated/prisma/client.js';
import { Argon2PasswordHasherAdapter } from '../../../src/integrations/authentication/argon2-password-hasher.adapter.js';
