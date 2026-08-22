const E164 = /^\+[1-9][0-9]{1,14}$/u;
const IBAN = /^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/u;
const BULLET = "•";

function invalid(): never {
  throw new Error("PAYOUT_IDENTIFIER_INVALID");
}

export function normalizeWalletE164(
  input: string,
  authoritativeCallingCodes: readonly string[],
): string {
  const normalized = input.trim().replace(/[\s()-]/gu, "");
  if (!E164.test(normalized)) invalid();
  const callingCode = authoritativeCallingCodes
    .filter((value) => /^[1-9][0-9]{0,2}$/u.test(value))
    .sort((left, right) => right.length - left.length)
    .find((value) => normalized.startsWith(`+${value}`));
  if (callingCode === undefined || normalized.length - callingCode.length - 1 < 5) invalid();
  return normalized;
}

export function buildWalletMask(
  normalizedE164: string,
  authoritativeCallingCodes: readonly string[],
): import("./provider-verification.types.js").WalletMaskFacts {
  const normalized = normalizeWalletE164(normalizedE164, authoritativeCallingCodes);
  const callingCode = authoritativeCallingCodes
    .slice()
    .sort((left, right) => right.length - left.length)
    .find((value) => normalized.startsWith(`+${value}`));
  if (callingCode === undefined) return invalid();
  const national = normalized.slice(callingCode.length + 1);
  const lastFour = national.slice(-4);
  return {
    callingCode,
    lastFour,
    nationalLength: national.length,
    mask: `+${callingCode}${BULLET.repeat(national.length - 4)}${lastFour}`,
  };
}

function ibanRemainder(value: string): number {
  const rearranged = `${value.slice(4)}${value.slice(0, 4)}`;
  let remainder = 0;
  for (const character of rearranged) {
    const numeric = /[0-9]/u.test(character)
      ? character
      : String(character.charCodeAt(0) - 55);
    for (const digit of numeric) remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder;
}

export function normalizeIban(input: string, authoritativeCountryCode: string): string {
  const normalized = input.replace(/\s/gu, "").toUpperCase();
  const countryCode = authoritativeCountryCode.toUpperCase();
  if (!IBAN.test(normalized) || normalized.slice(0, 2) !== countryCode || ibanRemainder(normalized) !== 1) {
    invalid();
  }
  return normalized;
}

export function buildIbanMask(normalizedIban: string): import("./provider-verification.types.js").IbanMaskFacts {
  const normalized = normalizedIban.replace(/\s/gu, "").toUpperCase();
  if (!IBAN.test(normalized)) invalid();
  const ungrouped = `${normalized.slice(0, 2)}${BULLET.repeat(normalized.length - 6)}${normalized.slice(-4)}`;
  const groups = ungrouped.match(/.{1,4}/gu);
  if (groups === null) return invalid();
  return {
    ibanCountryPrefix: normalized.slice(0, 2),
    lastFour: normalized.slice(-4),
    normalizedLength: normalized.length,
    mask: groups.join(" "),
  };
}

export function payoutFingerprintIdentity(input:
  | { readonly kind: "MOBILE_WALLET"; readonly countryCode: string; readonly normalizedIdentifier: string }
  | { readonly kind: "BANK_ACCOUNT"; readonly normalizedIdentifier: string }
): readonly string[] {
  return input.kind === "MOBILE_WALLET"
    ? [input.kind, input.countryCode.toUpperCase(), input.normalizedIdentifier]
    : [input.kind, input.normalizedIdentifier];
}
