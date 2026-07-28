import { randomUUID } from "node:crypto";

import type {
  AuthenticationPolicyPort,
  EmailAuthenticationDeliveryPort,
  EndpointLimitPolicy,
  OneTimeVerifierPort,
  PasswordHasherPort,
  SmsAuthenticationDeliveryPort,
  TokenServicePort,
} from "../domain/authentication.ports.js";
import { assertSelfSignupCategory } from "../domain/account-category.policy.js";
import {
  authenticationError,
  signupIdentifierConflictError,
} from "../domain/authentication.errors.js";
import type {
  AccountCategory,
  AuthDeliveryChannel,
  AuthenticationPrincipal,
  IdentityState,
  SafeAuthenticatedUser,
} from "../domain/authentication.types.js";
import { loginCapability } from "../domain/login-eligibility.policy.js";
import {
  assertPasswordPolicy,
  normalizeEmail,
  normalizePhone,
} from "../domain/password.policy.js";
import { recoveryChannel } from "../domain/recovery-channel.policy.js";
import { isSessionActive } from "../domain/session.policy.js";
import {
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_SECONDS,
  OTP_TTL_SECONDS,
} from "../domain/verification.policy.js";
import {
  assertVerificationChallengeTarget,
  verificationTarget,
  type OtpPurpose,
} from "../domain/verification-eligibility.policy.js";
import {
  maskEmailDestination,
  maskPhoneDestination,
} from "../domain/destination-presentation.js";
import { AUTH_RATE_LIMITS } from "../domain/rate-limit.policy.js";
import { UserRepository } from "../infrastructure/user.repository.js";
import { CredentialRepository } from "../infrastructure/credential.repository.js";
import { SessionRepository } from "../infrastructure/session.repository.js";
import { OtpRepository } from "../infrastructure/otp.repository.js";
import { PasswordResetRepository } from "../infrastructure/password-reset.repository.js";
import { AuthEventRepository } from "../infrastructure/auth-event.repository.js";
import { SocialAccountRepository } from "../infrastructure/social-account.repository.js";
import { AuthenticationTransactionRepository } from "../infrastructure/authentication-transaction.repository.js";
import { writeAudit } from "#modules/admin";

export interface AuthenticationServiceDependencies {
  readonly passwordHasher: PasswordHasherPort;
  readonly tokens: TokenServicePort;
  readonly verifier: OneTimeVerifierPort;
  readonly sms: SmsAuthenticationDeliveryPort;
  readonly email: EmailAuthenticationDeliveryPort;
  readonly accessTtlSeconds: number;
  readonly refreshTtlSeconds: number;
  readonly privacyHashSecret: string;
  readonly policy?: AuthenticationPolicyPort;
}

interface VerificationSessionContext {
  readonly userId: string;
  readonly sessionId: string;
  readonly expectedCategory?: AccountCategory;
  readonly expectedPurpose?: OtpPurpose;
  readonly expectedChannel?: AuthDeliveryChannel;
}

export interface SessionTokens {
  readonly accessToken: string;
  readonly accessExpiresAt: Date;
  readonly refreshToken: string;
  readonly refreshExpiresAt: Date;
  readonly verificationOnly: boolean;
  readonly principal: AuthenticationPrincipal;
  readonly user: SafeAuthenticatedUser;
}

export interface AuthenticationRequestMetadata {
  readonly requestId?: string;
  readonly ip?: string;
  readonly userAgent?: string;
}

export type AuthNextAction = "VERIFY_ACCOUNT" | "LOGIN" | "CONTINUE";

export interface VerificationChallengeAccepted {
  readonly accepted: true;
  readonly challengeId: string;
  readonly nextAction: "VERIFY_ACCOUNT";
  readonly accountCategory: AccountCategory;
  readonly purpose: OtpPurpose;
  readonly channel: AuthDeliveryChannel;
  readonly maskedDestination: string;
  readonly expiresAt: string;
  readonly resendAvailableAt: string;
}

export class AuthenticationService {
  private readonly users = new UserRepository();
  private readonly credentials = new CredentialRepository();
  private readonly sessions = new SessionRepository();
  private readonly otps = new OtpRepository();
  private readonly resets = new PasswordResetRepository();
  private readonly events: AuthEventRepository;
  private readonly social = new SocialAccountRepository();
  private readonly transactions = new AuthenticationTransactionRepository();

  constructor(
    private readonly dependencies: AuthenticationServiceDependencies,
  ) {
    this.events = new AuthEventRepository(dependencies.privacyHashSecret);
  }

  async endpointLimits(): Promise<EndpointLimitPolicy> {
    return (
      this.dependencies.policy?.endpointLimits() ?? {
        signupPer15Minutes: AUTH_RATE_LIMITS.signup.ip[0],
        loginPer15Minutes: AUTH_RATE_LIMITS.login.ip[0],
      }
    );
  }

  /**
   * Reject a public signup identifier with a stable field-specific conflict.
   * The human owner accepts this limited existence disclosure for signup UX;
   * login and password recovery remain enumeration-safe.
   */
  private async assertSignupIdentifiersAvailable(
    phoneE164: string,
    emailNormalized?: string,
  ): Promise<void> {
    const [phoneOwner, emailOwner] = await Promise.all([
      this.users.findByPhone(phoneE164),
      emailNormalized === undefined
        ? Promise.resolve(null)
        : this.users.findByEmail(emailNormalized),
    ]);
    const conflicts: Array<"phone" | "email"> = [];
    if (phoneOwner !== null) {
      conflicts.push("phone");
    }
    if (emailOwner !== null) {
      conflicts.push("email");
    }
    if (conflicts.length > 0) {
      throw signupIdentifierConflictError(conflicts);
    }
  }

  async signup(
    input: {
      accountCategory: AccountCategory;
      phone?: string;
      email?: string;
      password: string;
    },
    metadata: AuthenticationRequestMetadata = {},
  ) {
    assertSelfSignupCategory(input.accountCategory);
    assertPasswordPolicy(input.password);
    const phoneE164 =
      input.phone === undefined ? undefined : normalizePhone(input.phone);
    const emailNormalized =
      input.email === undefined ? undefined : normalizeEmail(input.email);
    if (
      phoneE164 === undefined ||
      (input.accountCategory !== "INDIVIDUAL" && emailNormalized === undefined)
    ) {
      throw authenticationError("AUTH_SIGNUP_UNAVAILABLE");
    }
    await this.assertSignupIdentifiersAvailable(phoneE164, emailNormalized);
    const passwordHash = await this.dependencies.passwordHasher.hash(
      input.password,
    );
    const user = await this.transactions.createSignup({
      phoneE164,
      ...(emailNormalized === undefined ? {} : { emailNormalized }),
      category: input.accountCategory,
      passwordHash,
    });
    if (user === null) {
      // A concurrent signup can win after the pre-check but before insertion.
      await this.assertSignupIdentifiersAvailable(phoneE164, emailNormalized);
      throw authenticationError("AUTH_SIGNUP_UNAVAILABLE");
    }
    let challenge: VerificationChallengeAccepted;
    try {
      challenge = await this.requestVerificationForUser(
        this.users.map(user),
        input.accountCategory,
        "CATEGORY_VERIFICATION",
      );
    } catch (error) {
      const failedChallenge = await this.otps.findOpenForUser(
        user.id,
        input.accountCategory,
        "CATEGORY_VERIFICATION",
        "DELIVERY_FAILED",
      );
      if (failedChallenge !== null)
        await this.transactions.rollbackFailedSignup(
          user.id,
          failedChallenge.id,
        );
      throw error;
    }
    await this.events.append({
      userId: user.id,
      eventType: "SIGNUP_ACCEPTED",
      outcome: "SUCCEEDED",
      ...metadata,
      identifier: phoneE164 ?? emailNormalized,
    });
    return challenge;
  }

  async enroll(userId: string, category: AccountCategory) {
    assertSelfSignupCategory(category);
    const current = await this.users.findById(userId);
    if (current === null || current.accountCategories.includes(category))
      throw authenticationError("AUTH_CATEGORY_STATE_CONFLICT");
    await writeAudit({
      actorType: "USER",
      actorId: userId,
      action: "AUTH_CATEGORY_ENROLLMENT_ATTEMPTED",
      targetType: "USER",
      targetId: userId,
      context: { category },
    });
    const user = await this.transactions.enrollCategory({ userId, category });
    if (user === null) throw authenticationError("AUTH_SIGNUP_UNAVAILABLE");
    return this.requestVerificationForUser(
      this.users.map(user),
      category,
      "CATEGORY_VERIFICATION",
    );
  }

  async requestVerification(input: {
    challengeId?: string;
    userId?: string;
    category?: AccountCategory;
    purpose?: OtpPurpose;
  }) {
    if (input.challengeId !== undefined) {
      const prior = await this.otps.find(input.challengeId);
      if (prior === null) throw authenticationError("AUTH_VERIFICATION_FAILED");
      const user = await this.users.findById(prior.userId);
      if (user === null) throw authenticationError("AUTH_VERIFICATION_FAILED");
      return this.requestVerificationForUser(
        this.users.map(user),
        prior.accountCategory,
        prior.purpose,
      );
    }
    if (input.userId === undefined || input.category === undefined) {
      throw authenticationError("AUTH_VERIFICATION_FAILED");
    }
    const user = await this.users.findById(input.userId);
    if (user === null) throw authenticationError("AUTH_VERIFICATION_FAILED");
    return this.requestVerificationForUser(
      this.users.map(user),
      input.category,
      input.purpose ?? "CATEGORY_VERIFICATION",
    );
  }

  private verificationAccepted(
    challenge: {
      readonly id: string;
      readonly expiresAt: Date;
      readonly resendAvailableAt: Date;
    },
    category: AccountCategory,
    purpose: OtpPurpose,
    channel: AuthDeliveryChannel,
    destination: string,
  ): VerificationChallengeAccepted {
    return {
      accepted: true,
      challengeId: challenge.id,
      nextAction: "VERIFY_ACCOUNT",
      accountCategory: category,
      purpose,
      channel,
      maskedDestination:
        channel === "SMS"
          ? maskPhoneDestination(destination)
          : maskEmailDestination(destination),
      expiresAt: challenge.expiresAt.toISOString(),
      resendAvailableAt: challenge.resendAvailableAt.toISOString(),
    };
  }

  private async trustedTemporaryPhoneEmail(
    identity: IdentityState,
  ): Promise<string | undefined> {
    const googleAccount = await this.social.findGoogleByUserId(identity.id);
    if (
      googleAccount?.providerEmailNormalized !== null &&
      googleAccount?.providerEmailNormalized !== undefined &&
      googleAccount.providerEmailVerifiedAt !== null
    ) {
      return googleAccount.providerEmailNormalized;
    }
    return identity.emailNormalized ?? undefined;
  }

  private async requestVerificationForUser(
    identity: IdentityState,
    category: AccountCategory,
    purpose: OtpPurpose,
  ): Promise<VerificationChallengeAccepted> {
    const policy = (await this.dependencies.policy?.verification()) ?? {
      ttlSeconds: OTP_TTL_SECONDS,
      maxAttempts: OTP_MAX_ATTEMPTS,
      resendSeconds: OTP_RESEND_SECONDS,
    };
    const target = verificationTarget(identity, category, purpose);
    const { channel, destination } = target;
    const id = randomUUID();
    const code = this.dependencies.verifier.randomOtp();
    const now = Date.now();
    const creation = await this.otps.create({
      id,
      userId: identity.id,
      category,
      purpose,
      channel,
      destinationHash: this.dependencies.verifier.hashDestination(
        channel,
        destination,
      ),
      verifier: this.dependencies.verifier.verifyOtp(id, purpose, code),
      resendAt: new Date(now + policy.resendSeconds * 1000),
      expiresAt: new Date(now + policy.ttlSeconds * 1000),
      maxAttempts: policy.maxAttempts,
    });
    const { challenge } = creation;
    // A request inside the cooldown receives the same accepted selector without another delivery.
    if (!creation.created) {
      return this.verificationAccepted(
        challenge,
        category,
        purpose,
        channel,
        destination,
      );
    }
    const temporaryEmailDeliveryAddress =
      channel === "SMS"
        ? await this.trustedTemporaryPhoneEmail(identity)
        : undefined;
    try {
      const delivery = {
        idempotencyKey: challenge.id,
        destination,
        value: code,
        accountCategory: category,
        purpose,
        expiresAt: challenge.expiresAt,
        ...(temporaryEmailDeliveryAddress === undefined
          ? {}
          : { temporaryEmailDeliveryAddress }),
      };
      // The SMS port decides how to deliver an SMS intent. In local development
      // it may redirect to the trusted server-resolved email; production
      // adapters can ignore that metadata and deliver to the phone.
      await (channel === "SMS"
        ? this.dependencies.sms.send(delivery)
        : this.dependencies.email.send(delivery));
      await this.otps.activate(challenge.id);
    } catch {
      await this.otps.failDelivery(challenge.id);
      throw authenticationError("AUTH_PROVIDER_UNAVAILABLE");
    }
    return this.verificationAccepted(
      challenge,
      category,
      purpose,
      channel,
      destination,
    );
  }

  async verifyCode(
    input: { challengeId: string; code: string },
    session?: VerificationSessionContext,
  ) {
    const challenge = await this.otps.find(input.challengeId);
    if (
      challenge?.status !== "ACTIVE" ||
      challenge.expiresAt <= new Date()
    )
      throw authenticationError("AUTH_VERIFICATION_FAILED");
    if (
      session !== undefined &&
      (challenge.userId !== session.userId ||
        (session.expectedCategory !== undefined &&
          challenge.accountCategory !== session.expectedCategory) ||
        (session.expectedPurpose !== undefined &&
          challenge.purpose !== session.expectedPurpose) ||
        (session.expectedChannel !== undefined &&
          challenge.channel !== session.expectedChannel))
    ) {
      throw authenticationError("AUTH_VERIFICATION_FAILED");
    }
    const user = await this.users.findById(challenge.userId);
    if (user === null) throw authenticationError("AUTH_VERIFICATION_FAILED");
    const target = verificationTarget(
      this.users.map(user),
      challenge.accountCategory,
      challenge.purpose,
    );
    assertVerificationChallengeTarget(
      target,
      challenge,
      this.dependencies.verifier.hashDestination(
        target.channel,
        target.destination,
      ),
    );
    const expected = this.dependencies.verifier.verifyOtp(
      challenge.id,
      challenge.purpose,
      input.code,
    );
    if (!this.dependencies.verifier.equals(challenge.codeVerifier, expected)) {
      const next = challenge.attemptCount + 1;
      await this.otps.failAttempt(
        challenge.id,
        next >= Math.min(challenge.maxAttempts, OTP_MAX_ATTEMPTS),
      );
      throw authenticationError("AUTH_VERIFICATION_FAILED");
    }
    if (!(await this.transactions.completeVerification(challenge.id, session)))
      throw authenticationError("AUTH_VERIFICATION_FAILED");
    return {
      verified: true,
      nextAction: (session === undefined ? "LOGIN" : "CONTINUE") as AuthNextAction,
      ...(session === undefined ? {} : { verificationOnly: false }),
    };
  }

  async verifyGooglePhone(
    principal: AuthenticationPrincipal,
    input: { challengeId: string; code: string },
  ) {
    if (
      !principal.verificationOnly ||
      !principal.accountCategories.includes("INDIVIDUAL")
    ) {
      throw authenticationError("AUTH_SOCIAL_AUTHENTICATION_FAILED");
    }
    return this.verifyCode(input, {
      userId: principal.userId,
      sessionId: principal.sessionId,
      expectedCategory: "INDIVIDUAL",
      expectedPurpose: "CATEGORY_VERIFICATION",
      expectedChannel: "SMS",
    });
  }

  async login(
    phone: string,
    password: string,
    metadata: AuthenticationRequestMetadata = {},
  ): Promise<SessionTokens> {
    const normalized = normalizePhone(phone);
    const user = await this.users.findByPhone(normalized);
    if (user === null) {
      await this.dependencies.passwordHasher.dummyVerify(password);
      throw authenticationError("AUTHENTICATION_FAILED");
    }
    const credential = await this.credentials.findByUserId(user.id);
    if (
      credential === null ||
      (credential.lockedUntil !== null && credential.lockedUntil > new Date())
    ) {
      await this.dependencies.passwordHasher.dummyVerify(password);
      throw authenticationError("AUTHENTICATION_FAILED");
    }
    if (
      !(await this.dependencies.passwordHasher.verify(
        credential.passwordHash,
        password,
      ))
    ) {
      const policy = (await this.dependencies.policy?.signIn()) ?? {
        maxFailures: 5,
        windowSeconds: 900,
        lockSeconds: 900,
      };
      await this.credentials.failure(user.id, new Date(), policy);
      await this.events.append({
        userId: user.id,
        eventType: "LOGIN_FAILED",
        outcome: "FAILED",
        reasonCode: "INVALID_CREDENTIALS",
        identifier: normalized,
        ...metadata,
      });
      throw authenticationError("AUTHENTICATION_FAILED");
    }
    const capability = loginCapability(this.users.map(user));
    await this.credentials.success(user.id);
    return this.issueSession(
      this.users.map(user),
      credential.credentialVersion,
      "PASSWORD",
      capability,
      metadata,
    );
  }

  private async issueSession(
    identity: IdentityState,
    credentialVersion: number,
    method: "PASSWORD" | "GOOGLE",
    capability: "FULL" | "VERIFICATION_ONLY",
    metadata: AuthenticationRequestMetadata = {},
  ): Promise<SessionTokens> {
    const sessionId = randomUUID();
    const refreshExpiresAt = new Date(
      Date.now() + this.dependencies.refreshTtlSeconds * 1000,
    );
    const refresh = this.dependencies.tokens.issueRefresh(
      {
        userId: identity.id,
        sessionId,
        credentialVersion,
        rotationCounter: 0,
        jwtId: randomUUID(),
      },
      refreshExpiresAt,
    );
    const refreshVerifier = this.dependencies.verifier.verifyRefresh(
      sessionId,
      refresh.token,
    );
    await this.sessions.create({
      id: sessionId,
      userId: identity.id,
      verifier: refreshVerifier,
      credentialVersion,
      method,
      capability,
      expiresAt: refreshExpiresAt,
    });
    const access = this.dependencies.tokens.issueAccess({
      userId: identity.id,
      sessionId,
      credentialVersion,
    });
    const principal = this.principal(identity, sessionId, capability);
    await this.events.append({
      userId: identity.id,
      sessionId,
      eventType: "LOGIN_SUCCEEDED",
      outcome: "SUCCEEDED",
      ...metadata,
    });
    return {
      accessToken: access.token,
      accessExpiresAt: access.expiresAt,
      refreshToken: refresh.token,
      refreshExpiresAt,
      verificationOnly: capability === "VERIFICATION_ONLY",
      principal,
      user: await this.safeUser(identity),
    };
  }

  async authenticateAccess(token: string): Promise<AuthenticationPrincipal> {
    const claims = this.dependencies.tokens.verifyAccess(token);
    const [session, user, credential] = await Promise.all([
      this.sessions.find(claims.sessionId),
      this.users.findById(claims.userId),
      this.credentials.findByUserId(claims.userId),
    ]);
    if (
      session === null ||
      user === null ||
      !isSessionActive(session) ||
      session.credentialVersion !== claims.credentialVersion ||
      (credential !== null &&
        credential.credentialVersion !== claims.credentialVersion)
    )
      throw authenticationError("AUTH_ACCESS_TOKEN_INVALID");
    const capability = loginCapability(this.users.map(user));
    return this.principal(
      this.users.map(user),
      session.id,
      capability === "FULL" ? session.capability : capability,
    );
  }

  async refresh(
    rawToken: string,
    metadata: AuthenticationRequestMetadata = {},
  ): Promise<SessionTokens> {
    const claims = this.dependencies.tokens.verifyRefresh(rawToken);
    const session = await this.sessions.find(claims.sessionId);
    const user = await this.users.findById(claims.userId);
    if (
      session === null ||
      user === null ||
      session.userId !== claims.userId ||
      !isSessionActive(session)
    )
      throw authenticationError("AUTH_REFRESH_TOKEN_INVALID");
    // Re-check account status before rotating a cookie so blocked accounts cannot extend sessions.
    const capability = loginCapability(this.users.map(user));
    const expected = this.dependencies.verifier.verifyRefresh(
      session.id,
      rawToken,
    );
    if (
      !this.dependencies.verifier.equals(
        session.currentRefreshVerifier,
        expected,
      )
    ) {
      await this.sessions.compromise(session.id);
      await this.events.append({
        userId: session.userId,
        sessionId: session.id,
        eventType: "REFRESH_REUSE_DETECTED",
        outcome: "DENIED",
        ...metadata,
      });
      throw authenticationError("AUTH_REFRESH_TOKEN_INVALID");
    }
    const next = this.dependencies.tokens.issueRefresh(
      {
        userId: user.id,
        sessionId: session.id,
        credentialVersion: session.credentialVersion,
        rotationCounter: session.rotationCounter + 1,
        jwtId: randomUUID(),
      },
      session.expiresAt,
    );
    const nextVerifier = this.dependencies.verifier.verifyRefresh(
      session.id,
      next.token,
    );
    if (!(await this.sessions.rotate(session.id, expected, nextVerifier)))
      throw authenticationError("AUTH_REFRESH_TOKEN_INVALID");
    const access = this.dependencies.tokens.issueAccess({
      userId: user.id,
      sessionId: session.id,
      credentialVersion: session.credentialVersion,
    });
    const principal = this.principal(
      this.users.map(user),
      session.id,
      capability === "FULL" ? session.capability : capability,
    );
    await this.events.append({
      userId: user.id,
      sessionId: session.id,
      eventType: "SESSION_REFRESHED",
      outcome: "SUCCEEDED",
      ...metadata,
    });
    return {
      accessToken: access.token,
      accessExpiresAt: access.expiresAt,
      refreshToken: next.token,
      refreshExpiresAt: session.expiresAt,
      verificationOnly: principal.verificationOnly,
      principal,
      user: await this.safeUser(this.users.map(user)),
    };
  }

  async logoutByRefresh(rawToken: string) {
    const claims = this.dependencies.tokens.verifyRefresh(rawToken);
    const session = await this.sessions.find(claims.sessionId);
    if (
      session?.userId !== claims.userId ||
      !isSessionActive(session) ||
      !this.dependencies.verifier.equals(
        session.currentRefreshVerifier,
        this.dependencies.verifier.verifyRefresh(session.id, rawToken),
      )
    ) {
      throw authenticationError("AUTH_REFRESH_TOKEN_INVALID");
    }
    return this.logout(session.id);
  }

  async logout(sessionId: string) {
    await this.sessions.revoke(sessionId, "LOGOUT");
    await this.events.append({
      sessionId,
      eventType: "LOGOUT",
      outcome: "SUCCEEDED",
    });
    return { loggedOut: true };
  }
  async logoutAll(userId: string) {
    await this.sessions.revokeAll(userId, "LOGOUT_ALL");
    await this.events.append({
      userId,
      eventType: "LOGOUT_ALL",
      outcome: "SUCCEEDED",
    });
    return { loggedOut: true };
  }

  async currentUser(principal: AuthenticationPrincipal) {
    const user = await this.users.findById(principal.userId);
    if (user === null) throw authenticationError("AUTHENTICATION_REQUIRED");
    return {
      user: await this.safeUser(this.users.map(user)),
      verificationOnly: principal.verificationOnly,
    };
  }

  async forgotPassword(input: {
    category: AccountCategory;
    identifier: string;
  }) {
    try {
      const channel = recoveryChannel(input.category);
      const normalized =
        channel === "SMS"
          ? normalizePhone(input.identifier)
          : normalizeEmail(input.identifier);
      const user =
        channel === "SMS"
          ? await this.users.findByPhone(normalized)
          : await this.users.findByEmail(normalized);
      if (
        user !== null &&
        user.accountCategories.includes(input.category) &&
        (channel === "SMS" || user.emailVerifiedAt !== null)
      ) {
        const policy = (await this.dependencies.policy?.recovery()) ?? {
          ttlSeconds: 1800,
          maxAttempts: 5,
        };
        const id = randomUUID();
        const secret = this.dependencies.verifier.randomSecret();
        await this.resets.create({
          id,
          userId: user.id,
          channel,
          destinationHash: this.dependencies.verifier.hashDestination(
            channel,
            normalized,
          ),
          verifier: this.dependencies.verifier.verifyReset(id, secret),
          resendAt: new Date(Date.now() + 60_000),
          expiresAt: new Date(Date.now() + policy.ttlSeconds * 1000),
          maxAttempts: policy.maxAttempts,
        });
        const temporaryEmailDeliveryAddress =
          channel === "SMS"
            ? await this.trustedTemporaryPhoneEmail(this.users.map(user))
            : undefined;
        const delivery = {
          idempotencyKey: id,
          destination: normalized,
          value: `${id}.${secret}`,
          accountCategory: input.category,
          purpose: "PASSWORD_RESET" as const,
          expiresAt: new Date(Date.now() + policy.ttlSeconds * 1000),
          ...(temporaryEmailDeliveryAddress === undefined
            ? {}
            : { temporaryEmailDeliveryAddress }),
        };
        try {
          await (channel === "SMS"
            ? this.dependencies.sms.send(delivery)
            : this.dependencies.email.send(delivery));
          await this.resets.activate(id);
        } catch (error) {
          await this.resets.failDelivery(id);
          throw error;
        }
      }
    } catch {
      /* Enumeration-sensitive requests always receive the same acceptance. */
    }
    return { accepted: true };
  }

  async resetPassword(token: string, newPassword: string) {
    assertPasswordPolicy(newPassword);
    const [id, secret] = token.split(".", 2);
    if (id === undefined || secret === undefined)
      throw authenticationError("AUTH_PASSWORD_RESET_FAILED");
    const reset = await this.resets.find(id);
    if (
      reset?.status !== "ACTIVE" ||
      reset.expiresAt <= new Date() ||
      reset.attemptCount >= reset.maxAttempts
    )
      throw authenticationError("AUTH_PASSWORD_RESET_FAILED");
    if (
      !this.dependencies.verifier.equals(
        reset.tokenVerifier,
        this.dependencies.verifier.verifyReset(id, secret),
      )
    ) {
      await this.resets.failAttempt(id);
      throw authenticationError("AUTH_PASSWORD_RESET_FAILED");
    }
    const hash = await this.dependencies.passwordHasher.hash(newPassword);
    await writeAudit({
      actorType: "USER",
      actorId: reset.userId,
      action: "AUTH_PASSWORD_RESET_ATTEMPTED",
      targetType: "USER",
      targetId: reset.userId,
    });
    if (
      !(await this.transactions.resetPassword({
        resetId: id,
        userId: reset.userId,
        passwordHash: hash,
      }))
    )
      throw authenticationError("AUTH_PASSWORD_RESET_FAILED");
    return { passwordReset: true, nextAction: "LOGIN" as const };
  }

  async changePassword(
    principal: AuthenticationPrincipal,
    rawRefreshToken: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<SessionTokens> {
    assertPasswordPolicy(newPassword);
    const credential = await this.credentials.findByUserId(principal.userId);
    if (
      credential === null ||
      !(await this.dependencies.passwordHasher.verify(
        credential.passwordHash,
        currentPassword,
      ))
    )
      throw authenticationError("AUTH_CURRENT_PASSWORD_INVALID");
    if (
      await this.dependencies.passwordHasher.verify(
        credential.passwordHash,
        newPassword,
      )
    )
      throw authenticationError("AUTH_PASSWORD_POLICY_FAILED");
    const claims = this.dependencies.tokens.verifyRefresh(rawRefreshToken);
    const session = await this.sessions.find(principal.sessionId);
    if (
      session === null ||
      claims.sessionId !== principal.sessionId ||
      claims.userId !== principal.userId ||
      !isSessionActive(session)
    )
      throw authenticationError("AUTH_REFRESH_TOKEN_INVALID");
    const expectedVerifier = this.dependencies.verifier.verifyRefresh(
      session.id,
      rawRefreshToken,
    );
    if (
      !this.dependencies.verifier.equals(
        session.currentRefreshVerifier,
        expectedVerifier,
      )
    )
      throw authenticationError("AUTH_REFRESH_TOKEN_INVALID");
    const nextCredentialVersion = credential.credentialVersion + 1;
    const refresh = this.dependencies.tokens.issueRefresh(
      {
        userId: principal.userId,
        sessionId: session.id,
        credentialVersion: nextCredentialVersion,
        rotationCounter: session.rotationCounter + 1,
        jwtId: randomUUID(),
      },
      session.expiresAt,
    );
    const nextVerifier = this.dependencies.verifier.verifyRefresh(
      session.id,
      refresh.token,
    );
    await writeAudit({
      actorType: "USER",
      actorId: principal.userId,
      action: "AUTH_PASSWORD_CHANGE_ATTEMPTED",
      targetType: "USER",
      targetId: principal.userId,
    });
    await this.transactions.changePassword({
      userId: principal.userId,
      sessionId: session.id,
      passwordHash: await this.dependencies.passwordHasher.hash(newPassword),
      expectedVerifier,
      nextVerifier,
      nextCredentialVersion,
    });
    const access = this.dependencies.tokens.issueAccess({
      userId: principal.userId,
      sessionId: session.id,
      credentialVersion: nextCredentialVersion,
    });
    const user = await this.users.findById(principal.userId);
    if (user === null) throw authenticationError("AUTHENTICATION_REQUIRED");
    return {
      accessToken: access.token,
      accessExpiresAt: access.expiresAt,
      refreshToken: refresh.token,
      refreshExpiresAt: session.expiresAt,
      verificationOnly: principal.verificationOnly,
      principal,
      user: await this.safeUser(this.users.map(user)),
    };
  }

  async googleSignIn(provider: {
    subject: string;
    email?: string;
    emailVerified: boolean;
    displayName?: string;
    avatarUrl?: string;
  }): Promise<SessionTokens> {
    if (!provider.emailVerified || provider.email === undefined)
      throw authenticationError("AUTH_SOCIAL_AUTHENTICATION_FAILED");
    const linked = await this.social.findGoogle(provider.subject);
    let user =
      linked === null ? null : await this.users.findById(linked.userId);
    if (linked === null) {
      const emailNormalized = normalizeEmail(provider.email);
      if ((await this.users.findByEmail(emailNormalized)) !== null)
        throw authenticationError("AUTH_SOCIAL_AUTHENTICATION_FAILED");
      user = await this.transactions.createGoogleIdentity({
        emailNormalized,
        subject: provider.subject,
        ...(provider.displayName === undefined
          ? {}
          : { displayName: provider.displayName }),
        ...(provider.avatarUrl === undefined
          ? {}
          : { avatarUrl: provider.avatarUrl }),
      });
      if (user === null)
        throw authenticationError("AUTH_SOCIAL_AUTHENTICATION_FAILED");
    } else {
      await this.social.updateGoogleProfile(provider.subject, {
        ...(provider.displayName === undefined
          ? {}
          : { displayName: provider.displayName }),
        ...(provider.avatarUrl === undefined
          ? {}
          : { avatarUrl: provider.avatarUrl }),
      });
    }
    if (!user?.accountCategories.includes("INDIVIDUAL"))
      throw authenticationError("AUTH_SOCIAL_AUTHENTICATION_FAILED");
    const identity = this.users.map(user);
    const capability =
      identity.phoneVerifiedAt === null
        ? "VERIFICATION_ONLY"
        : loginCapability(identity);
    const credential = await this.credentials.findByUserId(user.id);
    return this.issueSession(
      identity,
      credential?.credentialVersion ?? 1,
      "GOOGLE",
      capability,
    );
  }

  async resolveGoogleLinkPrincipal(
    userId: string,
    sessionId: string,
  ): Promise<AuthenticationPrincipal> {
    const [user, session, credential] = await Promise.all([
      this.users.findById(userId),
      this.sessions.find(sessionId),
      this.credentials.findByUserId(userId),
    ]);
    if (
      user === null ||
      session?.userId !== userId ||
      !isSessionActive(session) ||
      (credential !== null &&
        credential.credentialVersion !== session.credentialVersion)
    ) {
      throw authenticationError("AUTH_SOCIAL_LINK_FAILED");
    }
    const principal = this.principal(
      this.users.map(user),
      session.id,
      session.capability,
    );
    if (
      principal.verificationOnly ||
      !principal.verifiedCategories.includes("INDIVIDUAL")
    ) {
      throw authenticationError("AUTH_SOCIAL_LINK_FAILED");
    }
    return principal;
  }

  async bindGooglePhone(principal: AuthenticationPrincipal, phone: string) {
    if (
      !principal.verificationOnly ||
      !principal.accountCategories.includes("INDIVIDUAL")
    )
      throw authenticationError("AUTH_SOCIAL_AUTHENTICATION_FAILED");
    const googleAccount = await this.social.findGoogleByUserId(principal.userId);
    if (
      googleAccount === null ||
      googleAccount.providerEmailNormalized === null ||
      googleAccount.providerEmailVerifiedAt === null
    ) {
      throw authenticationError("AUTH_GOOGLE_EMAIL_UNAVAILABLE");
    }
    const normalizedPhone = normalizePhone(phone);
    const existing = await this.users.findByPhone(normalizedPhone);
    if (existing !== null && existing.id !== principal.userId) {
      throw authenticationError("AUTH_PHONE_ALREADY_REGISTERED");
    }
    const user = await this.users.bindPhone(principal.userId, normalizedPhone);
    if (user === null) {
      const concurrentOwner = await this.users.findByPhone(normalizedPhone);
      if (concurrentOwner !== null && concurrentOwner.id !== principal.userId) {
        throw authenticationError("AUTH_PHONE_ALREADY_REGISTERED");
      }
      throw authenticationError("AUTH_SIGNUP_UNAVAILABLE");
    }
    return this.requestVerificationForUser(
      this.users.map(user),
      "INDIVIDUAL",
      "CATEGORY_VERIFICATION",
    );
  }

  async linkGoogle(
    principal: AuthenticationPrincipal,
    provider: {
      subject: string;
      email?: string;
      emailVerified: boolean;
      displayName?: string;
      avatarUrl?: string;
    },
  ): Promise<{ linked: true }> {
    if (
      principal.verificationOnly ||
      !principal.verifiedCategories.includes("INDIVIDUAL")
    )
      throw authenticationError("AUTH_SOCIAL_LINK_FAILED");
    if (!provider.emailVerified || provider.email === undefined)
      throw authenticationError("AUTH_SOCIAL_LINK_FAILED");
    if ((await this.social.findGoogle(provider.subject)) !== null)
      throw authenticationError("AUTH_SOCIAL_LINK_FAILED");
    await writeAudit({
      actorType: "USER",
      actorId: principal.userId,
      action: "AUTH_GOOGLE_LINK_ATTEMPTED",
      targetType: "USER",
      targetId: principal.userId,
    });
    await this.transactions.linkGoogle({
      userId: principal.userId,
      sessionId: principal.sessionId,
      subject: provider.subject,
      email: normalizeEmail(provider.email),
      ...(provider.displayName === undefined
        ? {}
        : { displayName: provider.displayName }),
      ...(provider.avatarUrl === undefined
        ? {}
        : { avatarUrl: provider.avatarUrl }),
    });
    return { linked: true };
  }

  async unlinkGoogle(
    principal: AuthenticationPrincipal,
  ): Promise<{ unlinked: true }> {
    const credential = await this.credentials.findByUserId(principal.userId);
    if (credential === null)
      throw authenticationError("AUTH_SOCIAL_UNLINK_UNSAFE");
    await writeAudit({
      actorType: "USER",
      actorId: principal.userId,
      action: "AUTH_GOOGLE_UNLINK_ATTEMPTED",
      targetType: "USER",
      targetId: principal.userId,
    });
    await this.transactions.unlinkGoogle({
      userId: principal.userId,
      sessionId: principal.sessionId,
    });
    return { unlinked: true };
  }

  private principal(
    identity: IdentityState,
    sessionId: string,
    capability: "FULL" | "VERIFICATION_ONLY",
  ): AuthenticationPrincipal {
    return {
      userId: identity.id,
      sessionId,
      accountCategories: identity.accountCategories,
      verifiedCategories: identity.verifiedCategories,
      pendingCategories: identity.accountCategories.filter(
        (value) => !identity.verifiedCategories.includes(value),
      ),
      status: identity.status,
      verificationOnly: capability === "VERIFICATION_ONLY",
    };
  }

  private async safeUser(
    identity: IdentityState,
  ): Promise<SafeAuthenticatedUser> {
    const google = await this.social.findGoogleByUserId(identity.id);
    return {
      id: identity.id,
      displayName: google?.providerDisplayName ?? null,
      avatarUrl: google?.providerAvatarUrl ?? null,
      email: identity.emailNormalized,
      phone: identity.phoneE164,
      emailVerified: identity.emailVerifiedAt !== null,
      phoneVerified: identity.phoneVerifiedAt !== null,
      status: identity.status,
      accountCategories: identity.accountCategories,
      verifiedCategories: identity.verifiedCategories,
      pendingCategories: identity.accountCategories.filter(
        (value) => !identity.verifiedCategories.includes(value),
      ),
    };
  }
}
