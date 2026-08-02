import { assertSelfSignupCategory } from '../../../../src/modules/authentication/domain/auth.policy.js';
import { loginCapability } from '../../../../src/modules/authentication/domain/auth.policy.js';

describe('worker login boundary', () => {
  it('allows an existing verified worker while prohibiting worker self-signup', () => {
    expect(() => assertSelfSignupCategory('WORKER')).toThrow();
    expect(loginCapability({ id: 'worker', phoneE164: '+201000000001', emailNormalized: null, accountCategories: ['WORKER'], verifiedCategories: ['WORKER'], status: 'ACTIVE', suspendedUntil: null, phoneVerifiedAt: new Date(), emailVerifiedAt: null })).toBe('FULL');
  });
});
