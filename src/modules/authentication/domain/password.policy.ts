import { authenticationError } from './authentication.errors.js';

const E164 = /^\+[1-9][0-9]{1,14}$/;
const PASSWORD_MIN_LENGTH = 7;
const PASSWORD_MAX_LENGTH = 128;
const PASSWORD_MAX_BYTES = 512;
const COMMON_PASSWORDS = new Set([
  "1234567",
  "12345678",
  "123456789",
  "1234567890",
  "admin123",
  "cleanora",
  "cleanora1",
  "letmein",
  "password",
  "password1",
  "qwerty1",
  "qwerty123",
  "welcome",
]);

export function isPhoneFormatValid(value: string): boolean {
  return E164.test(value.replace(/[\s()-]/g, ""));
}

export function normalizePhone(value: string): string {
  const normalized = value.replace(/[\s()-]/g, '');
  if (!isPhoneFormatValid(value)) {
    throw authenticationError('AUTH_PHONE_FORMAT_INVALID');
  }
  return normalized;
}

export function normalizeEmail(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (normalized.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw authenticationError('AUTH_EMAIL_FORMAT_INVALID');
  }
  return normalized;
}

function isRepeatedPattern(value: string): boolean {
  for (let patternLength = 1; patternLength <= value.length / 2; patternLength += 1) {
    if (value.length % patternLength !== 0) {
      continue;
    }
    const pattern = value.slice(0, patternLength);
    if (pattern.repeat(value.length / patternLength) === value) {
      return true;
    }
  }
  return false;
}

function isSequentialNumber(value: string): boolean {
  if (!/^\d+$/.test(value)) {
    return false;
  }
  const digits = [...value].map(Number);
  const ascending = digits.slice(1).every(
    (digit, index) => digit === ((digits[index] ?? 0) + 1) % 10,
  );
  const descending = digits.slice(1).every(
    (digit, index) => digit === ((digits[index] ?? 0) + 9) % 10,
  );
  return ascending || descending;
}

export function isPasswordPolicySatisfied(password: string): boolean {
  const bytes = Buffer.byteLength(password, "utf8");
  const normalized = password.toLowerCase();
  return (
    password.length >= PASSWORD_MIN_LENGTH &&
    password.length <= PASSWORD_MAX_LENGTH &&
    bytes <= PASSWORD_MAX_BYTES &&
    !COMMON_PASSWORDS.has(normalized) &&
    !isRepeatedPattern(normalized) &&
    !isSequentialNumber(normalized)
  );
}

export function assertPasswordPolicy(password: string): void {
  if (!isPasswordPolicySatisfied(password)) {
    throw authenticationError('AUTH_PASSWORD_POLICY_FAILED');
  }
}
