import { startAuthenticationTestApp, uniqueIdentity } from '../../helpers/authentication/test-authentication-app.js';

const request = require('supertest') as typeof import('supertest');
const origin = 'http://localhost:5173';
vi.setConfig({ testTimeout: 120_000 });

function stateFrom(response: import('supertest').Response): string {
  return new URL(response.body.data.authorizationUrl as string).searchParams.get('state')!;
}

async function signInGoogleRestricted(
  context: Awaited<ReturnType<typeof startAuthenticationTestApp>>,
  label: string,
) {
  const agent = request.agent(context.app);
  const identity = uniqueIdentity(label);
  context.google.program({
    subject: `google-${identity.email}`,
    email: identity.email,
    emailVerified: true,
    displayName: `Google ${label}`,
    avatarUrl: `https://lh3.googleusercontent.com/a/${label}`,
  });
  const start = await agent.get('/api/v1/auth/google').expect(200);
  const callback = await agent
    .get('/api/v1/auth/google/callback')
    .query({ state: stateFrom(start), code: 'deterministic' })
    .expect(303);
  expect(callback.headers['location']).toContain(
    'google=success&intent=sign-in&verification=phone-required',
  );
  expect(callback.headers['location']).toMatch(
    /^http:\/\/localhost:5173\/auth\/google\/callback\?/,
  );
  expect(callback.headers['location']).not.toMatch(/accessToken|refreshToken|code=/i);
  const restricted = await agent.post('/api/v1/auth/refresh').set('Origin', origin).expect(200);
  expect(restricted.body.data.verificationOnly).toBe(true);
  expect(restricted.body.data.user).toMatchObject({
    id: restricted.body.data.identity.userId,
    displayName: `Google ${label}`,
    avatarUrl: `https://lh3.googleusercontent.com/a/${label}`,
    email: identity.email.toLowerCase(),
    phone: null,
    emailVerified: true,
    phoneVerified: false,
    status: 'ACTIVE',
    accountCategories: ['INDIVIDUAL'],
    verifiedCategories: [],
    pendingCategories: ['INDIVIDUAL'],
  });
  expect(JSON.stringify(restricted.body)).not.toMatch(
    /providerToken|refreshToken|passwordHash|credentialVersion/iu,
  );
  return {
    agent,
    identity,
    access: restricted.body.data.accessToken as string,
    googleEmail: identity.email.toLowerCase(),
  };
}

describe('Google individual authentication', () => {
  it('creates a local Google identity, redirects safely, and completes phone OTP via verified Google email', async () => {
    const context = await startAuthenticationTestApp();
    try {
      const { agent, identity, access, googleEmail } = await signInGoogleRestricted(
        context,
        'google-gate',
      );
      await agent
        .post('/api/v1/auth/account-categories')
        .set('Authorization', `Bearer ${access}`)
        .send({ accountCategory: 'COMPANY' })
        .expect(403);

      const social = await context.prisma.socialAccount.findFirstOrThrow({
        where: { providerSubject: `google-${identity.email}` },
      });
      expect(social).toMatchObject({
        providerEmailNormalized: googleEmail,
        providerDisplayName: 'Google google-gate',
        providerAvatarUrl: 'https://lh3.googleusercontent.com/a/google-gate',
        accountCategory: 'INDIVIDUAL',
      });
      expect(social.providerEmailVerifiedAt).not.toBeNull();

      const bind = await agent
        .post('/api/v1/auth/google/phone/request')
        .set('Authorization', `Bearer ${access}`)
        .send({ phone: identity.phone })
        .expect(202);

      expect(bind.body.data).toMatchObject({
        accepted: true,
        channel: 'SMS',
        purpose: 'CATEGORY_VERIFICATION',
        accountCategory: 'INDIVIDUAL',
        nextAction: 'VERIFY_ACCOUNT',
      });
      expect(bind.body.data.maskedDestination).toMatch(/^\+20/);
      expect(JSON.stringify(bind.body)).not.toMatch(/\b\d{6}\b/);
      expect(context.sms.all()).toHaveLength(1);

      const delivered = context.sms.latest(googleEmail);
      expect(delivered).toBeDefined();
      expect(delivered!.destination).toBe(identity.phone);
      expect(delivered!.temporaryEmailDeliveryAddress).toBe(googleEmail);
      expect(delivered!.value).toMatch(/^\d{6}$/);

      const verified = await agent
        .post('/api/v1/auth/google/phone/verify')
        .set('Authorization', `Bearer ${access}`)
        .send({ challengeId: bind.body.data.challengeId, code: delivered!.value })
        .expect(200);
      expect(verified.body.data).toEqual({
        verified: true,
        verificationOnly: false,
        nextAction: 'CONTINUE',
      });

      const me = await agent.get('/api/v1/auth/me').set('Authorization', `Bearer ${access}`).expect(200);
      expect(me.body.data).toMatchObject({
        verificationOnly: false,
        user: {
          phoneVerified: true,
          verifiedCategories: ['INDIVIDUAL'],
        },
      });
    } finally {
      await context.stop();
    }
  });

  it('rejects unauthenticated Google phone requests and ignores client-supplied recipient email', async () => {
    const context = await startAuthenticationTestApp();
    try {
      await request(context.app)
        .post('/api/v1/auth/google/phone/request')
        .send({ phone: '+201012345678' })
        .expect(401);

      const { agent, identity, access, googleEmail } = await signInGoogleRestricted(
        context,
        'google-override',
      );
      await agent
        .post('/api/v1/auth/google/phone/request')
        .set('Authorization', `Bearer ${access}`)
        .send({
          phone: identity.phone,
          email: 'attacker@evil.test',
          destinationEmail: 'attacker@evil.test',
        })
        .expect(400);

      const bind = await agent
        .post('/api/v1/auth/google/phone/request')
        .set('Authorization', `Bearer ${access}`)
        .send({ phone: identity.phone })
        .expect(202);

      const delivered = context.sms.latest(googleEmail)!;
      expect(delivered.temporaryEmailDeliveryAddress).toBe(googleEmail);
      expect(delivered.temporaryEmailDeliveryAddress).not.toBe('attacker@evil.test');
      expect(context.sms.all().every((message) => message.temporaryEmailDeliveryAddress === googleEmail)).toBe(
        true,
      );
      expect(JSON.stringify(bind.body)).not.toContain(delivered.value);
    } finally {
      await context.stop();
    }
  });

  it('fails safely when the linked Google email is unavailable and never creates an OTP', async () => {
    const context = await startAuthenticationTestApp();
    try {
      const { agent, identity, access } = await signInGoogleRestricted(
        context,
        'google-no-email',
      );
      await context.prisma.socialAccount.updateMany({
        where: { providerSubject: `google-${identity.email}` },
        data: {
          providerEmailNormalized: null,
          providerEmailVerifiedAt: null,
        },
      });

      const before = await context.prisma.otpCode.count();
      const failed = await agent
        .post('/api/v1/auth/google/phone/request')
        .set('Authorization', `Bearer ${access}`)
        .send({ phone: identity.phone })
        .expect(403);
      expect(failed.body.error.code).toBe('AUTH_GOOGLE_EMAIL_UNAVAILABLE');
      expect(await context.prisma.otpCode.count()).toBe(before);
      expect(context.email.all()).toHaveLength(0);
      expect(context.sms.all()).toHaveLength(0);
    } finally {
      await context.stop();
    }
  });

  it('rejects invalid, expired, reused, and cross-user Google phone OTP attempts', async () => {
    const context = await startAuthenticationTestApp();
    try {
      const first = await signInGoogleRestricted(context, 'google-otp-a');
      const bind = await first.agent
        .post('/api/v1/auth/google/phone/request')
        .set('Authorization', `Bearer ${first.access}`)
        .send({ phone: first.identity.phone })
        .expect(202);
      const challengeId = bind.body.data.challengeId as string;
      const code = context.sms.latest(first.googleEmail)!.value;

      await first.agent
        .post('/api/v1/auth/google/phone/verify')
        .set('Authorization', `Bearer ${first.access}`)
        .send({ challengeId, code: '000000' })
        .expect(400);

      await context.prisma.otpCode.update({
        where: { id: challengeId },
        data: { expiresAt: new Date(Date.now() - 1_000) },
      });
      await first.agent
        .post('/api/v1/auth/google/phone/verify')
        .set('Authorization', `Bearer ${first.access}`)
        .send({ challengeId, code })
        .expect(400);

      await context.prisma.otpCode.update({
        where: { id: challengeId },
        data: {
          status: 'ACTIVE',
          expiresAt: new Date(Date.now() + 120_000),
          attemptCount: 0,
        },
      });

      const second = await signInGoogleRestricted(context, 'google-otp-b');
      await second.agent
        .post('/api/v1/auth/google/phone/verify')
        .set('Authorization', `Bearer ${second.access}`)
        .send({ challengeId, code })
        .expect(400);

      await first.agent
        .post('/api/v1/auth/google/phone/verify')
        .set('Authorization', `Bearer ${first.access}`)
        .send({ challengeId, code })
        .expect(200);
      // Successful verify promotes the session, so a second verify is rejected
      // before the used challenge can be consumed again.
      await first.agent
        .post('/api/v1/auth/google/phone/verify')
        .set('Authorization', `Bearer ${first.access}`)
        .send({ challengeId, code })
        .expect(401);
      const consumed = await context.prisma.otpCode.findUniqueOrThrow({
        where: { id: challengeId },
      });
      expect(consumed.status).not.toBe('ACTIVE');
    } finally {
      await context.stop();
    }
  });

  it('keeps Google phone OTP attempt limits and does not expose OTP in ordinary logs', async () => {
    const context = await startAuthenticationTestApp();
    try {
      const { agent, identity, access, googleEmail } = await signInGoogleRestricted(
        context,
        'google-attempts',
      );
      const bind = await agent
        .post('/api/v1/auth/google/phone/request')
        .set('Authorization', `Bearer ${access}`)
        .send({ phone: identity.phone })
        .expect(202);
      const challengeId = bind.body.data.challengeId as string;
      const code = context.sms.latest(googleEmail)!.value;

      for (let attempt = 0; attempt < 5; attempt += 1) {
        await agent
          .post('/api/v1/auth/google/phone/verify')
          .set('Authorization', `Bearer ${access}`)
          .send({ challengeId, code: '111111' })
          .expect(400);
      }
      await agent
        .post('/api/v1/auth/google/phone/verify')
        .set('Authorization', `Bearer ${access}`)
        .send({ challengeId, code })
        .expect(400);

      const challenge = await context.prisma.otpCode.findUniqueOrThrow({
        where: { id: challengeId },
      });
      expect(challenge.status).not.toBe('ACTIVE');
      expect(JSON.stringify(bind.body)).not.toContain(code);
      expect(JSON.stringify(context.logger.lastError ?? {})).not.toContain(code);
      const events = await context.prisma.authEvent.findMany({
        where: { userId: challenge.userId },
      });
      expect(JSON.stringify(events)).not.toContain(code);
    } finally {
      await context.stop();
    }
  });

  it('links verified Google data only through an authenticated individual flow and can safely unlink', async () => {
    const context = await startAuthenticationTestApp();
    const agent = request.agent(context.app);
    const identity = uniqueIdentity('google-link');
    try {
      const signup = await agent
        .post('/api/v1/auth/signup')
        .send({
          accountCategory: 'INDIVIDUAL',
          phone: identity.phone,
          password: identity.password,
        })
        .expect(202);
      await agent
        .post('/api/v1/auth/otp/verify')
        .send({
          challengeId: signup.body.data.challengeId,
          code: context.sms.latest(identity.phone)!.value,
        })
        .expect(200);
      const login = await agent
        .post('/api/v1/auth/login')
        .send({ phone: identity.phone, password: identity.password })
        .expect(200);
      const access = login.body.data.accessToken as string;
      context.google.program({
        subject: `linked-${identity.email}`,
        email: identity.email,
        emailVerified: true,
      });

      const start = await agent
        .get('/api/v1/auth/google/link')
        .set('Authorization', `Bearer ${access}`)
        .expect(200);
      const callback = await agent
        .get('/api/v1/auth/google/callback')
        .query({ state: stateFrom(start), code: 'deterministic' })
        .expect(303);
      expect(callback.headers['location']).toContain('google=success&intent=link');
      expect(
        await context.prisma.socialAccount.count({
          where: { providerSubject: `linked-${identity.email}` },
        }),
      ).toBe(1);
      await agent
        .delete('/api/v1/auth/social/google')
        .set('Authorization', `Bearer ${access}`)
        .expect(200);
      expect(
        await context.prisma.socialAccount.count({
          where: { providerSubject: `linked-${identity.email}` },
        }),
      ).toBe(0);
    } finally {
      await context.stop();
    }
  });
});
