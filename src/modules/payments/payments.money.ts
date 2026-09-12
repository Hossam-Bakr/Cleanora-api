import { paymentsError } from "./payments.errors.js";

const MAX_MINOR_UNIT_DIGITS = 65;

/**
 * @desc Normalize an unsigned minor-unit digit string.
 * @access Payments domain
 */
export function normalizeMinorUnits(value: string): string {
  if (typeof value !== "string" || value.length === 0 || /\s/u.test(value)) {
    throw paymentsError("VALIDATION_FAILED", { reason: "WHITESPACE_OR_EMPTY" });
  }
  if (!/^[0-9]+$/u.test(value)) {
    throw paymentsError("VALIDATION_FAILED", { reason: "NON_DIGIT_MINOR_UNITS" });
  }
  const normalized = value.replace(/^0+(?=\d)/u, "");
  if (normalized.length > MAX_MINOR_UNIT_DIGITS) {
    throw paymentsError("VALIDATION_FAILED", { reason: "MINOR_UNITS_TOO_WIDE" });
  }
  return normalized;
}

/**
 * @desc Require a positive unsigned minor-unit amount.
 * @access Payments domain
 */
export function requirePositiveMinorUnits(value: string): string {
  const normalized = normalizeMinorUnits(value);
  if (normalized === "0") {
    throw paymentsError("VALIDATION_FAILED", { reason: "ZERO_AMOUNT" });
  }
  return normalized;
}

/**
 * @desc Add two unsigned minor-unit digit strings.
 * @access Payments domain
 */
export function addMinorUnits(left: string, right: string): string {
  return (BigInt(normalizeMinorUnits(left)) + BigInt(normalizeMinorUnits(right))).toString();
}

/**
 * @desc Compare two unsigned minor-unit digit strings.
 * @access Payments domain
 */
export function compareMinorUnits(left: string, right: string): number {
  const a = BigInt(normalizeMinorUnits(left));
  const b = BigInt(normalizeMinorUnits(right));
  if (a === b) {
    return 0;
  }
  return a > b ? 1 : -1;
}

/**
 * @desc Signed debit-minus-credit balance as a digit string (optional leading minus).
 * @access Payments domain
 */
export function signedBalanceMinorUnits(
  debitMinorUnits: string,
  creditMinorUnits: string,
): string {
  const debit = BigInt(normalizeMinorUnits(debitMinorUnits));
  const credit = BigInt(normalizeMinorUnits(creditMinorUnits));
  return (debit - credit).toString();
}
