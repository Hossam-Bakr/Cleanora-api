import { otpRequestSchema } from '../../../../src/modules/authentication/http/authentication.schemas.js';
import { assertVerificationChallengeTarget, verificationTarget } from '../../../../src/modules/authentication/domain/verification-eligibility.policy.js';
import type { IdentityState } from '../../../../src/modules/authentication/domain/authentication.types.js';

const pendingIndividual: IdentityState = { id: 'user-1', phoneE164: '+201000000000', emailNormalized: 'user@example.test', accountCategories: ['INDIVIDUAL'], verifiedCategories: [], status: 'ACTIVE', suspendedUntil: null, phoneVerifiedAt: null, emailVerifiedAt: null };
const pendingCompany: IdentityState = { ...pendingIndividual, accountCategories: ['COMPANY'], phoneVerifiedAt: null };

describe('OTP category and enrollment integrity', () => {
  it('rejects WORKER and unsupported categories at the public request boundary', () => {
    expect(otpRequestSchema.safeParse({ body: { userId: 'user-1', accountCategory: 'WORKER' } }).success).toBe(false);
    expect(otpRequestSchema.safeParse({ body: { userId: 'user-1', accountCategory: 'ADMIN' } }).success).toBe(false);
  });

  it('accepts challengeId alone or userId with accountCategory', () => {
    expect(otpRequestSchema.safeParse({ body: { challengeId: 'challenge-1' } }).success).toBe(true);
    expect(otpRequestSchema.safeParse({ body: { userId: 'user-1', accountCategory: 'INDIVIDUAL' } }).success).toBe(true);
    expect(otpRequestSchema.safeParse({ body: { userId: 'user-1' } }).success).toBe(false);
    expect(otpRequestSchema.safeParse({ body: {} }).success).toBe(false);
  });

  it('rejects unenrolled and worker verification targets', () => {
    expect(() => verificationTarget(pendingIndividual, 'COMPANY', 'CATEGORY_VERIFICATION')).toThrow();
    expect(() => verificationTarget({ ...pendingIndividual, accountCategories: ['WORKER'] }, 'WORKER', 'CATEGORY_VERIFICATION')).toThrow();
  });

  it('derives individual phone and business email targets from stored state', () => {
    expect(verificationTarget(pendingIndividual, 'INDIVIDUAL', 'CATEGORY_VERIFICATION')).toMatchObject({ channel: 'SMS', destination: pendingIndividual.phoneE164 });
    expect(verificationTarget(pendingCompany, 'COMPANY', 'CATEGORY_VERIFICATION')).toMatchObject({ channel: 'EMAIL', destination: pendingCompany.emailNormalized });
  });

  it('allows optional individual email only after mandatory phone verification', () => {
    expect(() => verificationTarget(pendingIndividual, 'INDIVIDUAL', 'OPTIONAL_INDIVIDUAL_EMAIL_VERIFICATION')).toThrow();
    expect(verificationTarget({ ...pendingIndividual, verifiedCategories: ['INDIVIDUAL'], phoneVerifiedAt: new Date() }, 'INDIVIDUAL', 'OPTIONAL_INDIVIDUAL_EMAIL_VERIFICATION')).toMatchObject({ channel: 'EMAIL' });
  });

  it('rejects verification when stored enrollment state has no eligible destination or transition', () => {
    expect(() => verificationTarget(
      { ...pendingIndividual, verifiedCategories: ['INDIVIDUAL'] },
      'INDIVIDUAL',
      'CATEGORY_VERIFICATION'
    )).toThrow();
    expect(() => verificationTarget(
      { ...pendingIndividual, phoneE164: null },
      'INDIVIDUAL',
      'CATEGORY_VERIFICATION'
    )).toThrow();
    expect(() => verificationTarget(
      { ...pendingCompany, emailNormalized: null },
      'COMPANY',
      'CATEGORY_VERIFICATION'
    )).toThrow();
  });

  it('rejects unsupported or redundant optional individual email challenges', () => {
    const verifiedPhone = { ...pendingIndividual, verifiedCategories: ['INDIVIDUAL'] as const, phoneVerifiedAt: new Date() };
    expect(() => verificationTarget(
      { ...pendingCompany, phoneVerifiedAt: new Date() },
      'COMPANY',
      'OPTIONAL_INDIVIDUAL_EMAIL_VERIFICATION'
    )).toThrow();
    expect(() => verificationTarget(
      { ...verifiedPhone, emailNormalized: null },
      'INDIVIDUAL',
      'OPTIONAL_INDIVIDUAL_EMAIL_VERIFICATION'
    )).toThrow();
    expect(() => verificationTarget(
      { ...verifiedPhone, emailVerifiedAt: new Date() },
      'INDIVIDUAL',
      'OPTIONAL_INDIVIDUAL_EMAIL_VERIFICATION'
    )).toThrow();
  });

  it.each([
    { userId: 'other-user', accountCategory: 'INDIVIDUAL', purpose: 'CATEGORY_VERIFICATION', channel: 'SMS', destinationHash: 'phone-hash' },
    { userId: 'user-1', accountCategory: 'COMPANY', purpose: 'CATEGORY_VERIFICATION', channel: 'SMS', destinationHash: 'phone-hash' },
    { userId: 'user-1', accountCategory: 'INDIVIDUAL', purpose: 'OPTIONAL_INDIVIDUAL_EMAIL_VERIFICATION', channel: 'SMS', destinationHash: 'phone-hash' },
    { userId: 'user-1', accountCategory: 'INDIVIDUAL', purpose: 'CATEGORY_VERIFICATION', channel: 'EMAIL', destinationHash: 'phone-hash' },
    { userId: 'user-1', accountCategory: 'INDIVIDUAL', purpose: 'CATEGORY_VERIFICATION', channel: 'SMS', destinationHash: 'other-destination' }
  ] as const)('rejects a challenge rebound to another target %#', (challenge) => {
    const target = verificationTarget(pendingIndividual, 'INDIVIDUAL', 'CATEGORY_VERIFICATION');
    expect(() => assertVerificationChallengeTarget(target, challenge, 'phone-hash')).toThrow();
  });

  it('accepts a challenge bound to the exact verification target', () => {
    const target = verificationTarget(pendingIndividual, 'INDIVIDUAL', 'CATEGORY_VERIFICATION');
    expect(() =>
      assertVerificationChallengeTarget(
        target,
        {
          userId: 'user-1',
          accountCategory: 'INDIVIDUAL',
          purpose: 'CATEGORY_VERIFICATION',
          channel: 'SMS',
          destinationHash: 'phone-hash',
        },
        'phone-hash',
      ),
    ).not.toThrow();
  });
});
