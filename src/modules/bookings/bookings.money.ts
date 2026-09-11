import { AppError } from "#shared/errors/app-error";

const MAX_MINOR_UNIT_DIGITS = 65;
const MAX_CURRENCY_DECIMAL_PLACES = 8;

/**
 * @desc Parse a canonical decimal string into exact minor-unit digits.
 * @access Bookings domain
 */
export function parseCanonicalDecimalToMinorUnits(
  decimalString: string,
  decimalPlaces: number,
): string {
  if (
    !Number.isInteger(decimalPlaces) ||
    decimalPlaces < 0 ||
    decimalPlaces > MAX_CURRENCY_DECIMAL_PLACES
  ) {
    throw bookingMoneyError("SCALE_OUT_OF_RANGE");
  }
  if (typeof decimalString !== "string" || decimalString.length === 0 || /\s/u.test(decimalString)) {
    throw bookingMoneyError("WHITESPACE_OR_EMPTY");
  }
  if (/[eE+\-,_]/u.test(decimalString)) {
    throw bookingMoneyError("NON_CANONICAL_SYNTAX");
  }
  const match = /^([0-9]+)(?:\.([0-9]+))?$/u.exec(decimalString);
  if (match === null) {
    throw bookingMoneyError("NON_CANONICAL_SYNTAX");
  }
  const integerPart = match[1] ?? "";
  const fractionPart = match[2] ?? "";
  if (integerPart.length > 1 && integerPart.startsWith("0")) {
    throw bookingMoneyError("LEADING_ZERO_MALFORMED");
  }
  if (fractionPart.length > decimalPlaces) {
    throw bookingMoneyError("EXCESS_SCALE");
  }
  const paddedFraction = fractionPart.padEnd(decimalPlaces, "0");
  const minorUnits = stripLeadingZeros(`${integerPart}${paddedFraction}`);
  if (minorUnits.length > MAX_MINOR_UNIT_DIGITS) {
    throw bookingMoneyError("MINOR_UNITS_TOO_WIDE");
  }
  return minorUnits;
}

/**
 * @desc Format exact minor-unit digits as a canonical decimal string.
 * @access Bookings domain
 */
export function formatMinorUnitsToCanonicalDecimal(
  minorUnitsDigitString: string,
  decimalPlaces: number,
): string {
  if (
    !Number.isInteger(decimalPlaces) ||
    decimalPlaces < 0 ||
    decimalPlaces > MAX_CURRENCY_DECIMAL_PLACES
  ) {
    throw bookingMoneyError("SCALE_OUT_OF_RANGE");
  }
  if (!/^[0-9]+$/u.test(minorUnitsDigitString)) {
    throw bookingMoneyError("NON_DIGIT_MINOR_UNITS");
  }
  const normalized = stripLeadingZeros(minorUnitsDigitString);
  if (decimalPlaces === 0) {
    return normalized;
  }
  const padded = normalized.padStart(decimalPlaces + 1, "0");
  const splitAt = padded.length - decimalPlaces;
  return `${padded.slice(0, splitAt)}.${padded.slice(splitAt)}`;
}

/**
 * @desc Compare two minor-unit digit strings without binary floating point.
 * @access Bookings domain
 */
export function maxMinorUnits(left: string, right: string): string {
  const a = BigInt(left);
  const b = BigInt(right);
  return a >= b ? stripLeadingZeros(left) : stripLeadingZeros(right);
}

/**
 * @desc Apply a 0–100 percent with up to two decimal places using round-half-up.
 * @access Bookings domain
 * @explanation percentCanonical "25" or "25.00" means 25%. Result is minor units
 * of the same currency scale as `grossMinorUnits`.
 */
export function percentOfMinorUnits(
  grossMinorUnits: string,
  percentCanonical: string,
): { readonly depositMinorUnits: string; readonly remainderMinorUnits: string } {
  const percentTimes100 = percentToBasisPoints(percentCanonical);
  const gross = BigInt(grossMinorUnits);
  const product = gross * BigInt(percentTimes100);
  const divisor = 10000n;
  const deposit = (product + divisor / 2n) / divisor;
  const remainder = gross - deposit;
  if (remainder < 0n) {
    throw bookingMoneyError("REMAINDER_NEGATIVE");
  }
  return {
    depositMinorUnits: deposit.toString(),
    remainderMinorUnits: remainder.toString(),
  };
}

function percentToBasisPoints(percentCanonical: string): string {
  const minor = parseCanonicalDecimalToMinorUnits(percentCanonical, 2);
  const value = BigInt(minor);
  if (value > 10000n) {
    throw bookingMoneyError("PERCENT_OUT_OF_RANGE");
  }
  return minor;
}

function stripLeadingZeros(value: string): string {
  const stripped = value.replace(/^0+(?=\d)/u, "");
  return stripped.length === 0 ? "0" : stripped;
}

function bookingMoneyError(reason: string): AppError {
  return new AppError({
    code: "VALIDATION_FAILED",
    message: "Booking money calculation failed",
    statusCode: 400,
    details: { reason },
  });
}
