import { loadEnvironment } from '../../../src/config/env.js';

const base = { DATABASE_URL: 'postgresql://test:test@localhost:5432/cleanora_test', CORS_ORIGINS: 'http://localhost:5173' };
const email = {
  EMAIL_AUTH_ENABLED: 'true',
  EMAIL_PROVIDER: 'smtp',
  SMTP_HOST: 'smtp.example.test',
  SMTP_PORT: '587',
  SMTP_SECURE: 'false',
  SMTP_REQUIRE_TLS: 'true',
  SMTP_USER: 'mailer@example.test',
  SMTP_PASSWORD: 'smtp-password',
  SMTP_FROM_NAME: 'Cleanora',
  SMTP_FROM_EMAIL: 'mailer@example.test',
  SMTP_CONNECTION_TIMEOUT_MS: '5000',
  SMTP_SOCKET_TIMEOUT_MS: '10000',
};

describe('authentication environment', () => {
  it('requires four independent secrets only when enabled', () => {
    expect(() => loadEnvironment({ ...base, AUTH_ENABLED: 'true' })).toThrow();
    const enabled = loadEnvironment({
      ...base,
      AUTH_ENABLED: 'true',
      ...email,
      JWT_ACCESS_SECRET: 'access-secret-at-least-thirty-two-characters',
      JWT_REFRESH_SECRET: 'refresh-secret-at-least-thirty-two-characters',
      AUTH_VERIFIER_SECRET: 'verifier-secret-at-least-thirty-two-characters',
      AUTH_PRIVACY_HASH_SECRET: 'privacy-secret-at-least-thirty-two-characters'
    });
    expect(enabled.AUTH_ENABLED).toBe(true);
  });
  it('keeps R1-P01 startup compatible when disabled', () => {
    expect(loadEnvironment(base).AUTH_ENABLED).toBe(false);
  });
  it('fails closed when production authentication attempts an insecure cookie override', () => {
    const enabled = { ...base, ...email, NODE_ENV: 'production', AUTH_ENABLED: 'true', JWT_ACCESS_SECRET: 'access-secret-at-least-thirty-two-characters', JWT_REFRESH_SECRET: 'refresh-secret-at-least-thirty-two-characters', AUTH_VERIFIER_SECRET: 'verifier-secret-at-least-thirty-two-characters', AUTH_PRIVACY_HASH_SECRET: 'privacy-secret-at-least-thirty-two-characters' };
    expect(() => loadEnvironment({ ...enabled, AUTH_COOKIE_SECURE: 'false' })).toThrow(/AUTH_COOKIE_SECURE/u);
    expect(loadEnvironment({ ...enabled, AUTH_COOKIE_SECURE: 'true' }).AUTH_COOKIE_SECURE).toBe(true);
  });
  it('requires a frontend callback on an allowlisted origin when Google is enabled', () => {
    const enabled = {
      ...base,
      ...email,
      AUTH_ENABLED: 'true',
      JWT_ACCESS_SECRET: 'access-secret-at-least-thirty-two-characters',
      JWT_REFRESH_SECRET: 'refresh-secret-at-least-thirty-two-characters',
      AUTH_VERIFIER_SECRET: 'verifier-secret-at-least-thirty-two-characters',
      AUTH_PRIVACY_HASH_SECRET: 'privacy-secret-at-least-thirty-two-characters',
      GOOGLE_AUTH_ENABLED: 'true',
      GOOGLE_CLIENT_ID: 'google-client',
      GOOGLE_CLIENT_SECRET: 'google-secret',
      GOOGLE_REDIRECT_URI: 'http://localhost:8000/api/v1/auth/google/callback'
    };
    expect(() => loadEnvironment(enabled)).toThrow(/complete OIDC configuration/u);
    expect(() => loadEnvironment({
      ...enabled,
      GOOGLE_FRONTEND_CALLBACK_URI: 'http://malicious.test/auth/google/callback'
    })).toThrow(/CORS_ORIGINS/u);
    expect(loadEnvironment({
      ...enabled,
      GOOGLE_FRONTEND_CALLBACK_URI: 'http://localhost:5173/auth/google/callback'
    }).GOOGLE_AUTH_ENABLED).toBe(true);
  });

  it('rejects SameSite=None without Secure and incomplete email/Google capability flags', () => {
    const secrets = {
      AUTH_ENABLED: 'true',
      JWT_ACCESS_SECRET: 'access-secret-at-least-thirty-two-characters',
      JWT_REFRESH_SECRET: 'refresh-secret-at-least-thirty-two-characters',
      AUTH_VERIFIER_SECRET: 'verifier-secret-at-least-thirty-two-characters',
      AUTH_PRIVACY_HASH_SECRET: 'privacy-secret-at-least-thirty-two-characters',
    };
    expect(() =>
      loadEnvironment({
        ...base,
        ...secrets,
        AUTH_COOKIE_SAME_SITE: 'none',
        AUTH_COOKIE_SECURE: 'false',
      }),
    ).toThrow(/SameSite=None/u);

    expect(() =>
      loadEnvironment({
        ...base,
        EMAIL_AUTH_ENABLED: 'true',
      }),
    ).toThrow(/AUTH_ENABLED/u);

    expect(() =>
      loadEnvironment({
        ...base,
        GOOGLE_AUTH_ENABLED: 'true',
      }),
    ).toThrow(/AUTH_ENABLED/u);

  });
});
