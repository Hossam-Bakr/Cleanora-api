import { startAuthenticationTestApp, uniqueIdentity } from '../../helpers/authentication/test-authentication-app.js';

const request = require('supertest') as typeof import('supertest');
vi.setConfig({ testTimeout: 120_000 });

async function verifiedLogin(context: Awaited<ReturnType<typeof startAuthenticationTestApp>>, label: string) {
  const identity = uniqueIdentity(label);
  const signup = await request(context.app).post('/api/v1/auth/signup').send({ accountCategory: 'INDIVIDUAL', phone: identity.phone, password: identity.password }).expect(202);
  const code = context.sms.latest(identity.phone)!.value;
  await request(context.app).post('/api/v1/auth/otp/verify').send({ challengeId: signup.body.data.challengeId, code }).expect(200);
  const login = await request(context.app).post('/api/v1/auth/login').send({ phone: identity.phone, password: identity.password }).expect(200);
  return { identity, login, code };
}

describe('abuse, status, and secret safety', () => {
  it('denies active sessions and new login while suspended or banned, but honors suspension expiry', async () => {
    const context = await startAuthenticationTestApp();
    try {
      const fixture = await verifiedLogin(context, 'status');
      const user = await context.prisma.user.findUniqueOrThrow({ where: { phoneE164: fixture.identity.phone } });
      await context.prisma.user.update({ where: { id: user.id }, data: { status: 'SUSPENDED', suspendedUntil: new Date(Date.now() + 60_000), statusChangedAt: new Date() } });
      await request(context.app).post('/api/v1/auth/login').send({ phone: fixture.identity.phone, password: fixture.identity.password }).expect(401);
      await request(context.app).get('/api/v1/auth/me').set('Authorization', `Bearer ${fixture.login.body.data.accessToken}`).expect(401);

      await context.prisma.user.update({ where: { id: user.id }, data: { suspendedUntil: new Date(Date.now() - 1_000), statusChangedAt: new Date() } });
      await request(context.app).post('/api/v1/auth/login').send({ phone: fixture.identity.phone, password: fixture.identity.password }).expect(200);
      await context.prisma.user.update({ where: { id: user.id }, data: { status: 'BANNED', suspendedUntil: null, statusChangedAt: new Date() } });
      await request(context.app).post('/api/v1/auth/login').send({ phone: fixture.identity.phone, password: fixture.identity.password }).expect(401);
    } finally {
      await context.stop();
    }
  });

  it('stores privacy hashes and never persists raw passwords, OTPs, or identifiers in events and audits', async () => {
    const context = await startAuthenticationTestApp();
    try {
      const fixture = await verifiedLogin(context, 'secret-scan');
      await request(context.app).post('/api/v1/auth/login').send({ phone: fixture.identity.phone, password: 'Wrong-password-123!' }).expect(401);
      const user = await context.prisma.user.findUniqueOrThrow({ where: { phoneE164: fixture.identity.phone } });
      const events = await context.prisma.authEvent.findMany({ where: { userId: user.id } });
      const audits = await context.prisma.auditLog.findMany({ where: { actorId: user.id } });
      const persisted = JSON.stringify({ events, audits });
      for (const secret of [fixture.identity.phone, fixture.identity.password, 'Wrong-password-123!', fixture.code]) expect(persisted).not.toContain(secret);
      expect(events.some((event) => event.identifierHash !== null)).toBe(true);
    } finally {
      await context.stop();
    }
  });
});
