import { startAuthenticationTestApp, uniqueIdentity } from '../../helpers/authentication/test-authentication-app.js';

const request = require('supertest') as typeof import('supertest');
vi.setConfig({ testTimeout: 120_000 });

function assertRace(
  responses: readonly import('supertest').Response[],
  expectedCode: 'AUTH_PHONE_ALREADY_REGISTERED' | 'AUTH_EMAIL_ALREADY_REGISTERED',
) {
  expect(responses.map((response) => response.status).sort()).toEqual([202, 409]);
  const loser = responses.find((response) => response.status === 409)!;
  expect(loser.body.error).toMatchObject({
    code: expectedCode,
    statusCode: 409,
  });
}

describe('normalized signup uniqueness races', () => {
  it('allows exactly one normalized phone winner and leaves one credential', async () => {
    const context = await startAuthenticationTestApp();
    const identity = uniqueIdentity('phone-race');
    const formatted = `${identity.phone.slice(0, 4)} (${identity.phone.slice(4, 7)}) ${identity.phone.slice(7)}`;
    try {
      const responses = await Promise.all([
        request(context.app).post('/api/v1/auth/signup').send({ accountCategory: 'INDIVIDUAL', phone: identity.phone, email: identity.email, password: identity.password }),
        request(context.app).post('/api/v1/auth/signup').send({ accountCategory: 'INDIVIDUAL', phone: formatted, email: `other-${identity.email}`, password: identity.password })
      ]);
      assertRace(responses, 'AUTH_PHONE_ALREADY_REGISTERED');
      const users = await context.prisma.user.findMany({ where: { phoneE164: identity.phone }, select: { id: true } });
      expect(users).toHaveLength(1);
      expect(await context.prisma.userCredential.count({ where: { userId: users[0]!.id } })).toBe(1);
    } finally {
      await context.stop();
    }
  });

  it('allows exactly one normalized email winner and leaves one credential', async () => {
    const context = await startAuthenticationTestApp();
    const first = uniqueIdentity('email-race');
    const second = uniqueIdentity('email-race-other');
    const variant = `  ${first.email.toUpperCase()}  `;
    try {
      const responses = await Promise.all([
        request(context.app).post('/api/v1/auth/signup').send({ accountCategory: 'COMPANY', phone: first.phone, email: first.email, password: first.password }),
        request(context.app).post('/api/v1/auth/signup').send({ accountCategory: 'COMPANY', phone: second.phone, email: variant, password: second.password })
      ]);
      assertRace(responses, 'AUTH_EMAIL_ALREADY_REGISTERED');
      const users = await context.prisma.user.findMany({ where: { emailNormalized: first.email }, select: { id: true } });
      expect(users).toHaveLength(1);
      expect(await context.prisma.userCredential.count({ where: { userId: users[0]!.id } })).toBe(1);
    } finally {
      await context.stop();
    }
  });
});
