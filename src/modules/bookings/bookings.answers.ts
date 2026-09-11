import type { CatalogFieldDefinition } from "#modules/catalog/catalog.public";

/** Thrown when a catalog answer does not match its field definition. */
export class BookingAnswerValidationError extends Error {
  public constructor(public readonly fieldId: string) {
    super("INVALID_BOOKING_ANSWER");
    this.name = "BookingAnswerValidationError";
  }
}

const INTEGER_PATTERN = /^-?\d+$/u;
const DECIMAL_PATTERN = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/u;

/**
 * @desc Canonicalize one catalog answer against its snapshot-ready field rules.
 * @access Bookings domain
 */
export function canonicalizeBookingAnswer(
  field: CatalogFieldDefinition,
  value: unknown,
): unknown {
  switch (field.kind) {
    case "INFORMATION":
      throw new BookingAnswerValidationError(field.id);
    case "TEXT":
      return canonicalizeText(field, value);
    case "NUMBER":
      return canonicalizeNumber(field, value);
    case "BOOLEAN":
      if (typeof value !== "boolean") {
        throw new BookingAnswerValidationError(field.id);
      }
      return value;
    case "SINGLE_SELECT":
      return canonicalizeSingleSelect(field, value);
    case "MULTI_SELECT":
      return canonicalizeMultiSelect(field, value);
    default:
      throw new BookingAnswerValidationError(field.id);
  }
}

function canonicalizeText(field: CatalogFieldDefinition, value: unknown): string {
  if (typeof value !== "string") {
    throw new BookingAnswerValidationError(field.id);
  }
  const canonical = value.trim();
  const min = field.textBounds?.min ?? 0;
  const max = field.textBounds?.max ?? 2000;
  if (canonical.length < min || canonical.length > max) {
    throw new BookingAnswerValidationError(field.id);
  }
  return canonical;
}

function canonicalizeNumber(field: CatalogFieldDefinition, value: unknown): unknown {
  const rules = field.numberRules;
  if (rules === null) {
    throw new BookingAnswerValidationError(field.id);
  }
  if (rules.mode === "INTEGER") {
    const integer = asInteger(value);
    if (integer === null) {
      throw new BookingAnswerValidationError(field.id);
    }
    if (rules.min !== null && integer < BigInt(rules.min)) {
      throw new BookingAnswerValidationError(field.id);
    }
    if (rules.max !== null && integer > BigInt(rules.max)) {
      throw new BookingAnswerValidationError(field.id);
    }
    if (
      integer > BigInt(Number.MAX_SAFE_INTEGER) ||
      integer < BigInt(Number.MIN_SAFE_INTEGER)
    ) {
      throw new BookingAnswerValidationError(field.id);
    }
    return Number(integer);
  }
  if (typeof value !== "string" || !DECIMAL_PATTERN.test(value)) {
    throw new BookingAnswerValidationError(field.id);
  }
  const canonical = canonicalizeDecimalString(value);
  if (rules.min !== null && compareDecimalStrings(canonical, rules.min) < 0) {
    throw new BookingAnswerValidationError(field.id);
  }
  if (rules.max !== null && compareDecimalStrings(canonical, rules.max) > 0) {
    throw new BookingAnswerValidationError(field.id);
  }
  return canonical;
}

function canonicalizeSingleSelect(
  field: CatalogFieldDefinition,
  value: unknown,
): string {
  if (typeof value !== "string") {
    throw new BookingAnswerValidationError(field.id);
  }
  if (!field.options.some((option) => option.value === value)) {
    throw new BookingAnswerValidationError(field.id);
  }
  const min = field.selectionBounds?.min ?? 1;
  const max = field.selectionBounds?.max ?? 1;
  if (min > 1 || max < 1) {
    throw new BookingAnswerValidationError(field.id);
  }
  return value;
}

function canonicalizeMultiSelect(
  field: CatalogFieldDefinition,
  value: unknown,
): readonly string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new BookingAnswerValidationError(field.id);
  }
  const unique = new Set(value);
  if (unique.size !== value.length) {
    throw new BookingAnswerValidationError(field.id);
  }
  const allowed = new Set(field.options.map((option) => option.value));
  for (const entry of value) {
    if (!allowed.has(entry)) {
      throw new BookingAnswerValidationError(field.id);
    }
  }
  const min = field.selectionBounds?.min ?? 0;
  const max = field.selectionBounds?.max ?? field.options.length;
  if (value.length < min || value.length > max) {
    throw new BookingAnswerValidationError(field.id);
  }
  return [...value];
}

function asInteger(value: unknown): bigint | null {
  if (typeof value === "number") {
    if (!Number.isInteger(value) || !Number.isSafeInteger(value)) {
      return null;
    }
    return BigInt(value);
  }
  if (typeof value === "string" && INTEGER_PATTERN.test(value)) {
    try {
      return BigInt(value);
    } catch {
      return null;
    }
  }
  return null;
}

function canonicalizeDecimalString(value: string): string {
  const negative = value.startsWith("-");
  const unsigned = negative ? value.slice(1) : value;
  const parts = unsigned.split(".");
  const wholeRaw = parts[0] ?? "0";
  const fractionRaw = parts[1] ?? "";
  const whole = wholeRaw.replace(/^0+(?=\d)/u, "") || "0";
  const fraction = fractionRaw.replace(/0+$/u, "");
  const body = fraction.length === 0 ? whole : `${whole}.${fraction}`;
  if (body === "0") {
    return "0";
  }
  return negative ? `-${body}` : body;
}

function compareDecimalStrings(left: string, right: string): number {
  const leftNeg = left.startsWith("-") && left !== "-0";
  const rightNeg = right.startsWith("-") && right !== "-0";
  if (leftNeg !== rightNeg) {
    return leftNeg ? -1 : 1;
  }
  const cmp = compareUnsignedDecimal(
    leftNeg ? left.slice(1) : left,
    rightNeg ? right.slice(1) : right,
  );
  return leftNeg ? -cmp : cmp;
}

function compareUnsignedDecimal(left: string, right: string): number {
  const leftParts = left.split(".");
  const rightParts = right.split(".");
  const leftWholeRaw = leftParts[0] ?? "0";
  const leftFrac = leftParts[1] ?? "";
  const rightWholeRaw = rightParts[0] ?? "0";
  const rightFrac = rightParts[1] ?? "";
  const leftWhole = leftWholeRaw.replace(/^0+(?=\d)/u, "") || "0";
  const rightWhole = rightWholeRaw.replace(/^0+(?=\d)/u, "") || "0";
  if (leftWhole.length !== rightWhole.length) {
    return leftWhole.length < rightWhole.length ? -1 : 1;
  }
  if (leftWhole !== rightWhole) {
    return leftWhole < rightWhole ? -1 : 1;
  }
  const fracLen = Math.max(leftFrac.length, rightFrac.length);
  const leftPadded = leftFrac.padEnd(fracLen, "0");
  const rightPadded = rightFrac.padEnd(fracLen, "0");
  if (leftPadded === rightPadded) {
    return 0;
  }
  return leftPadded < rightPadded ? -1 : 1;
}
