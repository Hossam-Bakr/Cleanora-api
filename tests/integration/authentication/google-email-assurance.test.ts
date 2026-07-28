import type { PrismaClient } from '../../../src/generated/prisma/client.js';
import { bindPrismaClient, resetPrismaClientForTests } from '../../../src/integrations/database/index.js';
import { AuthenticationService } from '../../../src/modules/authentication/application/authentication.service.js';
import { GoogleAuthenticationService } from '../../../src/modules/authentication/application/google-authentication.js';
import { MemoryGoogleTransactionStoreAdapter } from '../../../src/integrations/authentication/memory-google-transaction-store.adapter.js';

const now = new Date();
const dependencies = {
  passwordHasher: { hash: async () => 'hash', verify: async () => true, dummyVerify: async () => undefined },
  tokens: { issueAccess: () => ({ token: 'access', expiresAt: new Date(now.getTime() + 60_000) }), issueRefresh: (_claims: object, expiresAt: Date) => ({ token: 'refresh', expiresAt }), verifyAccess: () => ({ userId: 'user-1', sessionId: 'session-1', credentialVersion: 1 }), verifyRefresh: () => ({ userId: 'user-1', sessionId: 'session-1', credentialVersion: 1, rotationCounter: 0, jwtId: 'jwt' }) },
  verifier: { randomOtp: () => '123456', randomSecret: () => 'secret', verifyOtp: () => 'otp', verifyReset: () => 'reset', verifyRefresh: () => 'refresh-verifier', hashDestination: () => 'a'.repeat(64), equals: (left: string, right: string) => left === right },
  email: { send: async () => undefined }, accessTtlSeconds: 900, refreshTtlSeconds: 3600, privacyHashSecret: 'privacy-test-secret'
};

describe('Google provider assurance', () => {
  afterEach(() => resetPrismaClientForTests('test'));

  it.each([
    { subject: 'subject-1', email: 'user@example.test', emailVerified: false },
    { subject: 'subject-1', emailVerified: false }
  ])('rejects missing or unverified provider email before persistence', async (provider) => {
    const service = new AuthenticationService(dependencies);
    await expect(service.googleSignIn(provider)).rejects.toMatchObject({ code: 'AUTH_SOCIAL_AUTHENTICATION_FAILED' });
  });

  it('does not auto-link a verified Google email to an existing account', async () => {
    const existing = { id: 'company-user', accountCategories: ['COMPANY'] };
    bindPrismaClient({ socialAccount: { findUnique: vi.fn(async () => null) }, user: { findUnique: vi.fn(async () => existing) } } as unknown as PrismaClient);
    await expect(new AuthenticationService(dependencies).googleSignIn({ subject: 'subject-1', email: 'company@example.test', emailVerified: true })).rejects.toMatchObject({ code: 'AUTH_SOCIAL_AUTHENTICATION_FAILED' });
  });

  it('persists verified provider assurance and creates a full individual session', async () => {
    const user = { id: 'user-1', phoneE164: null, emailNormalized: 'user@example.test', accountCategories: ['INDIVIDUAL'], verifiedCategories: ['INDIVIDUAL'], status: 'ACTIVE', suspendedUntil: null, statusChangedAt: now, phoneVerifiedAt: null, emailVerifiedAt: new Date(), createdAt: now, updatedAt: now };
    const socialCreate = vi.fn(async () => ({}));
    const userCreate = vi.fn(async () => user);
    const transaction = { user: { create: userCreate }, socialAccount: { create: socialCreate }, authEvent: { create: vi.fn(async () => ({})) } };
    const client = {
      socialAccount: { findUnique: vi.fn(async () => null) },
      user: { findUnique: vi.fn(async () => null) },
      userCredential: { findUnique: vi.fn(async () => null) },
      userSession: { create: vi.fn(async () => ({})) },
      authEvent: { create: vi.fn(async () => ({})) },
      $transaction: vi.fn(async (work: (value: typeof transaction) => unknown) => work(transaction))
    } as unknown as PrismaClient;
    bindPrismaClient(client);

    const result = await new AuthenticationService(dependencies).googleSignIn({ subject: 'subject-1', email: 'User@Example.Test', emailVerified: true });
    expect(result.verificationOnly).toBe(false);
    expect(result.principal).toMatchObject({ accountCategories: ['INDIVIDUAL'], verifiedCategories: ['INDIVIDUAL'], verificationOnly: false });
    expect(userCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        emailNormalized: 'user@example.test',
        emailVerifiedAt: expect.any(Date),
      }),
    });
    expect(socialCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ providerEmailNormalized: 'user@example.test', providerEmailVerifiedAt: expect.any(Date), accountCategory: 'INDIVIDUAL' }) });
  });

  it('rejects Google linking for a non-individual audience and unverified provider proof', async () => {
    const authentication = new AuthenticationService(dependencies);
    const google = new GoogleAuthenticationService({ createAuthorizationUrl: async () => 'https://google.test', consumeCallback: async () => ({ subject: 'subject-1', email: 'user@example.test', emailVerified: false }) }, new MemoryGoogleTransactionStoreAdapter(), authentication);
    const company = { userId: 'company-user', sessionId: 'session-1', accountCategories: ['COMPANY'] as const, verifiedCategories: ['COMPANY'] as const, pendingCategories: [], status: 'ACTIVE' as const, verificationOnly: false };
    await expect(google.start('LINK', company)).rejects.toMatchObject({ code: 'AUTH_SOCIAL_LINK_FAILED' });
    await expect(authentication.linkGoogle({ ...company, accountCategories: ['INDIVIDUAL'], verifiedCategories: ['INDIVIDUAL'] }, { subject: 'subject-1', email: 'user@example.test', emailVerified: false })).rejects.toMatchObject({ code: 'AUTH_SOCIAL_LINK_FAILED' });
  });
});
