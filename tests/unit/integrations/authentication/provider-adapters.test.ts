import { UnavailableSmsAdapter } from '../../../../src/integrations/sms/unavailable-sms.adapter.js';
import { UnavailableEmailAdapter } from '../../../../src/integrations/email/unavailable-email.adapter.js';

describe('unconfigured authentication providers', () => {
  it('keeps production SMS and email stubs fail-closed', async () => {
    const message = { idempotencyKey: 'message-1', destination: 'redacted', value: 'not-a-real-secret' };
    await expect(new UnavailableSmsAdapter().send(message)).rejects.toMatchObject({
      code: 'AUTH_PROVIDER_UNAVAILABLE',
      statusCode: 503,
      message:
        'The verification provider is temporarily unavailable. Please try again later.',
      expose: true,
    });
    await expect(new UnavailableEmailAdapter().send({ to: ['redacted'], subject: 'verification', text: 'not-a-real-secret', html: '<p>not-a-real-secret</p>', idempotencyKey: 'message-1' })).rejects.toMatchObject({
      code: 'AUTH_PROVIDER_UNAVAILABLE',
      statusCode: 503,
      message:
        'The verification provider is temporarily unavailable. Please try again later.',
      expose: true,
    });
  });
});
