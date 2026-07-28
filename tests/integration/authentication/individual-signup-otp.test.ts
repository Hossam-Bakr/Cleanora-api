import { startAuthenticationTestApp, uniqueIdentity } from '../../helpers/authentication/test-authentication-app.js';

const request = require('supertest') as typeof import('supertest');

// Remote test databases can need more than Vitest's unit-test default on a cold connection.
vi.setConfig({ testTimeout: 30_000 });

describe('individual signup and mandatory phone OTP', () => {
  it('binds each development email delivery to its own normalized signup email', async () => {
    const context = await startAuthenticationTestApp();
    const first = uniqueIdentity('signup-recipient-first');
    const second = uniqueIdentity('signup-recipient-second');
    try {
      const firstSignup = await request(context.app)
        .post('/api/v1/auth/signup')
        .send({
          accountCategory: 'INDIVIDUAL',
          phone: first.phone,
          email: first.email.toUpperCase(),
          password: first.password,
        })
        .expect(202);
      const secondSignup = await request(context.app)
        .post('/api/v1/auth/signup')
        .send({
          accountCategory: 'INDIVIDUAL',
          phone: second.phone,
          email: second.email,
          password: second.password,
        })
        .expect(202);

      expect(context.sms.latest(first.email.toLowerCase())).toMatchObject({
        idempotencyKey: firstSignup.body.data.challengeId,
        temporaryEmailDeliveryAddress: first.email.toLowerCase(),
      });
      expect(context.sms.latest(second.email.toLowerCase())).toMatchObject({
        idempotencyKey: secondSignup.body.data.challengeId,
        temporaryEmailDeliveryAddress: second.email.toLowerCase(),
      });
      expect(
        context.sms.all().map((delivery) => delivery.temporaryEmailDeliveryAddress),
      ).toEqual([first.email.toLowerCase(), second.email.toLowerCase()]);
      expect(JSON.stringify([firstSignup.body, secondSignup.body])).not.toMatch(
        /\b\d{6}\b/u,
      );
    } finally {
      await context.stop();
    }
  });

  it('rejects a client-selected OTP recipient before creating a challenge', async () => {
    const context = await startAuthenticationTestApp();
    const identity = uniqueIdentity('signup-recipient-override');
    try {
      await request(context.app)
        .post('/api/v1/auth/signup')
        .send({
          accountCategory: 'INDIVIDUAL',
          phone: identity.phone,
          email: identity.email,
          password: identity.password,
          otpRecipient: 'attacker@example.test',
        })
        .expect(400);

      expect(
        await context.prisma.user.count({
          where: { phoneE164: identity.phone },
        }),
      ).toBe(0);
      expect(context.sms.all()).toHaveLength(0);
    } finally {
      await context.stop();
    }
  });

  it('creates a pending individual, verifies only the SMS challenge, and rejects replay', async () => {
    const context = await startAuthenticationTestApp();
    const identity = uniqueIdentity('individual');
    try {
      const signup = await request(context.app).post('/api/v1/auth/signup').send({ accountCategory: 'INDIVIDUAL', phone: identity.phone, email: identity.email, password: identity.password }).expect(202);
      expect(signup.body.data).toMatchObject({
        accepted: true,
        nextAction: 'VERIFY_ACCOUNT',
        channel: 'SMS',
        purpose: 'CATEGORY_VERIFICATION',
        accountCategory: 'INDIVIDUAL',
      });
      expect(signup.body.data.userId).toBeUndefined();
      expect(signup.body.data.maskedDestination).toMatch(/^\+20/);
      const challengeId = signup.body.data.challengeId as string;
      const delivery = context.sms.latest(identity.phone);
      expect(delivery).toMatchObject({
        idempotencyKey: challengeId,
        destination: identity.phone,
        temporaryEmailDeliveryAddress: identity.email.toLowerCase(),
      });
      expect(context.email.all()).toHaveLength(0);

      const pending = await context.prisma.user.findUniqueOrThrow({ where: { phoneE164: identity.phone } });
      expect(pending).toMatchObject({ accountCategories: ['INDIVIDUAL'], verifiedCategories: [], phoneVerifiedAt: null, emailVerifiedAt: null });

      const resend = await request(context.app).post('/api/v1/auth/otp/request').send({ challengeId }).expect(202);
      expect(resend.body.data).toMatchObject({ accepted: true, challengeId, nextAction: 'VERIFY_ACCOUNT' });

      const verified = await request(context.app).post('/api/v1/auth/otp/verify').send({ challengeId, code: delivery!.value }).expect(200);
      expect(verified.body.data).toEqual({ verified: true, nextAction: 'LOGIN' });
      await request(context.app).post('/api/v1/auth/otp/verify').send({ challengeId, code: delivery!.value }).expect(400);
      const stored = await context.prisma.user.findUniqueOrThrow({ where: { id: pending.id } });
      expect(stored.verifiedCategories).toEqual(['INDIVIDUAL']);
      expect(stored.phoneVerifiedAt).toBeInstanceOf(Date);
      expect(stored.emailVerifiedAt).toBeNull();
    } finally {
      await context.stop();
    }
  });

  it('increments wrong-code attempts without changing category state', async () => {
    const context = await startAuthenticationTestApp();
    const identity = uniqueIdentity('attempts');
    try {
      const signup = await request(context.app).post('/api/v1/auth/signup').send({ accountCategory: 'INDIVIDUAL', phone: identity.phone, password: identity.password }).expect(202);
      const challengeId = signup.body.data.challengeId as string;
      await request(context.app).post('/api/v1/auth/otp/verify').send({ challengeId, code: '000000' }).expect(400);
      const challenge = await context.prisma.otpCode.findUniqueOrThrow({ where: { id: challengeId } });
      const user = await context.prisma.user.findUniqueOrThrow({ where: { phoneE164: identity.phone } });
      expect(challenge.attemptCount).toBe(1);
      expect(user.verifiedCategories).toEqual([]);
    } finally {
      await context.stop();
    }
  });

  it('rejects malformed phone input before creating an enrollment', async () => {
    const context = await startAuthenticationTestApp();
    const identity = uniqueIdentity('malformed-phone');
    try {
      const response = await request(context.app).post('/api/v1/auth/signup').send({ accountCategory: 'INDIVIDUAL', phone: '20123-not-e164', email: identity.email, password: identity.password }).expect(400);
      expect(response.body.error).toMatchObject({
        code: 'REQUEST_VALIDATION_FAILED',
        statusCode: 400,
      });
      expect(response.body.error.details.issues).toContainEqual(
        expect.objectContaining({ path: 'phone' }),
      );
      expect(await context.prisma.user.count({ where: { emailNormalized: identity.email } })).toBe(0);
      expect(context.sms.all()).toHaveLength(0);
    } finally {
      await context.stop();
    }
  });

  it('returns phone and email conflicts together for a repeated valid signup', async () => {
    const context = await startAuthenticationTestApp();
    const identity = uniqueIdentity('duplicate-identifiers');
    const payload = {
      accountCategory: 'INDIVIDUAL',
      phone: identity.phone,
      email: identity.email,
      password: identity.password,
    };
    try {
      await request(context.app)
        .post('/api/v1/auth/signup')
        .send(payload)
        .expect(202);

      const conflict = await request(context.app)
        .post('/api/v1/auth/signup')
        .send(payload)
        .expect(409);

      expect(conflict.body.error).toMatchObject({
        code: 'AUTH_SIGNUP_IDENTIFIERS_ALREADY_REGISTERED',
        statusCode: 409,
      });
      expect(conflict.body.error.details.issues).toEqual([
        {
          path: 'phone',
          code: 'already_registered',
          message: 'This phone number is already registered.',
        },
        {
          path: 'email',
          code: 'already_registered',
          message: 'This email address is already registered.',
        },
      ]);
      expect(
        await context.prisma.user.count({
          where: {
            OR: [
              { phoneE164: identity.phone },
              { emailNormalized: identity.email },
            ],
          },
        }),
      ).toBe(1);
      expect(context.sms.all()).toHaveLength(1);
    } finally {
      await context.stop();
    }
  });
});
