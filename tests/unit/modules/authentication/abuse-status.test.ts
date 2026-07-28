import { AUTH_RATE_LIMITS } from '../../../../src/modules/authentication/domain/rate-limit.policy.js';
import { loginCapability } from '../../../../src/modules/authentication/domain/login-eligibility.policy.js';

describe('authentication abuse and status policy', () => {
  it('keeps deterministic endpoint limits', () => {
    expect(AUTH_RATE_LIMITS.login).toEqual({ ip: [20, 900], subject: [5, 900] });
    expect(AUTH_RATE_LIMITS.refresh).toEqual({ ip: [60, 300], subject: [30, 300] });
  });
  it.each(['SUSPENDED', 'BANNED'] as const)('denies %s identities', (status) => {
    expect(() => loginCapability({ id: 'u', phoneE164: '+201000000000', emailNormalized: null, accountCategories: ['INDIVIDUAL'], verifiedCategories: ['INDIVIDUAL'], status, suspendedUntil: status === 'SUSPENDED' ? new Date(Date.now() + 60_000) : null, phoneVerifiedAt: new Date(), emailVerifiedAt: null })).toThrow();
  });
});
