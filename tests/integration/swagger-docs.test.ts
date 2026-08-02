import { createApp } from '../../src/app.js';
import { cleanoraOpenApiDocument } from '../../src/swagger/openapi.document.js';
import { createTestEnvironment } from '../helpers/test-environment.js';
import { TestLogger } from '../helpers/test-logger.js';

const request = require('supertest') as typeof import('supertest');

describe('Swagger API documentation', () => {
  const app = createApp({
    environment: createTestEnvironment(),
    logger: new TestLogger(),
  });

  it('serves the professional interactive documentation page', async () => {
    const response = await request(app).get('/api/v1/docs').expect(200);

    expect(response.headers['content-type']).toContain('text/html');
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['content-security-policy']).toContain(
      'https://unpkg.com',
    );
    expect(response.headers['content-security-policy']).toContain(
      "'nonce-",
    );
    expect(response.text).toMatch(/<script nonce="[^"]+">/);
    expect(response.text).toContain('Cleanora API Documentation');
    expect(response.text).toContain('/api/v1/docs/openapi.json');
  });

  it('serves the complete machine-readable OpenAPI document', async () => {
    const response = await request(app)
      .get('/api/v1/docs/openapi.json')
      .expect(200);

    expect(response.headers['content-type']).toContain('application/json');
    expect(response.headers['cache-control']).toBe('public, max-age=300');
    expect(response.body).toEqual(cleanoraOpenApiDocument);
    expect(response.body.paths).toHaveProperty('/auth/signup');
    expect(response.body.paths).toHaveProperty('/auth/password/reset');
    expect(response.body.servers[0].url).toBe(
      'https://cleanora-production.up.railway.app/api/v1',
    );
    expect(
      response.body.components.schemas.ResetPasswordRequest.required,
    ).toEqual(['challengeId', 'code', 'newPassword']);
    expect(response.body.paths).toHaveProperty('/auth/google/callback');
    expect(response.body.paths).not.toHaveProperty('/auth/google/result');
    expect(response.body.paths).toHaveProperty('/system/health/ready');
  });
});
