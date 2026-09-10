import type { BrowseSafeCandidate } from "#modules/eligibility/eligibility.public";
import type { ProviderContactFreePreview } from "#modules/providers/providers.public";

export interface BrowseEnrichedCandidate {
  readonly providerId: string;
  readonly teamId: string;
  readonly sortingFacts: BrowseSafeCandidate["sortingFacts"];
  readonly displayName: string | null;
  readonly thumb: ProviderContactFreePreview["logo"];
}

/**
 * @desc Decimal-safe ascending compare for canonical decimal strings.
 * @access Bookings module
 */
export function compareCanonicalDecimalAsc(left: string, right: string): number {
  const normalizedLeft = normalizeCanonicalDecimal(left);
  const normalizedRight = normalizeCanonicalDecimal(right);
  if (normalizedLeft === null || normalizedRight === null) {
    return left.localeCompare(right);
  }
  const [leftSign, leftInt, leftFrac] = normalizedLeft;
  const [rightSign, rightInt, rightFrac] = normalizedRight;
  if (leftSign !== rightSign) {
    return leftSign < rightSign ? -1 : 1;
  }
  const sign = leftSign;
  if (leftInt.length !== rightInt.length) {
    const longer = leftInt.length > rightInt.length ? 1 : -1;
    return sign * longer;
  }
  const intCmp = leftInt.localeCompare(rightInt);
  if (intCmp !== 0) {
    return sign * intCmp;
  }
  const maxFrac = Math.max(leftFrac.length, rightFrac.length);
  const fracCmp = leftFrac
    .padEnd(maxFrac, "0")
    .localeCompare(rightFrac.padEnd(maxFrac, "0"));
  return sign * fracCmp;
}

function normalizeCanonicalDecimal(
  value: string,
): readonly [1 | -1, string, string] | null {
  const match = /^([+-])?(\d+)(?:\.(\d+))?$/.exec(value.trim());
  if (match === null) {
    return null;
  }
  const sign: 1 | -1 = match[1] === "-" ? -1 : 1;
  const intPart = (match[2] ?? "0").replace(/^0+(?=\d)/, "") || "0";
  const fracPart = match[3] ?? "";
  if (intPart === "0" && /^0*$/.test(fracPart)) {
    return [1, "0", ""];
  }
  return [sign, intPart, fracPart];
}

/**
 * @desc Apply max-price and display-name filters, then standard Browse sort.
 * @access Bookings module
 */
export function filterAndSortBrowseCandidates(input: {
  readonly candidates: readonly BrowseEnrichedCandidate[];
  readonly maxPriceAmount?: string;
  readonly q?: string;
}): BrowseEnrichedCandidate[] {
  const needle = input.q?.trim().toLowerCase() ?? "";
  const filtered = input.candidates.filter((candidate) => {
    if (
      input.maxPriceAmount !== undefined &&
      compareCanonicalDecimalAsc(
        candidate.sortingFacts.priceAmount,
        input.maxPriceAmount,
      ) > 0
    ) {
      return false;
    }
    if (needle.length > 0) {
      const name = candidate.displayName?.toLowerCase() ?? "";
      if (!name.includes(needle)) {
        return false;
      }
    }
    return true;
  });

  return [...filtered].sort((left, right) => {
    const priceCmp = compareCanonicalDecimalAsc(
      left.sortingFacts.priceAmount,
      right.sortingFacts.priceAmount,
    );
    if (priceCmp !== 0) {
      return priceCmp;
    }
    const providerCmp = left.providerId.localeCompare(right.providerId);
    if (providerCmp !== 0) {
      return providerCmp;
    }
    return left.teamId.localeCompare(right.teamId);
  });
}

/**
 * @desc Locale-selected display name from a contact-free preview.
 * @access Bookings module
 */
export function pickDisplayName(
  preview: ProviderContactFreePreview | null,
  locale: "AR" | "EN",
): string | null {
  if (preview === null) {
    return null;
  }
  return locale === "AR" ? preview.displayNameAr : preview.displayNameEn;
}
