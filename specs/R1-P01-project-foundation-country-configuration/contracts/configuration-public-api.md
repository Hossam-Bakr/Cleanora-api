# Contract — Configuration Module Public API

**Phase**: R1-P01  
**Owner module**: `configuration`  
**Entry**: `src/modules/configuration/index.ts` only  
**Consumers**: Future modules (e.g. identity in R1-P02) via `#modules/configuration`  
**Persistence**: Private to module repositories — raw Prisma models MUST NOT be exported

## Types (conceptual)

```ts
type ConfigResolutionPolicy =
  | "GLOBAL_ONLY"
  | "COUNTRY_OVERRIDE_WITH_GLOBAL_FALLBACK"
  | "COUNTRY_REQUIRED";

type ConfigSource = "global" | "country";

interface EffectiveConfig<T = unknown> {
  key: string;
  value: T;
  source: ConfigSource;
  resolutionPolicy: ConfigResolutionPolicy;
  countryCode?: string;
}

interface CountryRecord {
  code: string;
  nameEn: string;
  nameAr: string;
  defaultCurrencyCode: string;
  defaultLocale: string;
  supportedLocales: string[];
  isActive: boolean;
}

interface CurrencyRecord {
  code: string;
  nameEn: string;
  nameAr: string;
  decimalPlaces: number;
  isActive: boolean;
}
```

## Required operations

| Operation | Behavior |
|---|---|
| `getCountryByCode(code)` | Return active/known country DTO or fail `COUNTRY_UNAVAILABLE` |
| `getCurrencyByCode(code)` | Return currency DTO or fail explicitly if unknown/inactive when required |
| `resolveEffectiveConfig(key, countryCode?)` | Apply per-key policy; return `EffectiveConfig`; fail explicitly on unknown key, invalid country, missing required values, rejected overrides, invalid types |
| `assertCountryCurrencySupported(countryCode)` | Fail if country inactive/unsupported or default currency inactive/unsupported |

## Resolution rules (normative)

See clarification Option C and `data-model.md` Effective configuration algorithm. Summary:

1. Unknown key → fail.
2. Unknown/inactive/unsupported `countryCode` when required by policy or caller → fail.
3. `GLOBAL_ONLY` → global only; country override rejected.
4. `COUNTRY_OVERRIDE_WITH_GLOBAL_FALLBACK` → country, else global, else fail.
5. `COUNTRY_REQUIRED` → country value required; no silent global substitute.
6. Return value **and** `source` / `resolutionPolicy`.

## Forbidden

- Exporting Prisma clients, models, or repository classes.
- Hard-coding Egypt (`EG`) branches inside consumer business logic (seed/config only).
- Storing credentials/secrets in config values.
- Direct SQL/Prisma access to configuration tables from other modules.

## Testing expectations

- Unit: pure resolution matrix for all three policies.
- Integration: repository + public API against database with Egypt seed.
- Consumer-style test imports only from `#modules/configuration`.
