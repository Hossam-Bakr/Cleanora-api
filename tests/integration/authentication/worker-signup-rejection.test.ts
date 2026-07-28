import { startAuthenticationTestApp } from '../../helpers/authentication/test-authentication-app.js';
import { provisionWorker } from '../../helpers/authentication/worker-fixture.js';

const request = require('supertest') as typeof import('supertest');
vi.setConfig({ testTimeout: 60_000 });

describe('provider-created worker boundary', () => {
  it('allows controlled worker login while every public enrollment path rejects WORKER', async () => {
    const context = await startAuthenticationTestApp();
    try {
      const worker = await provisionWorker(context.prisma);
      const login = await request(context.app).post('/api/v1/auth/login').send({ phone: worker.phone, password: worker.password }).expect(200);
      expect(login.body.data.identity.accountCategories).toEqual(['WORKER']);
      await request(context.app).get('/api/v1/auth/me').set('Authorization', `Bearer ${login.body.data.accessToken}`).expect(200);

      await request(context.app).post('/api/v1/auth/signup').send({ accountCategory: 'WORKER', phone: '+2021111111111', password: worker.password }).expect(400);
      await request(context.app).post('/api/v1/auth/account-categories').set('Authorization', `Bearer ${login.body.data.accessToken}`).send({ accountCategory: 'WORKER' }).expect(400);
      await request(context.app).post('/api/v1/auth/otp/request').send({ userId: worker.user.id, accountCategory: 'WORKER' }).expect(400);
      expect(await context.prisma.user.count({ where: { accountCategories: { has: 'WORKER' } } })).toBeGreaterThanOrEqual(1);
      expect(await context.prisma.user.count({ where: { phoneE164: '+2021111111111' } })).toBe(0);
    } finally {
      await context.stop();
    }
  });
});
