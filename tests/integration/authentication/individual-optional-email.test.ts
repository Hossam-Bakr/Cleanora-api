import { startAuthenticationTestApp, uniqueIdentity } from '../../helpers/authentication/test-authentication-app.js';

const request = require('supertest') as typeof import('supertest');
vi.setConfig({ testTimeout: 90_000 });

describe('optional individual email verification', () => {
  it('remains non-blocking after mandatory phone verification and cannot replace that gate', async () => {
    const context = await startAuthenticationTestApp();
    const identity = uniqueIdentity('optional-email');
    try {
      const signup = await request(context.app).post('/api/v1/auth/signup').send({ accountCategory: 'INDIVIDUAL', phone: identity.phone, email: identity.email, password: identity.password }).expect(202);
      const user = await context.prisma.user.findUniqueOrThrow({ where: { phoneE164: identity.phone } });
      await request(context.app).post('/api/v1/auth/otp/request').send({ userId: user.id, accountCategory: 'INDIVIDUAL', purpose: 'OPTIONAL_INDIVIDUAL_EMAIL_VERIFICATION' }).expect(400);
      expect(context.email.all()).toHaveLength(0);

      const pendingLogin = await request(context.app).post('/api/v1/auth/login').send({ phone: identity.phone, password: identity.password }).expect(200);
      expect(pendingLogin.body.data.verificationOnly).toBe(true);
      await request(context.app).post('/api/v1/auth/account-categories').set('Authorization', `Bearer ${pendingLogin.body.data.accessToken}`).send({ accountCategory: 'COMPANY' }).expect(403);

      await request(context.app).post('/api/v1/auth/otp/verify').send({ challengeId: signup.body.data.challengeId, code: context.sms.latest(identity.phone)!.value }).expect(200);
      const fullLogin = await request(context.app).post('/api/v1/auth/login').send({ phone: identity.phone, password: identity.password }).expect(200);
      expect(fullLogin.body.data.verificationOnly).toBe(false);
      const before = await request(context.app).get('/api/v1/auth/me').set('Authorization', `Bearer ${fullLogin.body.data.accessToken}`).expect(200);
      expect(before.body.data).toMatchObject({
        verificationOnly: false,
        user: {
          phoneVerified: true,
          emailVerified: false,
          displayName: null,
          avatarUrl: null,
        },
      });

      const optional = await request(context.app).post('/api/v1/auth/otp/request').send({ userId: user.id, accountCategory: 'INDIVIDUAL', purpose: 'OPTIONAL_INDIVIDUAL_EMAIL_VERIFICATION' }).expect(202);
      const email = context.email.latest(identity.email);
      expect(email?.idempotencyKey).toBe(optional.body.data.challengeId);
      await request(context.app).post('/api/v1/auth/otp/verify').send({ challengeId: optional.body.data.challengeId, code: email!.value }).expect(200);
      const after = await request(context.app).get('/api/v1/auth/me').set('Authorization', `Bearer ${fullLogin.body.data.accessToken}`).expect(200);
      expect(after.body.data).toMatchObject({
        verificationOnly: false,
        user: {
          phoneVerified: true,
          emailVerified: true,
          displayName: null,
          avatarUrl: null,
        },
      });
    } finally {
      await context.stop();
    }
  });
});
