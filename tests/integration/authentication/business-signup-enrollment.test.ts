import { startAuthenticationTestApp, uniqueIdentity } from '../../helpers/authentication/test-authentication-app.js';

const request = require('supertest') as typeof import('supertest');

// These journeys use real hashing and the isolated remote PostgreSQL target.
vi.setConfig({ testTimeout: 90_000 });

describe('business signup and category enrollment', () => {
  it.each(['COMPANY', 'ENGINEER', 'PROVIDER_OWNER'] as const)('activates %s only through its email OTP', async (accountCategory) => {
    const context = await startAuthenticationTestApp();
    const identity = uniqueIdentity(accountCategory.toLowerCase());
    try {
      const signup = await request(context.app).post('/api/v1/auth/signup').send({ accountCategory, phone: identity.phone, email: identity.email, password: identity.password }).expect(202);
      const delivery = context.email.latest(identity.email);
      expect(delivery?.idempotencyKey).toBe(signup.body.data.challengeId);
      expect(context.sms.all()).toHaveLength(0);

      await request(context.app).post('/api/v1/auth/otp/verify').send({ challengeId: signup.body.data.challengeId, code: delivery!.value }).expect(200);
      const user = await context.prisma.user.findUniqueOrThrow({ where: { emailNormalized: identity.email } });
      expect(user.verifiedCategories).toEqual([accountCategory]);
      expect(user.emailVerifiedAt).toBeInstanceOf(Date);
      expect(user.phoneVerifiedAt).toBeNull();
    } finally {
      await context.stop();
    }
  });

  it('enrolls an authenticated individual into a business category and verifies only the pending category', async () => {
    const context = await startAuthenticationTestApp();
    const identity = uniqueIdentity('enrollment');
    try {
      const signup = await request(context.app).post('/api/v1/auth/signup').send({ accountCategory: 'INDIVIDUAL', phone: identity.phone, email: identity.email, password: identity.password }).expect(202);
      await request(context.app).post('/api/v1/auth/otp/verify').send({ challengeId: signup.body.data.challengeId, code: context.sms.latest(identity.phone)!.value }).expect(200);
      const login = await request(context.app).post('/api/v1/auth/login').send({ phone: identity.phone, password: identity.password }).expect(200);

      const enrollment = await request(context.app).post('/api/v1/auth/account-categories').set('Authorization', `Bearer ${login.body.data.accessToken}`).send({ accountCategory: 'COMPANY' }).expect(202);
      const delivery = context.email.latest(identity.email);
      expect(delivery?.idempotencyKey).toBe(enrollment.body.data.challengeId);
      await request(context.app).post('/api/v1/auth/otp/verify').send({ challengeId: enrollment.body.data.challengeId, code: delivery!.value }).expect(200);

      const user = await context.prisma.user.findUniqueOrThrow({ where: { phoneE164: identity.phone } });
      expect(user.accountCategories).toEqual(['INDIVIDUAL', 'COMPANY']);
      expect(user.verifiedCategories).toEqual(['INDIVIDUAL', 'COMPANY']);
    } finally {
      await context.stop();
    }
  });
});
