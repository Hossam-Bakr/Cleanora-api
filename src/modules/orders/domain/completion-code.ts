import {
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "node:crypto";

export const DEFAULT_COMPLETION_CODE_TTL_SECONDS = 1800;
export const DEFAULT_COMPLETION_CODE_MAX_ATTEMPTS = 5;

export interface IssuedCompletionCode {
  readonly plaintext: string;
  readonly codeHash: string;
  readonly codeSalt: string;
  readonly expiresAt: Date;
  readonly maxAttempts: number;
}

/**
 * @desc Generate a cryptographically random six-digit code with salted hash.
 * @access Orders domain
 */
export function issueCompletionCode(input: {
  readonly now: Date;
  readonly ttlSeconds?: number;
  readonly maxAttempts?: number;
  readonly pepper?: string;
}): IssuedCompletionCode {
  const plaintext = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const codeSalt = randomBytes(16).toString("hex");
  const codeHash = hashCompletionCode(plaintext, codeSalt, input.pepper);
  const ttl =
    input.ttlSeconds === undefined
      ? DEFAULT_COMPLETION_CODE_TTL_SECONDS
      : input.ttlSeconds;
  const maxAttempts =
    input.maxAttempts === undefined
      ? DEFAULT_COMPLETION_CODE_MAX_ATTEMPTS
      : input.maxAttempts;
  return {
    plaintext,
    codeHash,
    codeSalt,
    expiresAt: new Date(input.now.getTime() + ttl * 1000),
    maxAttempts,
  };
}

/**
 * @desc One-way hash for completion codes (salt + optional pepper).
 * @access Orders domain
 */
export function hashCompletionCode(
  plaintext: string,
  salt: string,
  pepper?: string,
): string {
  const material = `${salt}:${plaintext}`;
  if (pepper !== undefined && pepper.length > 0) {
    return createHmac("sha256", pepper).update(material).digest("hex");
  }
  return createHash("sha256").update(material).digest("hex");
}

/**
 * @desc Constant-time verification of a submitted completion code.
 * @access Orders domain
 */
export function verifyCompletionCode(input: {
  readonly plaintext: string;
  readonly codeHash: string;
  readonly codeSalt: string;
  readonly pepper?: string;
}): boolean {
  const expected = hashCompletionCode(
    input.plaintext,
    input.codeSalt,
    input.pepper,
  );
  const left = Buffer.from(expected, "hex");
  const right = Buffer.from(input.codeHash, "hex");
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}

/**
 * @desc Whether a six-digit numeric string is well-formed.
 * @access Orders domain
 */
export function isSixDigitCode(value: string): boolean {
  return /^[0-9]{6}$/u.test(value);
}
