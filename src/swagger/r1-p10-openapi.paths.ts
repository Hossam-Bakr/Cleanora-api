/**
 * R1-P10 runtime OpenAPI path/schema contributions for protected Staff
 * localities/time-zone and Provider availability management. Exactly 19
 * operations; no customer, Browse, Booking, or reservation evaluation paths.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const yaml = require("js-yaml") as {
  load: (input: string) => unknown;
};

export const R1_P10_OPENAPI_SOURCE_PATH = resolve(
  process.cwd(),
  "docs/apis/openapi/r1-p10-availability-capacity-textual-coverage.yaml",
);

export const R1_P10_OPENAPI_STAFF_LOCALITIES_TAG = "Staff Localities";
export const R1_P10_OPENAPI_STAFF_TIME_ZONE_TAG = "Staff Country Time Zone";
export const R1_P10_OPENAPI_PROVIDER_TAG = "Provider Availability";

/** Staff Configuration paths under `/staff/configuration`. */
export const R1_P10_STAFF_PATH_PREFIX = "/staff/configuration";

/** Provider availability paths under `/providers/.../availability`. */
export const R1_P10_PROVIDER_PATH_PREFIX = "/providers";

type HttpMethod =
  | "get"
  | "post"
  | "put"
  | "patch"
  | "delete"
  | "options"
  | "head"
  | "trace";

interface OpenApiDocumentLike {
  readonly paths?: Readonly<Record<string, Record<string, unknown>>>;
  readonly components?: {
    readonly schemas?: Readonly<Record<string, unknown>>;
    readonly parameters?: Readonly<Record<string, unknown>>;
    readonly responses?: Readonly<Record<string, unknown>>;
    readonly requestBodies?: Readonly<Record<string, unknown>>;
    readonly securitySchemes?: Readonly<Record<string, unknown>>;
  };
  readonly tags?: readonly {
    readonly name: string;
    readonly description?: string;
  }[];
}

const HTTP_METHODS = new Set<string>([
  "get",
  "post",
  "put",
  "patch",
  "delete",
]);

/**
 * Load the R1-P10 YAML source contract from docs/apis/openapi.
 */
export function loadR1P10OpenApiSource(): OpenApiDocumentLike {
  const raw = readFileSync(R1_P10_OPENAPI_SOURCE_PATH, "utf8");
  return yaml.load(raw) as OpenApiDocumentLike;
}

/**
 * True when the OpenAPI path belongs to the protected R1-P10 surface.
 */
export function isR1P10ProtectedPath(path: string): boolean {
  if (path.startsWith("/staff/configuration/")) {
    return (
      /\/staff\/configuration\/countries\/\{countryId\}\/cities$/u.test(path) ||
      /\/staff\/configuration\/cities\/\{cityId\}$/u.test(path) ||
      /\/staff\/configuration\/cities\/\{cityId\}\/districts$/u.test(path) ||
      /\/staff\/configuration\/districts\/\{districtId\}$/u.test(path) ||
      /\/staff\/configuration\/countries\/\{countryId\}\/time-zone$/u.test(path)
    );
  }
  return (
    /\/providers\/\{providerId\}\/availability\/coverage$/u.test(path) ||
    /\/providers\/\{providerId\}\/availability\/calendar$/u.test(path) ||
    /\/providers\/\{providerId\}\/availability\/workers\/\{workerId\}\/calendar$/u.test(
      path,
    ) ||
    /\/providers\/\{providerId\}\/availability\/capacity$/u.test(path) ||
    /\/providers\/\{providerId\}\/availability\/pause$/u.test(path) ||
    /\/providers\/\{providerId\}\/availability\/pause\/resume$/u.test(path)
  );
}

export const R1_P10_OPENAPI_OPERATIONS = [
  "listStaffCities",
  "createStaffCity",
  "patchStaffCity",
  "listStaffDistricts",
  "createStaffDistrict",
  "patchStaffDistrict",
  "getStaffCountryTimeZone",
  "putStaffCountryTimeZone",
  "getProviderCoverage",
  "replaceProviderCoverage",
  "getProviderCalendar",
  "replaceProviderCalendar",
  "getWorkerCalendar",
  "replaceWorkerCalendar",
  "getProviderCapacity",
  "replaceProviderCapacity",
  "getProviderPause",
  "startProviderPause",
  "resumeProviderPause",
] as const;

export const R1_P10_RUNTIME_HAS_NO_CUSTOMER_EVALUATION = true as const;

function filterHttpOperations(
  paths: Readonly<Record<string, Record<string, unknown>>>,
): Record<string, Record<string, unknown>> {
  return Object.fromEntries(
    Object.entries(paths).map(([path, item]) => [
      path,
      Object.fromEntries(
        Object.entries(item).filter(([method]) =>
          HTTP_METHODS.has(method as HttpMethod),
        ),
      ),
    ]),
  );
}

/**
 * Count every HTTP operation in an OpenAPI paths object.
 */
export function countR1P10OpenApiOperations(
  paths: Readonly<Record<string, Record<string, unknown>>>,
): number {
  let count = 0;
  for (const item of Object.values(paths)) {
    for (const method of Object.keys(item)) {
      if (HTTP_METHODS.has(method)) {
        count += 1;
      }
    }
  }
  return count;
}

/**
 * Build runtime Swagger fragments from the Phase 10 YAML source.
 */
export function buildImplementedR1P10SwaggerFragments(): {
  readonly tags: readonly {
    readonly name: string;
    readonly description: string;
  }[];
  readonly paths: Record<string, unknown>;
  readonly parameters: Record<string, unknown>;
  readonly schemas: Record<string, unknown>;
  readonly responses: Record<string, unknown>;
} {
  const source = loadR1P10OpenApiSource();
  const paths = filterHttpOperations(source.paths ?? {});
  const operationCount = countR1P10OpenApiOperations(paths);
  if (operationCount !== R1_P10_OPENAPI_OPERATIONS.length) {
    throw new Error(
      `R1-P10 OpenAPI/runtime inventory drift: expected ${String(R1_P10_OPENAPI_OPERATIONS.length)} operations, received ${String(operationCount)}`,
    );
  }
  for (const path of Object.keys(paths)) {
    if (!isR1P10ProtectedPath(path)) {
      throw new Error(`R1-P10 OpenAPI contains unexpected path ${path}`);
    }
  }
  return {
    tags: (source.tags ?? []).map((tag) => ({
      name: tag.name,
      description:
        tag.description ??
        `R1-P10 ${tag.name} protected management operations.`,
    })),
    paths,
    parameters: { ...(source.components?.parameters ?? {}) },
    schemas: { ...(source.components?.schemas ?? {}) },
    responses: { ...(source.components?.responses ?? {}) },
  };
}
