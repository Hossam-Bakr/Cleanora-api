import { createHash } from "node:crypto";

import type {
  ActiveCountry,
  ActiveCountryReader,
} from "#modules/configuration/configuration.public";
import { CatalogError } from "./catalog.errors.js";

/**
 * Framework-neutral Catalog domain policies for stable codes, locales,
 * versions, order vectors, and safe command fingerprint/replay decisions.
 * Localization completeness, field-kind, lifecycle, and selectability rules
 * are added by their owning user stories.
 */

export const CATALOG_LOCALES = ["AR", "EN"] as const;
export type CatalogLocaleCode = (typeof CATALOG_LOCALES)[number];

export const SERVICE_FIELD_KINDS = [
  "INFORMATION",
  "TEXT",
  "NUMBER",
  "BOOLEAN",
  "SINGLE_SELECT",
  "MULTI_SELECT",
] as const;
export type ServiceFieldKindCode = (typeof SERVICE_FIELD_KINDS)[number];

export const SERVICE_NUMBER_MODES = ["INTEGER", "DECIMAL"] as const;
export type ServiceNumberModeCode = (typeof SERVICE_NUMBER_MODES)[number];

export const STABLE_CODE_PATTERN = /^[A-Z][A-Z0-9_]*$/;

/** `catalog_command_requests.scope_key` is `VARCHAR(200)`. */
export const CATALOG_COMMAND_SCOPE_KEY_MAX_LENGTH = 200;

const REQUEST_HASH_PATTERN = /^[0-9a-f]{64}$/;

/**
 * @desc Assert a Catalog stable code format and length.
 * @explanation Stable codes are immutable business identities, so a malformed
 * code is a validation failure rather than a value the policy silently fixes.
 */
export function assertStableCode(
  code: string,
  options: { readonly min: number; readonly max: number; readonly field: string },
): string {
  const trimmed = code.trim();
  if (
    trimmed.length < options.min ||
    trimmed.length > options.max ||
    !STABLE_CODE_PATTERN.test(trimmed)
  ) {
    throw new CatalogError(
      "CATALOG_VALIDATION_FAILED",
      "Catalog stable code is invalid",
      { details: { field: options.field } },
    );
  }
  return trimmed;
}

/**
 * @desc Trim localized text; empty after trim becomes null.
 * @explanation A blank localized value is an incomplete draft, never a
 * present-but-empty translation that could pass an activation check.
 */
export function normalizeOptionalLocalizedText(
  value: string | null | undefined,
): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/**
 * @desc Require complete Arabic and English category content to activate.
 * @explanation FR-011 keeps an incomplete record legal only while inactive, so
 * completeness is enforced at the activation boundary instead of on every draft
 * write.
 */
export function assertCategoryActivationContent(input: {
  readonly isActive: boolean;
  readonly nameAr: string | null;
  readonly nameEn: string | null;
  readonly descriptionAr: string | null;
  readonly descriptionEn: string | null;
}): void {
  if (!input.isActive) {
    return;
  }
  const missing = (
    [
      ["nameAr", input.nameAr],
      ["nameEn", input.nameEn],
      ["descriptionAr", input.descriptionAr],
      ["descriptionEn", input.descriptionEn],
    ] as const
  )
    .filter(([, value]) => normalizeOptionalLocalizedText(value) === null)
    .map(([field]) => field);

  if (missing.length > 0) {
    throw new CatalogError(
      "CATALOG_ACTIVATION_INCOMPLETE",
      "Catalog category cannot be active without complete Arabic and English content",
      { details: { missing } },
    );
  }
}

/**
 * @desc Require one complete translation row per required locale.
 * @explanation An exact-locale read must fail safely rather than fall back to
 * the other locale, so a missing or blank required locale is rejected here.
 */
export function assertExactLocalesComplete(input: {
  readonly translations: readonly {
    readonly locale: CatalogLocaleCode;
    readonly name: string | null;
    readonly description: string | null;
  }[];
  readonly requiredLocales: readonly CatalogLocaleCode[];
}): void {
  const complete = new Set(
    input.translations
      .filter(
        (translation) =>
          normalizeOptionalLocalizedText(translation.name) !== null &&
          normalizeOptionalLocalizedText(translation.description) !== null,
      )
      .map((translation) => translation.locale),
  );

  const missing = input.requiredLocales.filter((locale) => !complete.has(locale));
  if (missing.length > 0) {
    throw new CatalogError(
      "CATALOG_ACTIVATION_INCOMPLETE",
      "Catalog content is missing a required locale",
      { details: { missingLocales: missing } },
    );
  }
}

/**
 * @desc Require complete AR and EN service translations when activating a service.
 * @explanation Incomplete translations remain legal only while the service is
 * inactive; activation never falls back across locales (DEC-041).
 */
export function assertServiceActivationContent(input: {
  readonly isActive: boolean;
  readonly translations: readonly {
    readonly locale: CatalogLocaleCode;
    readonly name: string | null;
    readonly description: string | null;
  }[];
}): void {
  if (!input.isActive) {
    return;
  }
  assertExactLocalesComplete({
    translations: input.translations,
    requiredLocales: CATALOG_LOCALES,
  });
}

/**
 * @desc Reject duplicate locale rows in one service translation payload.
 * @explanation Two rows for the same locale would make exact-locale reads
 * ambiguous, so the write fails closed before persistence.
 */
export function assertUniqueLocales(
  translations: readonly { readonly locale: CatalogLocaleCode }[],
): void {
  const seen = new Set<CatalogLocaleCode>();
  for (const translation of translations) {
    if (seen.has(translation.locale)) {
      throw new CatalogError(
        "CATALOG_VALIDATION_FAILED",
        "Catalog service translations must not repeat a locale",
        { details: { locale: translation.locale } },
      );
    }
    seen.add(translation.locale);
  }
}

export const CATALOG_LIFECYCLE_ACTIONS = ["ACTIVATE", "DEACTIVATE"] as const;
export type CatalogLifecycleAction = (typeof CATALOG_LIFECYCLE_ACTIONS)[number];

/** Target `isActive` value for one lifecycle action. */
export function resolveLifecycleTarget(action: CatalogLifecycleAction): boolean {
  return action === "ACTIVATE";
}

/**
 * @desc Reject any attempt to change a stable business code.
 * @explanation Codes are the immutable identity later modules copy into
 * snapshots, so a rename must be a new record rather than a silent rewrite.
 */
export function assertImmutableStableCode(input: {
  readonly currentCode: string;
  readonly requestedCode: string | null | undefined;
  readonly field: string;
}): void {
  if (
    input.requestedCode !== undefined &&
    input.requestedCode !== null &&
    input.requestedCode !== input.currentCode
  ) {
    throw new CatalogError(
      "CATALOG_VALIDATION_FAILED",
      "Catalog stable code is immutable after creation",
      { details: { field: input.field } },
    );
  }
}

/**
 * @desc Validate one category lifecycle command against proposed content.
 * @explanation Activation is the only boundary that requires complete
 * Arabic/English content; deactivation of an authorized current version is
 * always legal and never rewrites child lifecycle state.
 */
export function assertCategoryLifecycleChange(input: {
  readonly action: CatalogLifecycleAction;
  readonly nameAr: string | null;
  readonly nameEn: string | null;
  readonly descriptionAr: string | null;
  readonly descriptionEn: string | null;
}): void {
  assertCategoryActivationContent({
    isActive: resolveLifecycleTarget(input.action),
    nameAr: input.nameAr,
    nameEn: input.nameEn,
    descriptionAr: input.descriptionAr,
    descriptionEn: input.descriptionEn,
  });
}

/**
 * @desc Validate one service lifecycle command against its parent and content.
 * @explanation An active service under an inactive category would be
 * unreachable but advertised as live, so the parent state is a hard activation
 * precondition alongside exact AR/EN completeness.
 */
export function assertServiceLifecycleChange(input: {
  readonly action: CatalogLifecycleAction;
  readonly categoryIsActive: boolean;
  readonly translations: readonly {
    readonly locale: CatalogLocaleCode;
    readonly name: string | null;
    readonly description: string | null;
  }[];
}): void {
  const nextIsActive = resolveLifecycleTarget(input.action);
  if (!nextIsActive) {
    return;
  }
  if (!input.categoryIsActive) {
    throw new CatalogError(
      "CATALOG_ACTIVATION_INCOMPLETE",
      "Catalog service cannot be active under an inactive category",
      { details: { reason: "PARENT_CATEGORY_INACTIVE" } },
    );
  }
  assertServiceActivationContent({
    isActive: true,
    translations: input.translations,
  });
}

/**
 * @desc Validate the parent category a service is created under or moved to.
 * @explanation The same invariant that blocks activation under an inactive
 * category must block moving an already active service beneath one.
 */
export function assertServiceCategoryAssignment(input: {
  readonly serviceIsActive: boolean;
  readonly targetCategoryIsActive: boolean;
}): void {
  if (input.serviceIsActive && !input.targetCategoryIsActive) {
    throw new CatalogError(
      "CATALOG_ACTIVATION_INCOMPLETE",
      "An active Catalog service cannot move under an inactive category",
      { details: { reason: "PARENT_CATEGORY_INACTIVE" } },
    );
  }
}

/**
 * @desc Contiguous 0-based order vectors must cover an exact ID set once.
 */
export function assertExactOrderVector(
  orderedIds: readonly string[],
  expectedIds: ReadonlySet<string>,
): void {
  if (orderedIds.length !== expectedIds.size) {
    throw new CatalogError(
      "CATALOG_ORDER_INVALID",
      "Catalog order vector does not cover the exact identity set",
    );
  }
  const seen = new Set<string>();
  for (const id of orderedIds) {
    if (!expectedIds.has(id) || seen.has(id)) {
      throw new CatalogError(
        "CATALOG_ORDER_INVALID",
        "Catalog order vector repeats or omits an identity",
      );
    }
    seen.add(id);
  }
}

/**
 * @desc Canonical JSON fingerprint of one validated command payload.
 * @explanation Object key order must not change the digest, while array order
 * must, because Catalog order vectors are business facts. `undefined` members
 * are dropped exactly like `JSON.stringify` so an omitted field and an
 * explicit `null` stay distinguishable.
 */
export function canonicalCatalogCommandFingerprint(value: unknown): string {
  return JSON.stringify(canonicalize(value)) ?? "null";
}

function canonicalize(value: unknown): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item));
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
  return Object.fromEntries(
    entries.map(([key, item]) => [key, canonicalize(item)]),
  );
}

/**
 * @desc SHA-256 hex digest of a canonical command fingerprint.
 * @explanation The stored digest carries no localized content, so replay and
 * conflict detection never persist Arabic/English business text.
 */
export function hashCatalogCommandFingerprint(fingerprint: string): string {
  return createHash("sha256").update(fingerprint, "utf8").digest("hex");
}

/**
 * @desc Build the normalized idempotency scope for one Catalog command.
 * @explanation Scoping by operation and stable target keeps one client key
 * reusable across unrelated commands while still deduplicating retries.
 */
export function buildCatalogCommandScopeKey(input: {
  readonly operation: string;
  readonly targetType: string;
  readonly targetId: string | null;
}): string {
  const scopeKey = `catalog:${input.operation}:${input.targetType}:${input.targetId ?? "*"}`;
  if (scopeKey.length > CATALOG_COMMAND_SCOPE_KEY_MAX_LENGTH) {
    throw new CatalogError(
      "CATALOG_VALIDATION_FAILED",
      "Catalog command scope key exceeds the persisted length",
    );
  }
  return scopeKey;
}

export interface CatalogCommandRecord {
  readonly status: "PENDING" | "COMPLETED";
  readonly requestHash: string;
  readonly targetType: string;
  readonly targetId: string | null;
  readonly acceptedVersion: number | null;
  readonly reservedMediaFileId: string | null;
}

export type CatalogCommandDecision =
  | { readonly kind: "NEW" }
  | { readonly kind: "REPLAY"; readonly record: CatalogCommandRecord }
  | { readonly kind: "RESUME"; readonly record: CatalogCommandRecord };

/**
 * @desc Decide replay, resume, or conflict for one stored command receipt.
 * @explanation A completed same-payload replay must produce no second write,
 * audit, or version bump; a pending same-payload retry resumes the reserved
 * Media identity; any different payload for the same key fails closed.
 */
export function decideCatalogCommandOutcome(
  existing: CatalogCommandRecord | null,
  requestHash: string,
): CatalogCommandDecision {
  if (existing === null) {
    return { kind: "NEW" };
  }
  if (!REQUEST_HASH_PATTERN.test(existing.requestHash)) {
    throw new CatalogError(
      "CATALOG_IDEMPOTENCY_CONFLICT",
      "Stored Catalog command fingerprint is unusable",
    );
  }
  if (existing.requestHash !== requestHash) {
    throw new CatalogError(
      "CATALOG_IDEMPOTENCY_CONFLICT",
      "Catalog command idempotency key reused with a different payload",
    );
  }
  return existing.status === "COMPLETED"
    ? { kind: "REPLAY", record: existing }
    : { kind: "RESUME", record: existing };
}

/**
 * @desc Derive the deterministic two-part PostgreSQL advisory lock identity.
 * @explanation `pg_advisory_xact_lock(int4, int4)` needs signed 32-bit keys,
 * so both halves come from one digest of the trusted actor/scope/key identity.
 */
export function catalogAdvisoryLockKey(
  actorUserId: string,
  scopeKey: string,
  idempotencyKey: string,
): { readonly classId: number; readonly objectId: number } {
  const digest = createHash("sha256")
    .update(`${actorUserId}\u0000${scopeKey}\u0000${idempotencyKey}`, "utf8")
    .digest();
  return {
    classId: digest.readInt32BE(0),
    objectId: digest.readInt32BE(4),
  };
}

/** Keys that must never appear on a Catalog price-unit definition (FR-015). */
export const PRICE_AMOUNT_FORBIDDEN_KEYS = [
  "amount",
  "price",
  "priceAmount",
  "minimumCharge",
  "minCharge",
  "discount",
  "discountAmount",
  "currency",
  "priceHistory",
] as const;

const DECIMAL_BOUND_PATTERN = /^-?[0-9]+(?:\.[0-9]{1,3})?$/;
const INTEGER_DECIMAL_STRING_PATTERN = /^-?[0-9]+$/;

export interface NormalizedPriceUnitInput {
  readonly code: string;
  readonly labelAr: string | null;
  readonly labelEn: string | null;
  readonly isActive: boolean;
}

export interface NormalizedFieldOptionInput {
  readonly value: string;
  readonly labelAr: string | null;
  readonly labelEn: string | null;
  readonly isActive: boolean;
}

export interface NormalizedServiceFieldInput {
  readonly code: string;
  readonly kind: ServiceFieldKindCode;
  readonly labelAr: string | null;
  readonly labelEn: string | null;
  readonly helpTextAr: string | null;
  readonly helpTextEn: string | null;
  readonly isRequired: boolean;
  readonly isActive: boolean;
  readonly minLength: number | null;
  readonly maxLength: number | null;
  readonly numberMode: ServiceNumberModeCode | null;
  readonly minValue: string | null;
  readonly maxValue: string | null;
  readonly minSelections: number | null;
  readonly maxSelections: number | null;
  readonly options: readonly NormalizedFieldOptionInput[];
}

/**
 * @desc Reject provider-owned price facts on a price-unit payload (FR-015).
 */
export function assertNoPriceAmountFields(
  value: Readonly<Record<string, unknown>>,
  options?: { readonly path?: string },
): void {
  for (const key of PRICE_AMOUNT_FORBIDDEN_KEYS) {
    if (Object.prototype.hasOwnProperty.call(value, key)) {
      throw new CatalogError(
        "CATALOG_CONFIGURATION_INVALID",
        "Catalog price units must not store provider price amounts",
        { details: { field: options?.path ?? key } },
      );
    }
  }
}

/**
 * @desc Reject duplicate stable codes or option values within one collection.
 */
export function assertUniqueStableIdentities(
  identities: readonly string[],
  options: { readonly field: string },
): void {
  const seen = new Set<string>();
  for (const identity of identities) {
    if (seen.has(identity)) {
      throw new CatalogError(
        "CATALOG_CONFIGURATION_INVALID",
        "Catalog configuration repeats a stable identity",
        { details: { field: options.field, identity } },
      );
    }
    seen.add(identity);
  }
}

/**
 * @desc Normalize and validate one decimal bound string for NUMBER fields.
 */
export function normalizeDecimalBound(
  value: string | null | undefined,
  options: { readonly field: string; readonly numberMode: ServiceNumberModeCode },
): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (!DECIMAL_BOUND_PATTERN.test(trimmed)) {
    throw new CatalogError(
      "CATALOG_CONFIGURATION_INVALID",
      "Catalog numeric bound is not a valid decimal string",
      { details: { field: options.field } },
    );
  }
  if (
    options.numberMode === "INTEGER" &&
    !INTEGER_DECIMAL_STRING_PATTERN.test(trimmed)
  ) {
    throw new CatalogError(
      "CATALOG_CONFIGURATION_INVALID",
      "Catalog INTEGER numeric bounds must be canonical integer decimal strings",
      { details: { field: options.field } },
    );
  }
  return trimmed;
}

function assertNonNegativeIntegerBound(
  value: number | null | undefined,
  field: string,
): number | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (!Number.isInteger(value) || value < 0) {
    throw new CatalogError(
      "CATALOG_CONFIGURATION_INVALID",
      "Catalog bound must be a non-negative integer",
      { details: { field } },
    );
  }
  return value;
}

function assertOrderedBounds(
  minimum: number | string | null,
  maximum: number | string | null,
  field: string,
): void {
  if (minimum === null || maximum === null) {
    return;
  }
  const minNumeric = typeof minimum === "string" ? Number(minimum) : minimum;
  const maxNumeric = typeof maximum === "string" ? Number(maximum) : maximum;
  if (maxNumeric < minNumeric) {
    throw new CatalogError(
      "CATALOG_CONFIGURATION_INVALID",
      "Catalog minimum bound exceeds maximum bound",
      { details: { field } },
    );
  }
}

/**
 * @desc Require complete AR/EN labels when a price unit is active.
 */
export function assertPriceUnitActivationContent(input: {
  readonly isActive: boolean;
  readonly labelAr: string | null;
  readonly labelEn: string | null;
}): void {
  if (!input.isActive) {
    return;
  }
  const missing = (
    [
      ["labelAr", input.labelAr],
      ["labelEn", input.labelEn],
    ] as const
  )
    .filter(([, value]) => normalizeOptionalLocalizedText(value) === null)
    .map(([field]) => field);
  if (missing.length > 0) {
    throw new CatalogError(
      "CATALOG_ACTIVATION_INCOMPLETE",
      "Catalog price unit cannot be active without complete Arabic and English labels",
      { details: { missing } },
    );
  }
}

/**
 * @desc Validate one service-scoped price unit draft (FR-013–FR-015).
 */
export function assertPriceUnitInput(
  raw: Readonly<Record<string, unknown>>,
): NormalizedPriceUnitInput {
  assertNoPriceAmountFields(raw, { path: "priceUnits" });
  const code = assertStableCode(String(raw["code"] ?? ""), {
    min: 2,
    max: 64,
    field: "priceUnits.code",
  });
  return {
    code,
    labelAr: normalizeOptionalLocalizedText(raw["labelAr"] as string | null | undefined),
    labelEn: normalizeOptionalLocalizedText(raw["labelEn"] as string | null | undefined),
    isActive: Boolean(raw["isActive"]),
  };
}

/**
 * @desc Require complete AR/EN option labels when an option is active.
 */
export function assertFieldOptionActivationContent(input: {
  readonly isActive: boolean;
  readonly labelAr: string | null;
  readonly labelEn: string | null;
}): void {
  if (!input.isActive) {
    return;
  }
  const missing = (
    [
      ["labelAr", input.labelAr],
      ["labelEn", input.labelEn],
    ] as const
  )
    .filter(([, value]) => normalizeOptionalLocalizedText(value) === null)
    .map(([field]) => field);
  if (missing.length > 0) {
    throw new CatalogError(
      "CATALOG_ACTIVATION_INCOMPLETE",
      "Catalog field option cannot be active without complete Arabic and English labels",
      { details: { missing } },
    );
  }
}

/**
 * @desc Validate one selectable field option (FR-018).
 */
export function assertFieldOptionInput(
  raw: Readonly<Record<string, unknown>>,
): NormalizedFieldOptionInput {
  assertNoPriceAmountFields(raw, { path: "options" });
  const value = assertStableCode(String(raw["value"] ?? ""), {
    min: 1,
    max: 80,
    field: "options.value",
  });
  const normalized = {
    value,
    labelAr: normalizeOptionalLocalizedText(raw["labelAr"] as string | null | undefined),
    labelEn: normalizeOptionalLocalizedText(raw["labelEn"] as string | null | undefined),
    isActive: Boolean(raw["isActive"]),
  };
  assertFieldOptionActivationContent(normalized);
  return normalized;
}

/**
 * @desc Enforce the closed DEC-042 kind/compatibility matrix (FR-017, FR-020).
 */
export function assertServiceFieldKindCompatibility(input: {
  readonly kind: ServiceFieldKindCode;
  readonly isRequired: boolean;
  readonly minLength: number | null;
  readonly maxLength: number | null;
  readonly numberMode: ServiceNumberModeCode | null;
  readonly minValue: string | null;
  readonly maxValue: string | null;
  readonly minSelections: number | null;
  readonly maxSelections: number | null;
  readonly options: readonly NormalizedFieldOptionInput[];
}): void {
  const hasTextBounds = input.minLength !== null || input.maxLength !== null;
  const hasNumberBounds =
    input.numberMode !== null || input.minValue !== null || input.maxValue !== null;
  const hasSelectionBounds =
    input.minSelections !== null || input.maxSelections !== null;
  const hasOptions = input.options.length > 0;

  switch (input.kind) {
    case "INFORMATION":
      if (input.isRequired) {
        throw new CatalogError(
          "CATALOG_CONFIGURATION_INVALID",
          "INFORMATION fields must not be required",
          { details: { kind: input.kind } },
        );
      }
      if (hasTextBounds || hasNumberBounds || hasSelectionBounds || hasOptions) {
        throw new CatalogError(
          "CATALOG_CONFIGURATION_INVALID",
          "INFORMATION fields accept no constraints or options",
          { details: { kind: input.kind } },
        );
      }
      return;
    case "TEXT":
      if (hasNumberBounds || hasSelectionBounds || hasOptions) {
        throw new CatalogError(
          "CATALOG_CONFIGURATION_INVALID",
          "TEXT fields accept only optional length bounds",
          { details: { kind: input.kind } },
        );
      }
      assertOrderedBounds(input.minLength, input.maxLength, "minLength/maxLength");
      return;
    case "NUMBER":
      if (hasTextBounds || hasSelectionBounds || hasOptions) {
        throw new CatalogError(
          "CATALOG_CONFIGURATION_INVALID",
          "NUMBER fields accept only numeric mode and bounds",
          { details: { kind: input.kind } },
        );
      }
      if (input.numberMode === null) {
        throw new CatalogError(
          "CATALOG_CONFIGURATION_INVALID",
          "NUMBER fields require an explicit integer or decimal mode",
          { details: { kind: input.kind } },
        );
      }
      assertOrderedBounds(input.minValue, input.maxValue, "minValue/maxValue");
      return;
    case "BOOLEAN":
      if (hasTextBounds || hasNumberBounds || hasSelectionBounds || hasOptions) {
        throw new CatalogError(
          "CATALOG_CONFIGURATION_INVALID",
          "BOOLEAN fields accept no constraints or options",
          { details: { kind: input.kind } },
        );
      }
      return;
    case "SINGLE_SELECT":
      if (hasTextBounds || hasNumberBounds || hasSelectionBounds) {
        throw new CatalogError(
          "CATALOG_CONFIGURATION_INVALID",
          "SINGLE_SELECT fields accept ordered options only",
          { details: { kind: input.kind } },
        );
      }
      if (!hasOptions) {
        throw new CatalogError(
          "CATALOG_CONFIGURATION_INVALID",
          "SINGLE_SELECT fields require at least one option definition",
          { details: { kind: input.kind } },
        );
      }
      return;
    case "MULTI_SELECT":
      if (hasTextBounds || hasNumberBounds) {
        throw new CatalogError(
          "CATALOG_CONFIGURATION_INVALID",
          "MULTI_SELECT fields accept ordered options and optional selection bounds",
          { details: { kind: input.kind } },
        );
      }
      if (!hasOptions) {
        throw new CatalogError(
          "CATALOG_CONFIGURATION_INVALID",
          "MULTI_SELECT fields require at least one option definition",
          { details: { kind: input.kind } },
        );
      }
      assertOrderedBounds(
        input.minSelections,
        input.maxSelections,
        "minSelections/maxSelections",
      );
      return;
    default: {
      const exhaustive: never = input.kind;
      throw new CatalogError(
        "CATALOG_CONFIGURATION_INVALID",
        "Catalog field kind is not supported",
        { details: { kind: exhaustive } },
      );
    }
  }
}

/**
 * @desc Require complete labels and select-kind option counts when a field is active.
 */
export function assertServiceFieldActivationContent(input: {
  readonly kind: ServiceFieldKindCode;
  readonly isActive: boolean;
  readonly labelAr: string | null;
  readonly labelEn: string | null;
  readonly helpTextAr: string | null;
  readonly helpTextEn: string | null;
  readonly minSelections: number | null;
  readonly maxSelections: number | null;
  readonly options: readonly NormalizedFieldOptionInput[];
}): void {
  if (!input.isActive) {
    return;
  }
  const missingLabels = (
    [
      ["labelAr", input.labelAr],
      ["labelEn", input.labelEn],
    ] as const
  )
    .filter(([, value]) => normalizeOptionalLocalizedText(value) === null)
    .map(([field]) => field);
  if (missingLabels.length > 0) {
    throw new CatalogError(
      "CATALOG_ACTIVATION_INCOMPLETE",
      "Catalog field cannot be active without complete Arabic and English labels",
      { details: { missing: missingLabels } },
    );
  }

  const helpAr = normalizeOptionalLocalizedText(input.helpTextAr);
  const helpEn = normalizeOptionalLocalizedText(input.helpTextEn);
  if ((helpAr !== null) !== (helpEn !== null)) {
    throw new CatalogError(
      "CATALOG_ACTIVATION_INCOMPLETE",
      "Catalog field help text must be complete in both locales when present",
      { details: { field: "helpText" } },
    );
  }

  if (input.kind !== "SINGLE_SELECT" && input.kind !== "MULTI_SELECT") {
    return;
  }

  const activeOptionCount = input.options.filter((option) => option.isActive).length;
  if (activeOptionCount < 2) {
    throw new CatalogError(
      "CATALOG_ACTIVATION_INCOMPLETE",
      "Selectable fields require at least two active options when active",
      { details: { kind: input.kind, activeOptionCount } },
    );
  }
  if (
    input.kind === "MULTI_SELECT" &&
    input.maxSelections !== null &&
    input.maxSelections > activeOptionCount
  ) {
    throw new CatalogError(
      "CATALOG_CONFIGURATION_INVALID",
      "Catalog MULTI_SELECT maximum selections exceeds active option count",
      { details: { maxSelections: input.maxSelections, activeOptionCount } },
    );
  }
}

/**
 * @desc Validate one service field and its ordered options (FR-016–FR-020).
 */
export function assertServiceFieldInput(
  raw: Readonly<Record<string, unknown>>,
): NormalizedServiceFieldInput {
  assertNoPriceAmountFields(raw, { path: "fields" });
  const kind = raw["kind"] as ServiceFieldKindCode;
  if (!SERVICE_FIELD_KINDS.includes(kind)) {
    throw new CatalogError(
      "CATALOG_CONFIGURATION_INVALID",
      "Catalog field kind is not supported",
      { details: { kind } },
    );
  }

  const code = assertStableCode(String(raw["code"] ?? ""), {
    min: 2,
    max: 80,
    field: "fields.code",
  });
  const numberMode =
    raw["numberMode"] === null || raw["numberMode"] === undefined
      ? null
      : (raw["numberMode"] as ServiceNumberModeCode);
  if (
    numberMode !== null &&
    !SERVICE_NUMBER_MODES.includes(numberMode)
  ) {
    throw new CatalogError(
      "CATALOG_CONFIGURATION_INVALID",
      "Catalog NUMBER mode must be INTEGER or DECIMAL",
      { details: { numberMode } },
    );
  }

  const minLength = assertNonNegativeIntegerBound(
    raw["minLength"] as number | null | undefined,
    "minLength",
  );
  const maxLength = assertNonNegativeIntegerBound(
    raw["maxLength"] as number | null | undefined,
    "maxLength",
  );
  const minSelections = assertNonNegativeIntegerBound(
    raw["minSelections"] as number | null | undefined,
    "minSelections",
  );
  const maxSelections = assertNonNegativeIntegerBound(
    raw["maxSelections"] as number | null | undefined,
    "maxSelections",
  );
  if (kind === "NUMBER" && numberMode === null) {
    throw new CatalogError(
      "CATALOG_CONFIGURATION_INVALID",
      "NUMBER fields require an explicit integer or decimal mode",
      { details: { kind } },
    );
  }
  const minValue =
    kind === "NUMBER" && numberMode !== null
      ? normalizeDecimalBound(raw["minValue"] as string | null | undefined, {
          field: "minValue",
          numberMode,
        })
      : null;
  const maxValue =
    kind === "NUMBER" && numberMode !== null
      ? normalizeDecimalBound(raw["maxValue"] as string | null | undefined, {
          field: "maxValue",
          numberMode,
        })
      : null;

  const rawOptions = Array.isArray(raw["options"]) ? raw["options"] : [];
  const options = rawOptions.map((option) =>
    assertFieldOptionInput(option as Readonly<Record<string, unknown>>),
  );
  assertUniqueStableIdentities(
    options.map((option) => option.value),
    { field: "options.value" },
  );

  const normalized: NormalizedServiceFieldInput = {
    code,
    kind,
    labelAr: normalizeOptionalLocalizedText(raw["labelAr"] as string | null | undefined),
    labelEn: normalizeOptionalLocalizedText(raw["labelEn"] as string | null | undefined),
    helpTextAr: normalizeOptionalLocalizedText(raw["helpTextAr"] as string | null | undefined),
    helpTextEn: normalizeOptionalLocalizedText(raw["helpTextEn"] as string | null | undefined),
    isRequired: kind === "INFORMATION" ? false : Boolean(raw["isRequired"]),
    isActive: Boolean(raw["isActive"]),
    minLength,
    maxLength,
    numberMode: kind === "NUMBER" ? numberMode : null,
    minValue,
    maxValue,
    minSelections,
    maxSelections,
    options,
  };

  assertServiceFieldKindCompatibility(normalized);
  assertServiceFieldActivationContent(normalized);
  for (const option of options) {
    assertFieldOptionActivationContent(option);
  }
  return normalized;
}

/**
 * @desc Validate an entire service configuration graph before persistence.
 */
export function assertServiceConfigurationGraph(input: {
  readonly priceUnits: readonly Readonly<Record<string, unknown>>[];
  readonly fields: readonly Readonly<Record<string, unknown>>[];
}): {
  readonly priceUnits: readonly NormalizedPriceUnitInput[];
  readonly fields: readonly NormalizedServiceFieldInput[];
} {
  const priceUnits = input.priceUnits.map((unit) => assertPriceUnitInput(unit));
  assertUniqueStableIdentities(
    priceUnits.map((unit) => unit.code),
    { field: "priceUnits.code" },
  );
  for (const unit of priceUnits) {
    assertPriceUnitActivationContent(unit);
  }

  const fields = input.fields.map((field) => assertServiceFieldInput(field));
  assertUniqueStableIdentities(
    fields.map((field) => field.code),
    { field: "fields.code" },
  );

  return { priceUnits, fields };
}

/**
 * @desc Reject price-unit code changes for an existing identity (FR-013).
 */
export function assertImmutablePriceUnitCode(input: {
  readonly currentCode: string;
  readonly requestedCode: string;
}): void {
  assertImmutableStableCode({
    currentCode: input.currentCode,
    requestedCode: input.requestedCode,
    field: "priceUnits.code",
  });
}

/**
 * @desc Reject field code changes for an existing identity (FR-016).
 */
export function assertImmutableFieldCode(input: {
  readonly currentCode: string;
  readonly requestedCode: string;
}): void {
  assertImmutableStableCode({
    currentCode: input.currentCode,
    requestedCode: input.requestedCode,
    field: "fields.code",
  });
}

/**
 * @desc Reject option value changes for an existing identity (FR-018).
 */
export function assertImmutableOptionValue(input: {
  readonly currentValue: string;
  readonly requestedValue: string;
}): void {
  if (input.requestedValue !== input.currentValue) {
    throw new CatalogError(
      "CATALOG_VALIDATION_FAILED",
      "Catalog option value is immutable after creation",
      { details: { field: "options.value" } },
    );
  }
}

export interface SelectablePriceUnit {
  readonly code: string;
  readonly isActive: boolean;
  readonly labelAr: string | null;
  readonly labelEn: string | null;
}

export interface SelectableFieldOption {
  readonly id?: string;
  readonly value: string;
  readonly isActive: boolean;
  readonly labelAr: string | null;
  readonly labelEn: string | null;
}

export interface SelectableServiceField {
  readonly id?: string;
  readonly code: string;
  readonly isActive: boolean;
  readonly labelAr: string | null;
  readonly labelEn: string | null;
  readonly options?: readonly SelectableFieldOption[];
}

function hasCompleteBilingualLabels(
  labelAr: string | null,
  labelEn: string | null,
): boolean {
  return (
    normalizeOptionalLocalizedText(labelAr) !== null &&
    normalizeOptionalLocalizedText(labelEn) !== null
  );
}

function assertActiveFieldGraphComplete(
  fields: readonly SelectableServiceField[],
): void {
  for (const field of fields) {
    if (!field.isActive) {
      continue;
    }
    const missingLabels = (
      [
        ["labelAr", field.labelAr],
        ["labelEn", field.labelEn],
      ] as const
    )
      .filter(([, value]) => normalizeOptionalLocalizedText(value) === null)
      .map(([labelField]) => labelField);
    if (missingLabels.length > 0) {
      throw new CatalogError(
        "CATALOG_ACTIVATION_INCOMPLETE",
        "Catalog field cannot be active without complete Arabic and English labels",
        { details: { missing: missingLabels } },
      );
    }
    for (const option of field.options ?? []) {
      assertFieldOptionActivationContent(option);
    }
  }
}

/**
 * @desc Validate one service lifecycle command including price units and fields.
 * @explanation Activation requires an active parent, exact AR/EN service content,
 * at least one active complete price unit, and complete labels on every active
 * field or option; deactivation permits incomplete drafts.
 */
export interface StoredServiceFieldForActivation {
  readonly code: string;
  readonly kind: ServiceFieldKindCode;
  readonly isRequired: boolean;
  readonly isActive: boolean;
  readonly labelAr: string | null;
  readonly labelEn: string | null;
  readonly helpTextAr: string | null;
  readonly helpTextEn: string | null;
  readonly minLength: number | null;
  readonly maxLength: number | null;
  readonly numberMode: ServiceNumberModeCode | null;
  readonly minValue: string | null;
  readonly maxValue: string | null;
  readonly minSelections: number | null;
  readonly maxSelections: number | null;
  readonly options: readonly {
    readonly value: string;
    readonly isActive: boolean;
    readonly labelAr: string | null;
    readonly labelEn: string | null;
  }[];
}

/**
 * @desc Validate a persisted service graph before activation or while active.
 * @explanation Stored rows must satisfy DEC-042 kind/compatibility rules, not
 * only localized labels, before lifecycle or configuration writes commit.
 */
export function assertActiveServiceStoredConfiguration(input: {
  readonly categoryIsActive: boolean;
  readonly translations: readonly {
    readonly locale: CatalogLocaleCode;
    readonly name: string | null;
    readonly description: string | null;
  }[];
  readonly priceUnits: readonly SelectablePriceUnit[];
  readonly fields: readonly StoredServiceFieldForActivation[];
}): void {
  assertServiceActivationPolicy({
    action: "ACTIVATE",
    categoryIsActive: input.categoryIsActive,
    translations: input.translations,
    priceUnits: input.priceUnits,
    fields: input.fields.map((field) => ({
      code: field.code,
      isActive: field.isActive,
      labelAr: field.labelAr,
      labelEn: field.labelEn,
      options: field.options.map((option) => ({
        value: option.value,
        isActive: option.isActive,
        labelAr: option.labelAr,
        labelEn: option.labelEn,
      })),
    })),
  });

  for (const field of input.fields) {
    if (!field.isActive) {
      continue;
    }
    const options = field.options.map((option) => ({
      value: option.value,
      labelAr: option.labelAr,
      labelEn: option.labelEn,
      isActive: option.isActive,
    }));
    assertServiceFieldKindCompatibility({
      kind: field.kind,
      isRequired: field.isRequired,
      minLength: field.minLength,
      maxLength: field.maxLength,
      numberMode: field.numberMode,
      minValue: field.minValue,
      maxValue: field.maxValue,
      minSelections: field.minSelections,
      maxSelections: field.maxSelections,
      options,
    });
    assertServiceFieldActivationContent({
      kind: field.kind,
      isActive: true,
      labelAr: field.labelAr,
      labelEn: field.labelEn,
      helpTextAr: field.helpTextAr,
      helpTextEn: field.helpTextEn,
      minSelections: field.minSelections,
      maxSelections: field.maxSelections,
      options,
    });
  }
}

export function assertServiceActivationPolicy(input: {
  readonly action: CatalogLifecycleAction;
  readonly categoryIsActive: boolean;
  readonly translations: readonly {
    readonly locale: CatalogLocaleCode;
    readonly name: string | null;
    readonly description: string | null;
  }[];
  readonly priceUnits: readonly SelectablePriceUnit[];
  readonly fields: readonly SelectableServiceField[];
}): void {
  if (input.action === "DEACTIVATE") {
    return;
  }
  if (!input.categoryIsActive) {
    throw new CatalogError(
      "CATALOG_ACTIVATION_INCOMPLETE",
      "Catalog service cannot be active under an inactive category",
      { details: { reason: "PARENT_CATEGORY_INACTIVE" } },
    );
  }
  assertServiceActivationContent({
    isActive: true,
    translations: input.translations,
  });

  const hasActiveCompleteUnit = input.priceUnits.some(
    (unit) => unit.isActive && hasCompleteBilingualLabels(unit.labelAr, unit.labelEn),
  );
  if (!hasActiveCompleteUnit) {
    throw new CatalogError(
      "CATALOG_ACTIVATION_INCOMPLETE",
      "Catalog service cannot be active without at least one active complete price unit",
    );
  }

  assertActiveFieldGraphComplete(input.fields);
}

/**
 * @desc Return only active price units, fields, and field options in input order.
 * @explanation Selectable reads must never expose inactive draft children even
 * when the parent service itself remains selectable.
 */
export function listSelectableChildren(input: {
  readonly priceUnits: readonly SelectablePriceUnit[];
  readonly fields: readonly SelectableServiceField[];
}): {
  readonly priceUnits: readonly SelectablePriceUnit[];
  readonly fields: readonly (SelectableServiceField & {
    readonly options: readonly SelectableFieldOption[];
  })[];
} {
  return {
    priceUnits: input.priceUnits.filter((unit) => unit.isActive),
    fields: input.fields
      .filter((field) => field.isActive)
      .map((field) => ({
        ...field,
        options: (field.options ?? []).filter((option) => option.isActive),
      })),
  };
}

/**
 * @desc Resolve one exact locale translation without cross-locale fallback.
 * @explanation A missing or blank requested locale fails safely rather than
 * silently substituting the other language (DEC-041).
 */
export function resolveExactLocaleContent(input: {
  readonly translations: readonly {
    readonly locale: CatalogLocaleCode;
    readonly name: string | null;
    readonly description: string | null;
  }[];
  readonly locale: CatalogLocaleCode;
}): { readonly name: string; readonly description: string } {
  const translation = input.translations.find(
    (row) => row.locale === input.locale,
  );
  const name = normalizeOptionalLocalizedText(translation?.name ?? null);
  const description = normalizeOptionalLocalizedText(
    translation?.description ?? null,
  );
  if (name === null || description === null) {
    throw new CatalogError(
      "CATALOG_ACTIVATION_INCOMPLETE",
      "Catalog content is missing a required locale",
      { details: { missingLocales: [input.locale] } },
    );
  }
  return { name, description };
}

function isActiveChildGraphSelectable(
  fields: readonly SelectableServiceField[],
): boolean {
  for (const field of fields) {
    if (!field.isActive) {
      continue;
    }
    if (!hasCompleteBilingualLabels(field.labelAr, field.labelEn)) {
      return false;
    }
    for (const option of field.options ?? []) {
      if (!option.isActive) {
        continue;
      }
      if (!hasCompleteBilingualLabels(option.labelAr, option.labelEn)) {
        return false;
      }
    }
  }
  return true;
}

/**
 * @desc Decide whether a service is selectable for one exact locale and country.
 * @explanation All activation, availability, locale, price-unit, and active-child
 * gates must pass; incomplete drafts return false instead of throwing.
 */
export function isServiceSelectable(input: {
  readonly countryIsAuthoritativeAndActive: boolean;
  readonly categoryIsActive: boolean;
  readonly serviceIsActive: boolean;
  readonly countryAvailabilityIsAvailable: boolean;
  readonly requestedLocale: CatalogLocaleCode;
  readonly translations: readonly {
    readonly locale: CatalogLocaleCode;
    readonly name: string | null;
    readonly description: string | null;
  }[];
  readonly priceUnits: readonly SelectablePriceUnit[];
  readonly fields: readonly SelectableServiceField[];
}): boolean {
  if (
    !input.countryIsAuthoritativeAndActive ||
    !input.categoryIsActive ||
    !input.serviceIsActive ||
    !input.countryAvailabilityIsAvailable
  ) {
    return false;
  }

  try {
    resolveExactLocaleContent({
      translations: input.translations,
      locale: input.requestedLocale,
    });
  } catch {
    return false;
  }

  let hasActiveUnit = false;
  for (const unit of input.priceUnits) {
    if (!unit.isActive) {
      continue;
    }
    hasActiveUnit = true;
    if (!hasCompleteBilingualLabels(unit.labelAr, unit.labelEn)) {
      return false;
    }
  }
  if (!hasActiveUnit) {
    return false;
  }

  return isActiveChildGraphSelectable(input.fields);
}

/**
 * @desc Resolve one authoritative active country for Catalog availability writes.
 * @explanation Catalog never invents Country rows; inactive or unknown codes map
 * to a safe Catalog error without mutating Configuration-owned facts.
 */
export async function resolveCatalogCountryForAvailability(
  reader: ActiveCountryReader,
  countryCode: string,
): Promise<ActiveCountry> {
  try {
    return await reader.resolveActiveCountry(countryCode);
  } catch {
    throw new CatalogError(
      "CATALOG_COUNTRY_UNAVAILABLE",
      "Catalog country is unavailable for availability operations",
      { details: { countryCode } },
    );
  }
}

/**
 * @desc Reject client-supplied country identity or activation facts.
 * @explanation Only a stable country code may be accepted; Catalog never trusts
 * request bodies for country IDs or active/inactive state.
 */
export function assertNoClientInventedCountryFacts(input: {
  readonly countryCode: string;
  readonly countryId?: string;
  readonly active?: boolean;
  readonly isActive?: boolean;
}): void {
  if (
    input.countryId !== undefined ||
    input.active !== undefined ||
    input.isActive !== undefined
  ) {
    throw new CatalogError(
      "CATALOG_VALIDATION_FAILED",
      "Catalog availability commands must not supply client-invented country facts",
      { details: { countryCode: input.countryCode } },
    );
  }
}

export const CATALOG_ORDER_SCOPES = [
  "CATEGORY",
  "SERVICE",
  "CHILD",
  "MEDIA",
] as const;
export type CatalogOrderScope = (typeof CATALOG_ORDER_SCOPES)[number];

/**
 * @desc Produce contiguous zero-based display positions for one ordered count.
 */
export function contiguousDisplayOrders(count: number): readonly number[] {
  return Array.from({ length: count }, (_, index) => index);
}

/**
 * @desc Validate one full exact-set order replacement with optimistic versions.
 * @explanation The payload must cover the current identity set exactly once,
 * match every expected version, and normalize to contiguous zero-based positions.
 */
export function assertExactOrderReplacement(input: {
  readonly scope: CatalogOrderScope;
  readonly items: readonly {
    readonly id: string;
    readonly expectedVersion: number;
  }[];
  readonly current: ReadonlyMap<string, number>;
}): { readonly orderedIds: readonly string[]; readonly positions: readonly number[] } {
  const expectedIds = new Set(input.current.keys());
  if (input.items.length !== expectedIds.size) {
    throw new CatalogError(
      "CATALOG_ORDER_INVALID",
      "Catalog order vector does not cover the exact identity set",
      { details: { scope: input.scope } },
    );
  }

  const seen = new Set<string>();
  for (const item of input.items) {
    if (!expectedIds.has(item.id) || seen.has(item.id)) {
      throw new CatalogError(
        "CATALOG_ORDER_INVALID",
        "Catalog order vector repeats or omits an identity",
        { details: { scope: input.scope } },
      );
    }
    seen.add(item.id);

    const currentVersion = input.current.get(item.id);
    if (currentVersion !== item.expectedVersion) {
      throw new CatalogError(
        "CATALOG_VERSION_CONFLICT",
        "Catalog order replacement expected a stale version",
        {
          details: {
            scope: input.scope,
            id: item.id,
            expectedVersion: item.expectedVersion,
            currentVersion,
          },
        },
      );
    }
  }

  const orderedIds = input.items.map((item) => item.id);
  return {
    orderedIds,
    positions: contiguousDisplayOrders(orderedIds.length),
  };
}

/** DEC-044 approved Egypt housekeeping seed identities (FR-047–FR-049). */
export const EGYPT_HOUSEKEEPING_SEED = {
  category: {
    code: "HOME_CLEANING",
    nameEn: "Home Cleaning",
    nameAr: "تنظيف المنازل",
    descriptionEn: "Home cleaning and housekeeping services.",
    descriptionAr: "خدمات تنظيف المنازل والتدبير المنزلي.",
    displayOrder: 0,
    isActive: true,
  },
  service: {
    code: "STANDARD_HOME_CLEANING",
    categoryCode: "HOME_CLEANING",
    nameEn: "Standard Home Cleaning",
    nameAr: "تنظيف منزلي قياسي",
    descriptionEn: "Routine cleaning for a home.",
    descriptionAr: "تنظيف دوري للمنزل.",
    displayOrder: 0,
    isActive: true,
  },
  priceUnits: [
    {
      code: "PER_VISIT",
      labelEn: "Per visit",
      labelAr: "لكل زيارة",
      displayOrder: 0,
      isActive: true,
    },
    {
      code: "PER_HOUR",
      labelEn: "Per hour",
      labelAr: "لكل ساعة",
      displayOrder: 1,
      isActive: true,
    },
  ],
  fields: [
    {
      code: "PREPARATION_INFORMATION",
      kind: "INFORMATION" as const,
      labelEn: "Review the service details before booking.",
      labelAr: "راجع تفاصيل الخدمة قبل الحجز.",
      isRequired: false,
      isActive: true,
      displayOrder: 0,
      numberMode: null,
      minValue: null,
      maxValue: null,
      minLength: null,
      maxLength: null,
    },
    {
      code: "BEDROOM_COUNT",
      kind: "NUMBER" as const,
      labelEn: "Number of bedrooms",
      labelAr: "عدد غرف النوم",
      isRequired: false,
      isActive: true,
      displayOrder: 1,
      numberMode: "INTEGER" as const,
      minValue: "0",
      maxValue: null,
      minLength: null,
      maxLength: null,
    },
    {
      code: "BATHROOM_COUNT",
      kind: "NUMBER" as const,
      labelEn: "Number of bathrooms",
      labelAr: "عدد الحمامات",
      isRequired: false,
      isActive: true,
      displayOrder: 2,
      numberMode: "INTEGER" as const,
      minValue: "0",
      maxValue: null,
      minLength: null,
      maxLength: null,
    },
    {
      code: "PETS_PRESENT",
      kind: "BOOLEAN" as const,
      labelEn: "Are pets present?",
      labelAr: "هل توجد حيوانات أليفة؟",
      isRequired: false,
      isActive: true,
      displayOrder: 3,
      numberMode: null,
      minValue: null,
      maxValue: null,
      minLength: null,
      maxLength: null,
    },
    {
      code: "SPECIAL_INSTRUCTIONS",
      kind: "TEXT" as const,
      labelEn: "Special instructions",
      labelAr: "تعليمات خاصة",
      isRequired: false,
      isActive: true,
      displayOrder: 4,
      numberMode: null,
      minValue: null,
      maxValue: null,
      minLength: null,
      maxLength: 1000,
    },
  ],
  availability: {
    countryCode: "EG",
    isAvailable: true,
  },
  counts: {
    categories: 1,
    services: 1,
    priceUnits: 2,
    fields: 5,
    availabilities: 1,
    media: 0,
  },
} as const;

export type CatalogSeedRowAction = "CREATE" | "PRESERVE";

export type CatalogSeedExistingRow = {
  readonly code: string;
  readonly isActive: boolean;
  readonly version: number;
} & Record<string, unknown>;

/**
 * @desc Decide whether one DEC-044 seed row should be created or preserved.
 * @explanation Missing stable-code rows may be created once; existing owner-managed
 * facts are never rewritten, reactivated, or overwritten by seed policy.
 */
export function decideCatalogSeedRowAction(input: {
  readonly stableCode: string;
  readonly existing: CatalogSeedExistingRow | null;
}): CatalogSeedRowAction {
  return input.existing === null ? "CREATE" : "PRESERVE";
}
