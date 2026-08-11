import { startAuthenticationTestApp, uniqueIdentity } from '../../helpers/authentication/test-authentication-app.js';

const request = require('supertest') as typeof import('supertest');

// These journeys use real hashing and the isolated remote PostgreSQL target.
vi.setConfig({ testTimeout: 90_000 });

describe('business signup and category enrollment', () => {
  it.each(['COMPANY', 'ENGINEER'] as const)('activates %s only through its email OTP', async (accountCategory) => {
    const context = await startAuthenticationTestApp();
    const identity = uniqueIdentity(accountCategory.toLowerCase());
    try {
      const profile = accountCategory === 'COMPANY'
        ? { companyName: 'Clean Business', representativeFullName: 'Business Representative' }
        : { fullName: 'Design Engineer', professionalTitle: 'Senior Civil Engineer' };
      const signup = await request(context.app).post('/api/v1/auth/signup').send({ accountCategory, ...profile, phone: identity.phone, email: identity.email, password: identity.password }).expect(202);
      const delivery = context.email.latest(identity.email);
      expect(delivery?.idempotencyKey).toBe(signup.body.data.challengeId);

      await request(context.app).post('/api/v1/auth/otp/verify').send({ challengeId: signup.body.data.challengeId, code: delivery!.value }).expect(200);
      const user = await context.prisma.user.findUniqueOrThrow({ where: { emailNormalized: identity.email } });
      expect(user.verifiedCategories).toEqual([accountCategory]);
      expect(user.emailVerifiedAt).toBeInstanceOf(Date);
      expect(user.phoneVerifiedAt).toBeNull();
      if (accountCategory === 'COMPANY') {
        await expect(context.prisma.companyProfile.findUniqueOrThrow({ where: { userId: user.id } })).resolves.toMatchObject({
          companyName: 'Clean Business',
          representativeFullName: 'Business Representative',
          commercialRegistrationNumber: null,
          taxRegistrationNumber: null,
        });
      }
      if (accountCategory === 'ENGINEER') {
        await expect(context.prisma.engineerProfile.findUniqueOrThrow({ where: { userId: user.id } })).resolves.toMatchObject({
          fullName: 'Design Engineer',
          professionalTitle: 'Senior Civil Engineer',
        });
      }
    } finally {
      await context.stop();
    }
  });

  it('rejects PROVIDER_OWNER public self-signup at the Zod boundary', async () => {
    const context = await startAuthenticationTestApp();
    const identity = uniqueIdentity('provider-owner');
    try {
      const signup = await request(context.app)
        .post('/api/v1/auth/signup')
        .send({
          accountCategory: 'PROVIDER_OWNER',
          phone: identity.phone,
          email: identity.email,
          password: identity.password,
        })
        .expect(400);
      expect(signup.body.success).toBe(false);
      expect(signup.body.error.code).toMatch(/VALIDATION|BAD_REQUEST|AUTH_/i);
    } finally {
      await context.stop();
    }
  });

  it('enrolls an authenticated individual into a business category and verifies only the pending category', async () => {
    const context = await startAuthenticationTestApp();
    const identity = uniqueIdentity('enrollment');
    try {
      const signup = await request(context.app).post('/api/v1/auth/signup').send({ accountCategory: 'INDIVIDUAL', fullName: 'Enrollment Customer', phone: identity.phone, email: identity.email, password: identity.password }).expect(202);
      await request(context.app).post('/api/v1/auth/otp/verify').send({ challengeId: signup.body.data.challengeId, code: context.email.latest(identity.email)!.value }).expect(200);
      const login = await request(context.app).post('/api/v1/auth/login').send({ phone: identity.phone, password: identity.password }).expect(200);

      const enrollment = await request(context.app).post('/api/v1/auth/account-categories').set('Authorization', `Bearer ${login.body.data.accessToken}`).send({ accountCategory: 'COMPANY', companyName: 'Enrolled Company', representativeFullName: 'Enrolled Representative' }).expect(202);
      const delivery = context.email.latest(identity.email);
      expect(delivery?.idempotencyKey).toBe(enrollment.body.data.challengeId);
      await request(context.app).post('/api/v1/auth/otp/verify').send({ challengeId: enrollment.body.data.challengeId, code: delivery!.value }).expect(200);

      const user = await context.prisma.user.findUniqueOrThrow({ where: { phoneE164: identity.phone } });
      expect(user.accountCategories).toEqual(['INDIVIDUAL', 'COMPANY']);
      expect(user.verifiedCategories).toEqual(['INDIVIDUAL', 'COMPANY']);
      await expect(context.prisma.companyProfile.findUniqueOrThrow({
        where: { userId: user.id },
      })).resolves.toMatchObject({
        companyName: 'Enrolled Company',
        representativeFullName: 'Enrolled Representative',
        commercialRegistrationNumber: null,
        taxRegistrationNumber: null,
      });
    } finally {
      await context.stop();
    }
  });

});
