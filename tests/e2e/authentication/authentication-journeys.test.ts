import { startAuthenticationTestApp, uniqueIdentity } from '../../helpers/authentication/test-authentication-app.js';

const request = require('supertest') as typeof import('supertest');
const origin = 'http://localhost:5173';
vi.setConfig({ testTimeout: 180_000 });

function cookie(response: import('supertest').Response): string {
  const values = response.headers['set-cookie'];
  const first = Array.isArray(values) ? values[0] : values;
  if (first === undefined) throw new Error('Expected cookie');
  return first.split(';')[0]!;
}

async function signupAndVerify(context: Awaited<ReturnType<typeof startAuthenticationTestApp>>, category: 'INDIVIDUAL' | 'COMPANY', label: string) {
  const identity = uniqueIdentity(label);
  const signup = await request(context.app).post('/api/v1/auth/signup').send({ accountCategory: category, phone: identity.phone, email: identity.email, password: identity.password }).expect(202);
  const delivery = context.email.latest(identity.email);
  await request(context.app).post('/api/v1/auth/otp/verify').send({ challengeId: signup.body.data.challengeId, code: delivery!.value }).expect(200);
  return identity;
}

describe('R1-P02 end-to-end authentication journeys', () => {
  it('completes individual signup through mandatory email verification', async () => {
    const context = await startAuthenticationTestApp();
    try { const identity = await signupAndVerify(context, 'INDIVIDUAL', 'e2e-individual'); await request(context.app).post('/api/v1/auth/login').send({ phone: identity.phone, password: identity.password }).expect(200); }
    finally { await context.stop(); }
  });

  it('completes business signup through mandatory email activation', async () => {
    const context = await startAuthenticationTestApp();
    try { const identity = await signupAndVerify(context, 'COMPANY', 'e2e-company'); const user = await context.prisma.user.findUniqueOrThrow({ where: { emailNormalized: identity.email } }); expect(user.verifiedCategories).toEqual(['COMPANY']); }
    finally { await context.stop(); }
  });

  it('logs in, rotates refresh, serves me, and logs out', async () => {
    const context = await startAuthenticationTestApp();
    try { const identity = await signupAndVerify(context, 'INDIVIDUAL', 'e2e-session'); const login = await request(context.app).post('/api/v1/auth/login').send({ phone: identity.phone, password: identity.password }).expect(200); const refresh = await request(context.app).post('/api/v1/auth/refresh').set('Origin', origin).set('Cookie', cookie(login)).expect(200); await request(context.app).get('/api/v1/auth/me').set('Authorization', `Bearer ${refresh.body.data.accessToken}`).expect(200); await request(context.app).post('/api/v1/auth/logout').set('Origin', origin).set('Cookie', cookie(refresh)).set('Authorization', `Bearer ${refresh.body.data.accessToken}`).expect(200); }
    finally { await context.stop(); }
  });

  it('changes a known password and completes forgotten-password recovery', async () => {
    const context = await startAuthenticationTestApp();
    try { const identity = await signupAndVerify(context, 'INDIVIDUAL', 'e2e-recovery'); const login = await request(context.app).post('/api/v1/auth/login').send({ phone: identity.phone, password: identity.password }).expect(200); const changedPassword = 'Changed-e2e-password-456!'; await request(context.app).post('/api/v1/auth/password/change').set('Origin', origin).set('Cookie', cookie(login)).set('Authorization', `Bearer ${login.body.data.accessToken}`).send({ currentPassword: identity.password, newPassword: changedPassword }).expect(200); const forgot = await request(context.app).post('/api/v1/auth/password/forgot').send({ accountCategory: 'INDIVIDUAL', identifier: identity.email }).expect(202); const resetPassword = 'Reset-e2e-password-789!'; await request(context.app).post('/api/v1/auth/password/reset').send({ challengeId: forgot.body.data.challengeId, code: context.email.latest(identity.email)!.value, newPassword: resetPassword }).expect(200); await request(context.app).post('/api/v1/auth/login').send({ phone: identity.phone, password: resetPassword }).expect(200); }
    finally { await context.stop(); }
  });

  it('completes Google sign-in from verified email without claiming phone ownership', async () => {
    const context = await startAuthenticationTestApp(); const agent = request.agent(context.app); const identity = uniqueIdentity('e2e-google'); context.google.program({ subject: `e2e-${identity.email}`, email: identity.email, emailVerified: true });
    try { const start = await agent.get('/api/v1/auth/google').expect(200); const state = new URL(start.body.data.authorizationUrl).searchParams.get('state')!; const callback = await agent.get('/api/v1/auth/google/callback').query({ state, code: 'fake' }).expect(303); expect(callback.headers['location']).toContain('verification=complete'); const session = await agent.post('/api/v1/auth/refresh').set('Origin', origin).expect(200); expect(session.body.data.verificationOnly).toBe(false); const access = session.body.data.accessToken as string; const me = await agent.get('/api/v1/auth/me').set('Authorization', `Bearer ${access}`).expect(200); expect(me.body.data).toMatchObject({ verificationOnly: false, user: { emailVerified: true, phoneVerified: false } }); }
    finally { await context.stop(); }
  });

  it('denies suspended and banned identities at login and protected requests', async () => {
    const context = await startAuthenticationTestApp();
    try { const identity = await signupAndVerify(context, 'INDIVIDUAL', 'e2e-status'); const login = await request(context.app).post('/api/v1/auth/login').send({ phone: identity.phone, password: identity.password }).expect(200); const user = await context.prisma.user.findUniqueOrThrow({ where: { phoneE164: identity.phone } }); await context.prisma.user.update({ where: { id: user.id }, data: { status: 'SUSPENDED', suspendedUntil: new Date(Date.now() + 60_000) } }); await request(context.app).get('/api/v1/auth/me').set('Authorization', `Bearer ${login.body.data.accessToken}`).expect(401); await context.prisma.user.update({ where: { id: user.id }, data: { status: 'BANNED', suspendedUntil: null } }); await request(context.app).post('/api/v1/auth/login').send({ phone: identity.phone, password: identity.password }).expect(401); }
    finally { await context.stop(); }
  });
});
