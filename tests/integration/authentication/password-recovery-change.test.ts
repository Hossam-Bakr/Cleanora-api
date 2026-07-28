import { startAuthenticationTestApp, uniqueIdentity } from '../../helpers/authentication/test-authentication-app.js';

const request = require('supertest') as typeof import('supertest');
const origin = 'http://localhost:5173';
vi.setConfig({ testTimeout: 120_000 });

function cookie(response: import('supertest').Response): string {
  const values = response.headers['set-cookie'];
  const first = Array.isArray(values) ? values[0] : values;
  if (first === undefined) throw new Error('Expected refresh cookie');
  return first.split(';')[0]!;
}

async function createVerified(context: Awaited<ReturnType<typeof startAuthenticationTestApp>>, label: string) {
  const identity = uniqueIdentity(label);
  const signup = await request(context.app).post('/api/v1/auth/signup').send({ accountCategory: 'INDIVIDUAL', phone: identity.phone, password: identity.password }).expect(202);
  await request(context.app).post('/api/v1/auth/otp/verify').send({ challengeId: signup.body.data.challengeId, code: context.sms.latest(identity.phone)!.value }).expect(200);
  return identity;
}

describe('password recovery and authenticated change', () => {
  it('keeps forgot enumeration-safe and reset consumes once, revokes all, and creates no session', async () => {
    const context = await startAuthenticationTestApp();
    try {
      const identity = await createVerified(context, 'reset');
      const first = await request(context.app).post('/api/v1/auth/login').send({ phone: identity.phone, password: identity.password }).expect(200);
      const second = await request(context.app).post('/api/v1/auth/login').send({ phone: identity.phone, password: identity.password }).expect(200);
      const unknown = await request(context.app).post('/api/v1/auth/password/forgot').send({ accountCategory: 'INDIVIDUAL', identifier: '+201999999999' }).expect(202);
      const known = await request(context.app).post('/api/v1/auth/password/forgot').send({ accountCategory: 'INDIVIDUAL', identifier: identity.phone }).expect(202);
      expect(unknown.body.data).toEqual(known.body.data);

      const token = context.sms.latest(identity.phone)!.value;
      const nextPassword = 'Different-password-456!';
      const reset = await request(context.app).post('/api/v1/auth/password/reset').send({ token, newPassword: nextPassword }).expect(200);
      expect(reset.body.data).toEqual({ passwordReset: true, nextAction: 'LOGIN' });
      expect(reset.headers['set-cookie']).toBeUndefined();
      await request(context.app).post('/api/v1/auth/password/reset').send({ token, newPassword: 'Another-password-789!' }).expect(400);
      await request(context.app).get('/api/v1/auth/me').set('Authorization', `Bearer ${first.body.data.accessToken}`).expect(401);
      await request(context.app).get('/api/v1/auth/me').set('Authorization', `Bearer ${second.body.data.accessToken}`).expect(401);
      await request(context.app).post('/api/v1/auth/login').send({ phone: identity.phone, password: identity.password }).expect(401);
      await request(context.app).post('/api/v1/auth/login').send({ phone: identity.phone, password: nextPassword }).expect(200);
    } finally {
      await context.stop();
    }
  });

  it('change-password revokes other sessions and rotates the current session', async () => {
    const context = await startAuthenticationTestApp();
    try {
      const identity = await createVerified(context, 'change');
      const current = await request(context.app).post('/api/v1/auth/login').send({ phone: identity.phone, password: identity.password }).expect(200);
      const other = await request(context.app).post('/api/v1/auth/login').send({ phone: identity.phone, password: identity.password }).expect(200);
      const nextPassword = 'Rotated-password-456!';
      const changed = await request(context.app).post('/api/v1/auth/password/change').set('Origin', origin).set('Authorization', `Bearer ${current.body.data.accessToken}`).set('Cookie', cookie(current)).send({ currentPassword: identity.password, newPassword: nextPassword }).expect(200);
      expect(cookie(changed)).not.toBe(cookie(current));
      await request(context.app).get('/api/v1/auth/me').set('Authorization', `Bearer ${current.body.data.accessToken}`).expect(401);
      await request(context.app).get('/api/v1/auth/me').set('Authorization', `Bearer ${other.body.data.accessToken}`).expect(401);
      await request(context.app).get('/api/v1/auth/me').set('Authorization', `Bearer ${changed.body.data.accessToken}`).expect(200);
      await request(context.app).post('/api/v1/auth/login').send({ phone: identity.phone, password: identity.password }).expect(401);
      await request(context.app).post('/api/v1/auth/login').send({ phone: identity.phone, password: nextPassword }).expect(200);
    } finally {
      await context.stop();
    }
  });
});
