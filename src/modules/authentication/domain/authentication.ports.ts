/**
 * Internal service contracts for authentication.
 *
 * The public module surface remains `src/modules/authentication/index.ts`.
 */

export interface SignInPolicy {
  readonly maxFailures: number;
  readonly windowSeconds: number;
  readonly lockSeconds: number;
}

export interface VerificationPolicy {
  readonly ttlSeconds: number;
  readonly maxAttempts: number;
  readonly resendSeconds: number;
}

export interface RecoveryPolicy {
  readonly ttlSeconds: number;
  readonly maxAttempts: number;
}

export interface EndpointLimitPolicy {
  readonly signupPer15Minutes: number;
  readonly loginPer15Minutes: number;
}

export interface AuthenticationPolicyPort {
  signIn(): Promise<SignInPolicy>;
  verification(): Promise<VerificationPolicy>;
  recovery(): Promise<RecoveryPolicy>;
  endpointLimits(): Promise<EndpointLimitPolicy>;
}

export interface AuthenticationDelivery {
  readonly idempotencyKey: string;
  readonly destination: string;
  readonly value: string;
  readonly accountCategory?:
    | "INDIVIDUAL"
    | "COMPANY"
    | "ENGINEER"
    | "PROVIDER_OWNER"
    | "WORKER";
  readonly purpose?:
    | "CATEGORY_VERIFICATION"
    | "OPTIONAL_INDIVIDUAL_EMAIL_VERIFICATION"
    | "PASSWORD_RESET";
  readonly expiresAt?: Date;
}

export interface EmailAuthenticationDeliveryPort {
  send(message: AuthenticationDelivery): Promise<void>;
}

export type GoogleIntent = "SIGN_IN" | "LINK";

export interface GoogleTransaction {
  readonly state: string;
  readonly nonce: string;
  readonly pkceVerifier: string;
  readonly intent: GoogleIntent;
  readonly userId?: string;
  readonly sessionId?: string;
  readonly expiresAt: Date;
}

export interface GoogleTransactionStorePort {
  save(transaction: GoogleTransaction): void;
  consume(state: string): GoogleTransaction | undefined;
}

export interface GoogleIdentity {
  readonly subject: string;
  readonly email?: string;
  readonly emailVerified: boolean;
  readonly displayName?: string;
  readonly avatarUrl?: string;
}

export interface GoogleIdentityPort {
  createAuthorizationUrl(transaction: GoogleTransaction): Promise<string>;
  consumeCallback(
    url: string,
    transaction: GoogleTransaction,
  ): Promise<GoogleIdentity>;
}

export interface OneTimeVerifierPort {
  randomOtp(): string;
  randomSecret(bytes?: number): string;
  verifyOtp(challengeId: string, purpose: string, code: string): string;
  verifyReset(challengeId: string, secret: string): string;
  verifyRefresh(sessionId: string, token: string): string;
  hashDestination(channel: string, destination: string): string;
  equals(left: string, right: string): boolean;
}

export interface PasswordHasherPort {
  hash(password: string): Promise<string>;
  verify(hash: string, password: string): Promise<boolean>;
  dummyVerify(password: string): Promise<void>;
}

export interface AccessTokenClaims {
  readonly userId: string;
  readonly sessionId: string;
  readonly credentialVersion: number;
}

export interface RefreshTokenClaims extends AccessTokenClaims {
  readonly rotationCounter: number;
  readonly jwtId: string;
}

export interface IssuedToken {
  readonly token: string;
  readonly expiresAt: Date;
}

export interface TokenServicePort {
  issueAccess(claims: AccessTokenClaims): IssuedToken;
  issueRefresh(
    claims: RefreshTokenClaims,
    expiresAt: Date,
  ): IssuedToken;
  verifyAccess(token: string): AccessTokenClaims;
  verifyRefresh(token: string): RefreshTokenClaims;
}
