/**
 * Deterministic R1-P10 locality/coverage fixtures. Synthetic only — never
 * production Country/Provider/locality data. Live-database gates stay
 * self-contained here (never `DATABASE_URL`, never a prior-phase disposable
 * target) so this batch never connects to, migrates, or seeds a database.
 */

const APPROVED_R1_P10_TARGET_PATTERN =
  /^cleanora_r1_p10(?:_[a-z0-9]+)*_(?:test|proof|clean|ci)$/;

/**
 * @desc Require an explicitly named, phase-owned disposable Phase 10 URL.
 * @access Test helper
 * @explanation Never falls back to `DATABASE_URL` or another phase's target;
 * database proofs remain an explicitly controlled later batch.
 */
export function requireR1P10ProofDatabaseUrl(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const value = env["CLEANORA_R1_P10_DATABASE_URL"];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(
      "CLEANORA_R1_P10_DATABASE_URL is required for R1-P10 disposable proofs",
    );
  }
  let targetName: string;
  try {
    const url = new URL(value);
    targetName = decodeURIComponent(url.pathname.replace(/^\//u, ""));
  } catch {
    throw new Error("R1-P10 database URL is not a valid URL");
  }
  if (!APPROVED_R1_P10_TARGET_PATTERN.test(targetName)) {
    throw new Error(
      `Refusing R1-P10 database work against unapproved target "${targetName}"`,
    );
  }
  return value;
}

/** True only when an owner-approved disposable Phase 10 URL is explicitly present. */
export function hasExplicitR1P10TestDatabase(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  try {
    requireR1P10ProofDatabaseUrl(env);
    return true;
  } catch {
    return false;
  }
}

export const R1_P10_IDS = {
  countryId: "country-r1p10-eg",
  countryCode: "EG",
  otherCountryId: "country-r1p10-sa",
  otherCountryCode: "SA",
  cityId: "city-r1p10-cairo",
  cityCode: "CAI",
  otherCityId: "city-r1p10-giza",
  otherCityCode: "GIZ",
  districtId: "district-r1p10-nasr-city",
  districtCode: "NASR",
  secondDistrictId: "district-r1p10-heliopolis",
  secondDistrictCode: "HELIO",
  inactiveDistrictId: "district-r1p10-inactive",
  inactiveDistrictCode: "INACTIVE",
  providerId: "provider-r1p10-synthetic",
  otherProviderId: "provider-r1p10-other",
  ownerUserId: "owner-r1p10-synthetic",
  adminUserId: "admin-r1p10-synthetic",
  staffAdminUserId: "staff-admin-r1p10-synthetic",
  requestId: "request-r1p10-synthetic",
  idempotencyKey: "00000000-0000-4000-8000-000000000010",
  secondIdempotencyKey: "00000000-0000-4000-8000-000000000011",
} as const;

export const R1_P10_SENTINELS = {
  timeZone: "Africa/Cairo",
  reasonText: "R1-P10 synthetic Staff locality reason",
  cityNameAr: "القاهرة",
  cityNameEn: "Cairo",
  districtNameAr: "مدينة نصر",
  districtNameEn: "Nasr City",
} as const;

export interface SyntheticCityFixture {
  readonly id: string;
  readonly countryId: string;
  readonly code: string;
  readonly nameAr: string;
  readonly nameEn: string;
  readonly isActive: boolean;
  readonly version: number;
}

export interface SyntheticDistrictFixture {
  readonly id: string;
  readonly cityId: string;
  readonly code: string;
  readonly nameAr: string;
  readonly nameEn: string;
  readonly isActive: boolean;
  readonly version: number;
}

/** Build a deterministic active City fixture with overridable fields. */
export function buildCityFixture(
  overrides: Partial<SyntheticCityFixture> = {},
): SyntheticCityFixture {
  return {
    id: R1_P10_IDS.cityId,
    countryId: R1_P10_IDS.countryId,
    code: R1_P10_IDS.cityCode,
    nameAr: R1_P10_SENTINELS.cityNameAr,
    nameEn: R1_P10_SENTINELS.cityNameEn,
    isActive: true,
    version: 1,
    ...overrides,
  };
}

/** Build a deterministic active District fixture with overridable fields. */
export function buildDistrictFixture(
  overrides: Partial<SyntheticDistrictFixture> = {},
): SyntheticDistrictFixture {
  return {
    id: R1_P10_IDS.districtId,
    cityId: R1_P10_IDS.cityId,
    code: R1_P10_IDS.districtCode,
    nameAr: R1_P10_SENTINELS.districtNameAr,
    nameEn: R1_P10_SENTINELS.districtNameEn,
    isActive: true,
    version: 1,
    ...overrides,
  };
}
