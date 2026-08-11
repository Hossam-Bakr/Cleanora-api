import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const yaml = require("js-yaml") as {
  load: (input: string) => unknown;
};

/**
 * Absolute path to the R1-P05 source OpenAPI contract synchronized into runtime Swagger.
 */
export const R1_P05_OPENAPI_SOURCE_PATH = resolve(
  process.cwd(),
  "docs/apis/openapi/r1-p05-provider-onboarding-profile-lifecycle.yaml",
);

/**
 * Provider HTTP operations currently mounted by R1-P05 composition/routes.
 */
export const R1_P05_IMPLEMENTED_OPERATIONS = [
  "POST /providers",
  "GET /providers",
  "GET /providers/{providerId}",
  "PATCH /providers/{providerId}/kind",
  "POST /providers/{providerId}/application/submit",
  "GET /providers/{providerId}/profile",
  "PUT /providers/{providerId}/profile",
  "GET /providers/{providerId}/contacts",
  "PUT /providers/{providerId}/contacts",
  "GET /providers/{providerId}/preview",
  "GET /providers/{providerId}/media",
  "PUT /providers/{providerId}/media/logo",
  "DELETE /providers/{providerId}/media/logo",
  "PUT /providers/{providerId}/media/cover",
  "DELETE /providers/{providerId}/media/cover",
  "POST /providers/{providerId}/media/gallery-images",
  "POST /providers/{providerId}/media/gallery-videos",
  "PUT /providers/{providerId}/media/gallery-order",
  "DELETE /providers/{providerId}/media/gallery/{galleryItemId}",
  "GET /providers/{providerId}/completion",
  "GET /providers/{providerId}/readiness",
  "GET /providers/{providerId}/history",
  "GET /providers/{providerId}/dashboard",
  "GET /providers/{providerId}/settings",
  "GET /providers/{providerId}/members",
  "DELETE /providers/{providerId}/members/{userId}",
  "GET /providers/{providerId}/admin-invitations",
  "POST /providers/{providerId}/admin-invitations",
  "POST /providers/{providerId}/admin-invitations/{invitationId}/resend",
  "POST /providers/{providerId}/admin-invitations/{invitationId}/revoke",
  "POST /provider-admin-invitations/inspect",
  "POST /provider-admin-invitations/onboarding/start",
  "POST /provider-admin-invitations/onboarding/verify-email",
  "POST /provider-admin-invitations/accept",
  "GET /staff/providers/applications",
  "GET /staff/providers/applications/{providerId}",
  "POST /staff/providers/applications/{providerId}/approve",
  "POST /staff/providers/applications/{providerId}/request-changes",
  "POST /staff/providers/applications/{providerId}/reject",
  "POST /staff/providers/{providerId}/suspend",
  "POST /staff/providers/{providerId}/reinstate",
] as const;

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
  readonly tags?: readonly { readonly name: string }[];
}

function operationKey(method: string, path: string): string {
  return `${method.toUpperCase()} ${path}`;
}

/**
 * Load the R1-P05 YAML source contract from docs/apis/openapi.
 */
export function loadR1P05OpenApiSource(): OpenApiDocumentLike {
  const raw = readFileSync(R1_P05_OPENAPI_SOURCE_PATH, "utf8");
  return yaml.load(raw) as OpenApiDocumentLike;
}

/**
 * Count every HTTP operation in an OpenAPI paths object.
 */
export function countOpenApiOperations(
  paths: Readonly<Record<string, Record<string, unknown>>> | undefined,
): number {
  if (paths === undefined) {
    return 0;
  }
  let count = 0;
  for (const pathItem of Object.values(paths)) {
    for (const method of Object.keys(pathItem)) {
      if (
        ["get", "post", "put", "patch", "delete", "options", "head"].includes(
          method,
        )
      ) {
        count += 1;
      }
    }
  }
  return count;
}

/**
 * Build the implemented Provider path map and supporting component fragments
 * for merge into the living Swagger document.
 */
export function buildImplementedR1P05SwaggerFragments(): {
  readonly paths: Record<string, Record<string, unknown>>;
  readonly tags: readonly { readonly name: string; readonly description: string }[];
  readonly schemas: Record<string, unknown>;
  readonly parameters: Record<string, unknown>;
  readonly responses: Record<string, unknown>;
  readonly requestBodies: Record<string, unknown>;
  readonly operationCount: number;
} {
  const source = loadR1P05OpenApiSource();
  const allowed = new Set<string>(R1_P05_IMPLEMENTED_OPERATIONS);
  const paths: Record<string, Record<string, unknown>> = {};

  for (const [path, pathItem] of Object.entries(source.paths ?? {})) {
    const filtered: Record<string, unknown> = {};
    for (const [method, operation] of Object.entries(pathItem)) {
      if (
        !["get", "post", "put", "patch", "delete"].includes(method) ||
        !allowed.has(operationKey(method, path))
      ) {
        continue;
      }
      filtered[method as HttpMethod] = operation;
    }
    if (Object.keys(filtered).length > 0) {
      paths[path] = filtered;
    }
  }

  const reservedSchemas = new Set([
    "SuccessEnvelope",
    "ErrorEnvelope",
    "VersionRequest",
  ]);
  const schemas: Record<string, unknown> = {};
  for (const [name, schema] of Object.entries(source.components?.schemas ?? {})) {
    if (reservedSchemas.has(name)) {
      continue;
    }
    schemas[name] = schema;
  }

  return {
    paths,
    tags: [
      {
        name: "Providers",
        description: "Authenticated Provider application, profile, and media APIs.",
      },
      {
        name: "ProviderMedia",
        description: "Provider logo, cover, and gallery media operations.",
      },
      {
        name: "ProviderMembers",
        description: "Post-approval Provider OWNER/ADMIN membership management.",
      },
      {
        name: "ProviderInvitations",
        description: "Provider Admin invitation create/resend/revoke and token flows.",
      },
      {
        name: "StaffProviders",
        description: "Staff Admin review queue and operational lifecycle commands.",
      },
    ],
    schemas,
    parameters: { ...(source.components?.parameters ?? {}) },
    responses: { ...(source.components?.responses ?? {}) },
    requestBodies: { ...(source.components?.requestBodies ?? {}) },
    operationCount: countOpenApiOperations(paths),
  };
}
