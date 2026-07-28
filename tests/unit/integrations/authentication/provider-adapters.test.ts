import { UnavailableEmailAdapter } from '../../../../src/integrations/email/unavailable-email.adapter.js';

describe('unconfigured authentication providers', () => {
  it('keeps the email provider fail-closed when SMTP is unavailable', async () => {
    await expect(new UnavailableEmailAdapter().send({ to: ['redacted'], subject: 'verification', text: 'not-a-real-secret', html: '<p>not-a-real-secret</p>', idempotencyKey: 'message-1' })).rejects.toMatchObject({
      code: 'AUTH_PROVIDER_UNAVAILABLE',
      statusCode: 503,
      message:
        'The verification provider is temporarily unavailable. Please try again later.',
      expose: true,
    });
  });
});
