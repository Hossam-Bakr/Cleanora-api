import { startAuthenticationTestApp, uniqueIdentity } from '../../helpers/authentication/test-authentication-app.js';

const request = require('supertest') as typeof import('supertest');
const origin = 'http://localhost:5173';
vi.setConfig({ testTimeout: 90_000 });

function refreshCookie(response: import('supertest').Response): string {
  const values = response.headers['set-cookie'];
  const first = Array.isArray(values) ? values[0] : values;
  if (first === undefined) throw new Error('Expected refresh cookie');
  return first.split(';')[0]!;
}

async function verifiedIndividual(context: Awaited<ReturnType<typeof startAuthenticationTestApp>>) {
  const identity = uniqueIdentity('session');
  const signup = await request(context.app).post('/api/v1/auth/signup').send({ accountCategory: 'INDIVIDUAL', phone: identity.phone, email: identity.email, password: identity.password }).expect(202);
  await request(context.app).post('/api/v1/auth/otp/verify').send({ challengeId: signup.body.data.challengeId, code: context.sms.latest(identity.phone)!.value }).expect(200);
  return identity;
}

describe('login and session lifecycle', () => {
  it('serves me, rotates refresh once, detects reuse, and revokes the family', async () => {
    const context = await startAuthenticationTestApp();
    try {
      const identity = await verifiedIndividual(context);
      const login = await request(context.app).post('/api/v1/auth/login').send({ phone: identity.phone, password: identity.password }).expect(200);
      const access = login.body.data.accessToken as string;
      const oldCookie = refreshCookie(login);
      expect(login.body.data.user).toEqual({
        id: expect.any(String),
        displayName: null,
        avatarUrl: null,
        email: identity.email.toLowerCase(),
        phone: identity.phone,
        emailVerified: false,
        phoneVerified: true,
        status: 'ACTIVE',
        accountCategories: ['INDIVIDUAL'],
        verifiedCategories: ['INDIVIDUAL'],
        pendingCategories: [],
      });
      expect(login.body.data.identity.userId).toBe(login.body.data.user.id);
      const serializedLogin = JSON.stringify(login.body);
      expect(serializedLogin).not.toMatch(/passwordHash|refreshToken|otp|providerToken|credentialVersion/iu);

      const me = await request(context.app).get('/api/v1/auth/me').set('Authorization', `Bearer ${access}`).expect(200);
      expect(me.body.data).toEqual({
        user: login.body.data.user,
        verificationOnly: false,
      });

      const rotated = await request(context.app).post('/api/v1/auth/refresh').set('Origin', origin).set('Cookie', oldCookie).expect(200);
      expect(rotated.body.data.user).toEqual(login.body.data.user);
      const newCookie = refreshCookie(rotated);
      expect(newCookie).not.toBe(oldCookie);
      const replay = await request(context.app).post('/api/v1/auth/refresh').set('Origin', origin).set('Cookie', oldCookie).expect(401);
      expect(replay.body.error.code).toBe('AUTH_REFRESH_TOKEN_INVALID');
      await request(context.app).post('/api/v1/auth/refresh').set('Origin', origin).set('Cookie', newCookie).expect(401);
    } finally {
      await context.stop();
    }
  });

  it('logout revokes one session while logout-all revokes every remaining session', async () => {
    const context = await startAuthenticationTestApp();
    try {
      const identity = await verifiedIndividual(context);
      const first = await request(context.app).post('/api/v1/auth/login').send({ phone: identity.phone, password: identity.password }).expect(200);
      const second = await request(context.app).post('/api/v1/auth/login').send({ phone: identity.phone, password: identity.password }).expect(200);
      await request(context.app).post('/api/v1/auth/logout').set('Origin', origin).set('Authorization', `Bearer ${first.body.data.accessToken}`).set('Cookie', refreshCookie(first)).expect(200);
      await request(context.app).get('/api/v1/auth/me').set('Authorization', `Bearer ${first.body.data.accessToken}`).expect(401);
      await request(context.app).get('/api/v1/auth/me').set('Authorization', `Bearer ${second.body.data.accessToken}`).expect(200);
      await request(context.app).post('/api/v1/auth/logout-all').set('Authorization', `Bearer ${second.body.data.accessToken}`).expect(200);
      await request(context.app).get('/api/v1/auth/me').set('Authorization', `Bearer ${second.body.data.accessToken}`).expect(401);
    } finally {
      await context.stop();
    }
  });
});
