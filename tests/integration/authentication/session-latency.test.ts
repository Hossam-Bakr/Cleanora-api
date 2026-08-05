import { cpus, platform } from 'node:os';
import { performance } from 'node:perf_hooks';
import type { RequestHandler } from 'express';
import { createTestApp } from '../../helpers/create-test-app.js';
import { createAuthenticationRouter } from '../../../src/modules/authentication/auth.routes.js';
import type { AuthenticationService } from '../../../src/modules/authentication/auth.service.js';
import { createTestEnvironment } from '../../helpers/test-environment.js';
import { TestLogger } from '../../helpers/test-logger.js';

const request = require('supertest') as typeof import('supertest');

describe('deterministic session endpoint latency', () => {
  it('keeps at least 95 of 100 in-process samples within two seconds', async () => {
    const principal = { userId: 'latency-user', sessionId: 'latency-session', accountCategories: ['INDIVIDUAL'], verifiedCategories: ['INDIVIDUAL'], pendingCategories: [], status: 'ACTIVE', verificationOnly: false } as const;
    const user = { id: principal.userId, email: 'user@example.test', phone: '+201000000000', emailVerified: true, phoneVerified: true, status: 'ACTIVE', accountCategories: ['INDIVIDUAL'], verifiedCategories: ['INDIVIDUAL'], pendingCategories: [] } as const;
    const tokens = { accessToken: 'latency-access', accessExpiresAt: new Date(Date.now() + 60_000), refreshToken: 'latency-refresh', refreshExpiresAt: new Date(Date.now() + 120_000), verificationOnly: false, principal, user };
    const service = {
      endpointLimits: async () => ({ signupPer15Minutes: 1_000, loginPer15Minutes: 1_000 }),
      login: async () => tokens,
      refresh: async () => tokens,
      logout: async () => ({ loggedOut: true }),
      currentUser: async () => ({ user, verificationOnly: false })
    } as unknown as AuthenticationService;
    const authenticate: RequestHandler = (_request, response, next) => { response.locals['authenticationPrincipal'] = principal; next(); };
    const trusted: RequestHandler = (_request, _response, next) => next();
    const limiter = { consume: async () => ({ allowed: true, remaining: 999 }) };
    const router = createAuthenticationRouter({
      service,
      authenticateAccess: authenticate,
      trustedOrigin: trusted,
      cookies: { name: 'cleanora_refresh_token', path: '/api/v1/auth', secure: false, sameSite: 'lax' },
      limiter,
      privacyHashSecret: 'latency-privacy-secret',
      google: undefined,
      googleProviderCallbackUri: undefined,
      googleFrontendCallbackUri: undefined,
    });
    const app = createTestApp({
      environment: createTestEnvironment(),
      logger: new TestLogger(),
      rateLimiter: limiter,
      authenticationRouter: router,
    });
    const samples: Array<{ operation: string; milliseconds: number }> = [];
    const measure = async (operation: string, action: () => Promise<unknown>) => { const started = performance.now(); await action(); samples.push({ operation, milliseconds: performance.now() - started }); };

    for (let index = 0; index < 25; index += 1) {
      await measure('login', () => request(app).post('/api/v1/auth/login').send({ phone: '+201000000000', password: 'Correct-password-123!' }).expect(200));
      await measure('refresh', () => request(app).post('/api/v1/auth/refresh').set('Cookie', 'cleanora_refresh_token=latency-refresh').expect(200));
      await measure('logout', () => request(app).post('/api/v1/auth/logout').set('Authorization', 'Bearer latency-access').expect(200));
      await measure('me', () => request(app).get('/api/v1/auth/me').set('Authorization', 'Bearer latency-access').expect(200));
    }

    const ordered = samples.map((sample) => sample.milliseconds).sort((left, right) => left - right);
    const withinTarget = samples.filter((sample) => sample.milliseconds <= 2_000).length;
    const p95 = ordered[Math.ceil(ordered.length * 0.95) - 1]!;
    console.info('SC-014 deterministic latency', { samples: samples.length, withinTarget, p95Milliseconds: Number(p95.toFixed(2)), node: process.version, platform: platform(), cpu: cpus()[0]?.model ?? 'unknown' });
    expect(samples).toHaveLength(100);
    expect(withinTarget).toBeGreaterThanOrEqual(95);
  });
});
