import { startAuthenticationTestApp, uniqueIdentity } from '../../helpers/authentication/test-authentication-app.js';

const request = require('supertest') as typeof import('supertest');

// Remote test databases can need more than Vitest's unit-test default on a cold connection.
vi.setConfig({ testTimeout: 30_000 });

describe('individual signup and mandatory email OTP', () => {
  it('delivers each verification code to its own normalized signup email', async () => {
    const context = await startAuthenticationTestApp();
    const first = uniqueIdentity('signup-recipient-first');
    const second = uniqueIdentity('signup-recipient-second');
    try {
      const firstSignup = await request(context.app)
        .post('/api/v1/auth/signup')
        .send({
          accountCategory: 'INDIVIDUAL',
          fullName: 'First Customer',
          phone: first.phone,
          email: first.email.toUpperCase(),
          password: first.password,
        })
        .expect(202);
      const secondSignup = await request(context.app)
        .post('/api/v1/auth/signup')
        .send({
          accountCategory: 'INDIVIDUAL',
          fullName: 'Second Customer',
          phone: second.phone,
          email: second.email,
          password: second.password,
        })
        .expect(202);

      expect(context.email.latest(first.email.toLowerCase())).toMatchObject({
        idempotencyKey: firstSignup.body.data.challengeId,
        destination: first.email.toLowerCase(),
      });
      expect(context.email.latest(second.email.toLowerCase())).toMatchObject({
        idempotencyKey: secondSignup.body.data.challengeId,
        destination: second.email.toLowerCase(),
      });
      expect(
        context.email.all().map((delivery) => delivery.destination),
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
          fullName: 'Recipient Override',
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
      expect(context.email.all()).toHaveLength(0);
    } finally {
      await context.stop();
    }
  });

  it('rolls back the auth identity and customer profile when email delivery fails', async () => {
    const context = await startAuthenticationTestApp();
    const identity = uniqueIdentity('email-rollback');
    try {
      context.email.failNext();
      const failed = await request(context.app)
        .post('/api/v1/auth/signup')
        .send({
          accountCategory: 'INDIVIDUAL',
          fullName: 'Rollback Customer',
          phone: identity.phone,
          email: identity.email,
          password: identity.password,
        })
        .expect(503);
      expect(failed.body.error.code).toBe('AUTH_PROVIDER_UNAVAILABLE');
      expect(await context.prisma.user.count({ where: { phoneE164: identity.phone } })).toBe(0);
      expect(await context.prisma.individualProfile.count({ where: { fullName: 'Rollback Customer' } })).toBe(0);
    } finally {
      await context.stop();
    }
  });

  it('creates a pending individual profile, verifies the email challenge, and rejects replay', async () => {
    const context = await startAuthenticationTestApp();
    const identity = uniqueIdentity('individual');
    try {
      const signup = await request(context.app).post('/api/v1/auth/signup').send({ accountCategory: 'INDIVIDUAL', fullName: '  Individual Customer  ', phone: identity.phone, email: identity.email, password: identity.password }).expect(202);
      expect(signup.body.data).toMatchObject({
        accepted: true,
        nextAction: 'VERIFY_ACCOUNT',
        channel: 'EMAIL',
        purpose: 'CATEGORY_VERIFICATION',
        accountCategory: 'INDIVIDUAL',
      });
      expect(signup.body.data.userId).toBeUndefined();
      expect(signup.body.data.maskedDestination).toContain('@');
      const challengeId = signup.body.data.challengeId as string;
      const delivery = context.email.latest(identity.email);
      expect(delivery).toMatchObject({
        idempotencyKey: challengeId,
        destination: identity.email.toLowerCase(),
      });

      const pending = await context.prisma.user.findUniqueOrThrow({ where: { phoneE164: identity.phone } });
      expect(pending).toMatchObject({ accountCategories: ['INDIVIDUAL'], verifiedCategories: [], phoneVerifiedAt: null, emailVerifiedAt: null });
      await expect(context.prisma.individualProfile.findUniqueOrThrow({ where: { userId: pending.id } })).resolves.toMatchObject({ fullName: 'Individual Customer' });

      const resend = await request(context.app).post('/api/v1/auth/otp/request').send({ challengeId }).expect(202);
      expect(resend.body.data).toMatchObject({ accepted: true, challengeId, nextAction: 'VERIFY_ACCOUNT' });

      const verified = await request(context.app).post('/api/v1/auth/otp/verify').send({ challengeId, code: delivery!.value }).expect(200);
      expect(verified.body.data).toEqual({ verified: true, nextAction: 'LOGIN' });
      await request(context.app).post('/api/v1/auth/otp/verify').send({ challengeId, code: delivery!.value }).expect(400);
      const stored = await context.prisma.user.findUniqueOrThrow({ where: { id: pending.id } });
      expect(stored.verifiedCategories).toEqual(['INDIVIDUAL']);
      expect(stored.phoneVerifiedAt).toBeNull();
      expect(stored.emailVerifiedAt).toBeInstanceOf(Date);
    } finally {
      await context.stop();
    }
  });

  it('increments wrong-code attempts without changing category state', async () => {
    const context = await startAuthenticationTestApp();
    const identity = uniqueIdentity('attempts');
    try {
      const signup = await request(context.app).post('/api/v1/auth/signup').send({ accountCategory: 'INDIVIDUAL', fullName: 'Attempt Customer', phone: identity.phone, email: identity.email, password: identity.password }).expect(202);
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
      const response = await request(context.app).post('/api/v1/auth/signup').send({ accountCategory: 'INDIVIDUAL', fullName: 'Malformed Phone', phone: '20123-not-e164', email: identity.email, password: identity.password }).expect(400);
      expect(response.body.error).toMatchObject({
        code: 'REQUEST_VALIDATION_FAILED',
        statusCode: 400,
      });
      expect(response.body.error.details.issues).toContainEqual(
        expect.objectContaining({ path: 'phone' }),
      );
      expect(await context.prisma.user.count({ where: { emailNormalized: identity.email } })).toBe(0);
      expect(context.email.all()).toHaveLength(0);
    } finally {
      await context.stop();
    }
  });

  it('returns phone and email conflicts together for a repeated valid signup', async () => {
    const context = await startAuthenticationTestApp();
    const identity = uniqueIdentity('duplicate-identifiers');
    const payload = {
      accountCategory: 'INDIVIDUAL',
      fullName: 'Duplicate Customer',
      phone: identity.phone,
      email: identity.email,
      password: identity.password,
    };
    try {
      const first = await request(context.app)
        .post('/api/v1/auth/signup')
        .send(payload);
      if (first.status !== 202) {
        // Safe diagnostics only — never log OTPs, tokens, passwords, or credentials.
        throw new Error(
          `expected first signup 202, got ${first.status} code=${String(first.body?.error?.code ?? 'none')}`,
        );
      }

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
      expect(context.email.all()).toHaveLength(1);
    } finally {
      await context.stop();
    }
  });
});
