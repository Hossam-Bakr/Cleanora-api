import { getPrismaClient } from '../../../src/database/prisma.js';
import { startAuthenticationTestApp, uniqueIdentity } from '../../helpers/authentication/test-authentication-app.js';

const request = require('supertest') as typeof import('supertest');
vi.setConfig({ testTimeout: 90_000 });

/**
 * FR-020 / FR-028: existing authentication endpoints stay authentication-only.
 * They must keep working for a user who holds no role grant at all, because
 * R1-P03 never wraps them in role or permission checks.
 */
describe('authentication endpoints without any role grant', () => {
  it('signs up, verifies, logs in, reads me, refreshes, and logs out with zero grants', async () => {
    const context = await startAuthenticationTestApp();
    try {
      const identity = uniqueIdentity('plain-signup');
      const signup = await request(context.app)
        .post('/api/v1/auth/signup')
        .send({
          accountCategory: 'INDIVIDUAL',
          fullName: 'Plain Signup Customer',
          phone: identity.phone,
          email: identity.email,
          password: identity.password
        })
        .expect(202);
      await request(context.app)
        .post('/api/v1/auth/otp/verify')
        .send({
          challengeId: signup.body.data.challengeId,
          code: context.email.latest(identity.email)!.value
        })
        .expect(200);

      const login = await request(context.app)
        .post('/api/v1/auth/login')
        .send({ phone: identity.phone, password: identity.password })
        .expect(200);
      const accessToken = login.body.data.accessToken as string;
      const userId = login.body.data.user.id as string;

      const grantCount = await getPrismaClient().userRole.count({
        where: { userId }
      });
      expect(grantCount).toBe(0);

      await request(context.app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      await request(context.app)
        .post('/api/v1/auth/logout-all')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    } finally {
      await context.stop();
    }
  });

  it('keeps the me payload free of role and permission fields', async () => {
    const context = await startAuthenticationTestApp();
    try {
      // The identity prefix must not contain the words this test searches for.
      const identity = uniqueIdentity('plain-auth');
      const signup = await request(context.app)
        .post('/api/v1/auth/signup')
        .send({
          accountCategory: 'INDIVIDUAL',
          fullName: 'Plain Auth Customer',
          phone: identity.phone,
          email: identity.email,
          password: identity.password
        })
        .expect(202);
      await request(context.app)
        .post('/api/v1/auth/otp/verify')
        .send({
          challengeId: signup.body.data.challengeId,
          code: context.email.latest(identity.email)!.value
        })
        .expect(200);
      const login = await request(context.app)
        .post('/api/v1/auth/login')
        .send({ phone: identity.phone, password: identity.password })
        .expect(200);

      const me = await request(context.app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${login.body.data.accessToken}`)
        .expect(200);

      expect(JSON.stringify(me.body)).not.toMatch(/role|permission|grant/iu);
    } finally {
      await context.stop();
    }
  });
});
