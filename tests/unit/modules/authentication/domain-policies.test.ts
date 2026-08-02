import { assertSelfSignupCategory, pendingCategories } from '../../../../src/modules/authentication/domain/auth.policy.js';
import { loginCapability } from '../../../../src/modules/authentication/domain/auth.policy.js';
import { assertPasswordPolicy, normalizeEmail, normalizePhone } from '../../../../src/modules/authentication/domain/auth.policy.js';
import { recoveryChannel } from '../../../../src/modules/authentication/domain/auth.policy.js';
import { blockingVerificationChannel } from '../../../../src/modules/authentication/domain/auth.policy.js';

describe('authentication domain policies', () => {
  it('normalizes identifiers and enforces bounded passwords', () => {
    expect(normalizePhone('+20 100-000-0000')).toBe('+201000000000');
    expect(normalizeEmail(' User@Example.COM ')).toBe('user@example.com');
    expect(() => assertPasswordPolicy('short')).toThrow();
    expect(() => assertPasswordPolicy('a-secure-long-password')).not.toThrow();
    expect(() => assertPasswordPolicy('8392741')).not.toThrow();
  });
  it.each([
    '1234567',
    '7654321',
    '6666666',
    '12121212',
    'password',
    'qwerty123',
  ])('rejects the predictable password %s', (password) => {
    expect(() => assertPasswordPolicy(password)).toThrowError(
      expect.objectContaining({
        code: 'AUTH_PASSWORD_POLICY_FAILED',
        statusCode: 400,
      }),
    );
  });
  it('rejects malformed or oversized authentication inputs at their exact boundaries', () => {
    expect(() => normalizePhone('0100-not-e164')).toThrow();
    expect(() => normalizeEmail('not-an-email')).toThrow();
    expect(() => normalizeEmail(`aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa@example.com`)).toThrow();
    expect(() => assertPasswordPolicy('a'.repeat(129))).toThrow();
    expect(() => assertPasswordPolicy('😀'.repeat(129))).toThrow();
    expect(() => assertPasswordPolicy('safe-ok')).not.toThrow();
    expect(() => assertPasswordPolicy(`safe-${'x'.repeat(120)}`)).not.toThrow();
  });

  it('uses email as the only R1-P02 verification channel', () => {
    expect(blockingVerificationChannel('WORKER')).toBe('EMAIL');
    expect(blockingVerificationChannel('COMPANY')).toBe('EMAIL');
    expect(blockingVerificationChannel('ENGINEER')).toBe('EMAIL');
  });
  it('prohibits worker enrollment and derives pending categories', () => {
    expect(() => assertSelfSignupCategory('WORKER')).toThrow();
    expect(pendingCategories(['INDIVIDUAL', 'COMPANY'], ['INDIVIDUAL'])).toEqual(['COMPANY']);
  });
  it('selects actor-specific channels', () => {
    expect(blockingVerificationChannel('INDIVIDUAL')).toBe('EMAIL');
    expect(blockingVerificationChannel('PROVIDER_OWNER')).toBe('EMAIL');
    expect(recoveryChannel('WORKER')).toBe('EMAIL');
    expect(recoveryChannel('ENGINEER')).toBe('EMAIL');
  });
  it('keeps a verified category usable while another is pending', () => {
    expect(loginCapability({ id: 'u', phoneE164: '+201000000000', emailNormalized: 'u@example.com', accountCategories: ['INDIVIDUAL', 'COMPANY'], verifiedCategories: ['INDIVIDUAL'], status: 'ACTIVE', suspendedUntil: null, phoneVerifiedAt: new Date(), emailVerifiedAt: null })).toBe('FULL');
  });
  it('denies banned identities', () => {
    expect(() => loginCapability({ id: 'u', phoneE164: '+201000000000', emailNormalized: null, accountCategories: ['INDIVIDUAL'], verifiedCategories: ['INDIVIDUAL'], status: 'BANNED', suspendedUntil: null, phoneVerifiedAt: new Date(), emailVerifiedAt: null })).toThrow();
  });
});
