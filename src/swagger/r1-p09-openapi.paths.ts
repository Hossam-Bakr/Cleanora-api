/**
 * R1-P09 runtime OpenAPI path/schema contributions for protected Provider
 * service management and Staff price approval. Exactly 11 operations; no
 * anonymous Browse or Booking paths.
 */

export const R1_P09_OPENAPI_PROVIDER_TAG = "Provider Services";
export const R1_P09_OPENAPI_STAFF_TAG = "Staff Provider Service Prices";

/** Provider management paths under `/providers/.../services`. */
export const R1_P09_PROVIDER_PATH_PREFIX = "/providers";

/** Staff approval paths under `/staff/providers`. */
export const R1_P09_STAFF_PATH_PREFIX = "/staff/providers";

const MONETARY_STRING_PATTERN = "^(?:0|[1-9][0-9]*)(?:\\.[0-9]+)?$";

const createCommandProperties = {
  expectedVersion: { type: "integer", const: 0 },
  idempotencyKey: { type: "string", format: "uuid" },
} as const;

const versionedCommandProperties = {
  expectedVersion: { type: "integer", minimum: 1 },
  idempotencyKey: { type: "string", format: "uuid" },
} as const;

const catalogServiceRefSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "code", "version", "selectableForProviderCountry"],
  properties: {
    id: { type: "string" },
    code: { type: "string" },
    version: { type: "integer", minimum: 1 },
    selectableForProviderCountry: { type: "boolean" },
  },
} as const;

const catalogPriceUnitRefSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "codeAtProposal"],
  properties: {
    id: { type: "string" },
    codeAtProposal: { type: "string" },
  },
} as const;

const usabilitySchema = {
  type: "object",
  additionalProperties: false,
  required: ["usable", "blockerCodes"],
  properties: {
    usable: { type: "boolean" },
    blockerCodes: {
      type: "array",
      items: { type: "string" },
    },
  },
} as const;

const notesSchema = {
  type: "object",
  additionalProperties: false,
  required: ["ar", "en"],
  properties: {
    ar: { type: ["string", "null"] },
    en: { type: ["string", "null"] },
  },
} as const;

const priceManagementDtoSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "status",
    "catalogPriceUnit",
    "currencyCode",
    "currencyDecimalPlaces",
    "price",
    "minimumCharge",
    "approvalRequiredAtProposal",
    "effectiveAt",
    "rejectedAt",
    "supersededAt",
    "createdAt",
  ],
  properties: {
    id: { type: "string" },
    status: {
      type: "string",
      enum: ["PENDING", "EFFECTIVE", "REJECTED", "SUPERSEDED"],
    },
    catalogPriceUnit: catalogPriceUnitRefSchema,
    currencyCode: { type: "string", pattern: "^[A-Z]{3}$" },
    currencyDecimalPlaces: { type: "integer", minimum: 0, maximum: 6 },
    price: { type: "string", pattern: MONETARY_STRING_PATTERN },
    minimumCharge: { type: "string", pattern: MONETARY_STRING_PATTERN },
    approvalRequiredAtProposal: { type: "boolean" },
    effectiveAt: { type: ["string", "null"], format: "date-time" },
    rejectedAt: { type: ["string", "null"], format: "date-time" },
    supersededAt: { type: ["string", "null"], format: "date-time" },
    createdAt: { type: "string", format: "date-time" },
  },
} as const;

const serviceManagementDtoSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "providerId",
    "catalogService",
    "enabled",
    "estimatedDurationMinutes",
    "notes",
    "version",
    "effectivePrice",
    "pendingPrice",
    "usability",
    "createdAt",
    "updatedAt",
  ],
  properties: {
    id: { type: "string" },
    providerId: { type: "string" },
    catalogService: catalogServiceRefSchema,
    enabled: { type: "boolean" },
    estimatedDurationMinutes: { type: "integer", minimum: 1 },
    notes: notesSchema,
    version: { type: "integer", minimum: 1 },
    effectivePrice: {
      oneOf: [priceManagementDtoSchema, { type: "null" }],
    },
    pendingPrice: {
      oneOf: [priceManagementDtoSchema, { type: "null" }],
    },
    usability: usabilitySchema,
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
} as const;

/**
 * True when the OpenAPI path belongs to the protected R1-P09 surface.
 */
export function isR1P09ProtectedPath(path: string): boolean {
  if (path === "/staff/providers/service-price-proposals") {
    return true;
  }
  if (
    path.startsWith("/staff/providers/") &&
    path.includes("/services/") &&
    path.includes("/price-proposals")
  ) {
    return true;
  }
  return (
    /^\/providers\/\{[^}]+\}\/services(?:\/|$)/u.test(path) ||
    /^\/providers\/[^/]+\/services(?:\/|$)/u.test(path)
  );
}

/** Paths filled for the exact 11 protected Provider/Staff operations. */
export function buildR1P09OpenApiPaths(): Record<string, unknown> {
  const bearer = [{ bearerAuth: [] }];
  const errorResponses = {
    "400": { $ref: "#/components/responses/ApiError" },
    "401": { $ref: "#/components/responses/ApiError" },
    "403": { $ref: "#/components/responses/ApiError" },
    "404": { $ref: "#/components/responses/ApiError" },
    "409": { $ref: "#/components/responses/ApiError" },
    "502": { $ref: "#/components/responses/ApiError" },
    "503": { $ref: "#/components/responses/ApiError" },
  } as const;

  const cursorParams = [
    {
      name: "cursor",
      in: "query",
      required: false,
      schema: { type: "string", minLength: 1 },
    },
    {
      name: "limit",
      in: "query",
      required: false,
      schema: { type: "integer", minimum: 1, maximum: 100, default: 25 },
    },
  ];

  const providerIdParam = {
    name: "providerId",
    in: "path",
    required: true,
    schema: { type: "string" },
  };
  const providerServiceIdParam = {
    name: "providerServiceId",
    in: "path",
    required: true,
    schema: { type: "string" },
  };
  const providerServicePriceIdParam = {
    name: "providerServicePriceId",
    in: "path",
    required: true,
    schema: { type: "string" },
  };

  return {
    "/providers/{providerId}/services": {
      get: {
        tags: [R1_P09_OPENAPI_PROVIDER_TAG],
        operationId: "listProviderServices",
        security: bearer,
        parameters: [providerIdParam, ...cursorParams],
        responses: {
          "200": {
            description:
              "Exact-Provider offering list ordered by (createdAt, id)",
          },
          "401": errorResponses["401"],
          "403": errorResponses["403"],
        },
      },
      post: {
        tags: [R1_P09_OPENAPI_PROVIDER_TAG],
        operationId: "createProviderService",
        security: bearer,
        parameters: [providerIdParam],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/R1P09CreateProviderServiceCommand",
              },
            },
          },
        },
        responses: {
          "201": { description: "Disabled offering created with initial price" },
          "200": { description: "Idempotent replay of the same create" },
          ...errorResponses,
        },
      },
    },
    "/providers/{providerId}/services/{providerServiceId}": {
      get: {
        tags: [R1_P09_OPENAPI_PROVIDER_TAG],
        operationId: "getProviderService",
        security: bearer,
        parameters: [providerIdParam, providerServiceIdParam],
        responses: {
          "200": { description: "Exact-Provider management detail" },
          "401": errorResponses["401"],
          "403": errorResponses["403"],
          "404": errorResponses["404"],
        },
      },
    },
    "/providers/{providerId}/services/{providerServiceId}/configuration": {
      put: {
        tags: [R1_P09_OPENAPI_PROVIDER_TAG],
        operationId: "replaceProviderServiceConfiguration",
        security: bearer,
        parameters: [providerIdParam, providerServiceIdParam],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/R1P09ReplaceProviderServiceConfigurationCommand",
              },
            },
          },
        },
        responses: {
          "200": {
            description:
              "Duration and optional notes replaced without mutating price",
          },
          ...errorResponses,
        },
      },
    },
    "/providers/{providerId}/services/{providerServiceId}/price-proposals": {
      post: {
        tags: [R1_P09_OPENAPI_PROVIDER_TAG],
        operationId: "proposeProviderServicePrice",
        security: bearer,
        parameters: [providerIdParam, providerServiceIdParam],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/R1P09ProposeProviderServicePriceCommand",
              },
            },
          },
        },
        responses: {
          "201": { description: "Retained price proposal accepted" },
          "200": { description: "Idempotent replay of the same proposal" },
          ...errorResponses,
        },
      },
    },
    "/providers/{providerId}/services/{providerServiceId}/lifecycle": {
      post: {
        tags: [R1_P09_OPENAPI_PROVIDER_TAG],
        operationId: "changeProviderServiceLifecycle",
        security: bearer,
        parameters: [providerIdParam, providerServiceIdParam],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/R1P09ProviderServiceLifecycleCommand",
              },
            },
          },
        },
        responses: {
          "200": { description: "Offering enabled or disabled" },
          ...errorResponses,
        },
      },
    },
    "/providers/{providerId}/services/{providerServiceId}/price-history": {
      get: {
        tags: [R1_P09_OPENAPI_PROVIDER_TAG],
        operationId: "listProviderServicePriceHistory",
        security: bearer,
        parameters: [providerIdParam, providerServiceIdParam, ...cursorParams],
        responses: {
          "200": {
            description:
              "Authorized price history excluding receipt hashes and audit internals",
          },
          "401": errorResponses["401"],
          "403": errorResponses["403"],
          "404": errorResponses["404"],
        },
      },
    },
    "/providers/{providerId}/services/{providerServiceId}/status-history": {
      get: {
        tags: [R1_P09_OPENAPI_PROVIDER_TAG],
        operationId: "listProviderServiceStatusHistory",
        security: bearer,
        parameters: [providerIdParam, providerServiceIdParam, ...cursorParams],
        responses: {
          "200": {
            description:
              "OFFERING_ENABLED / OFFERING_DISABLED status history only",
          },
          "401": errorResponses["401"],
          "403": errorResponses["403"],
          "404": errorResponses["404"],
        },
      },
    },
    "/staff/providers/service-price-proposals": {
      get: {
        tags: [R1_P09_OPENAPI_STAFF_TAG],
        operationId: "listStaffPendingServicePriceProposals",
        security: bearer,
        parameters: [
          {
            name: "countryCode",
            in: "query",
            required: false,
            schema: { type: "string", pattern: "^[A-Z]{2}$" },
          },
          ...cursorParams,
        ],
        responses: {
          "200": {
            description: "Pending proposals only, ordered by (createdAt, id)",
          },
          "401": errorResponses["401"],
          "403": errorResponses["403"],
        },
      },
    },
    "/staff/providers/{providerId}/services/{providerServiceId}/price-proposals/{providerServicePriceId}":
      {
        get: {
          tags: [R1_P09_OPENAPI_STAFF_TAG],
          operationId: "getStaffPendingServicePriceProposal",
          security: bearer,
          parameters: [
            providerIdParam,
            providerServiceIdParam,
            providerServicePriceIdParam,
          ],
          responses: {
            "200": {
              description:
                "Staff-safe pending dossier plus current effective price when present",
            },
            "401": errorResponses["401"],
            "403": errorResponses["403"],
            "404": errorResponses["404"],
            "409": errorResponses["409"],
          },
        },
      },
    "/staff/providers/{providerId}/services/{providerServiceId}/price-proposals/{providerServicePriceId}/decisions":
      {
        post: {
          tags: [R1_P09_OPENAPI_STAFF_TAG],
          operationId: "decideStaffServicePriceProposal",
          security: bearer,
          parameters: [
            providerIdParam,
            providerServiceIdParam,
            providerServicePriceIdParam,
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/R1P09StaffPriceDecisionCommand",
                },
              },
            },
          },
          responses: {
            "200": {
              description:
                "Staff approve/reject decision or matching completed replay",
            },
            ...errorResponses,
          },
        },
      },
  };
}

export function buildR1P09OpenApiComponents(): {
  readonly schemas: Record<string, unknown>;
  readonly parameters: Record<string, unknown>;
} {
  return {
    parameters: {
      R1P09ProviderId: {
        name: "providerId",
        in: "path",
        required: true,
        schema: { type: "string" },
      },
      R1P09ProviderServiceId: {
        name: "providerServiceId",
        in: "path",
        required: true,
        schema: { type: "string" },
      },
      R1P09ProviderServicePriceId: {
        name: "providerServicePriceId",
        in: "path",
        required: true,
        schema: { type: "string" },
      },
    },
    schemas: {
      R1P09ProviderServiceManagementDto: serviceManagementDtoSchema,
      R1P09ProviderServicePriceManagementDto: priceManagementDtoSchema,
      R1P09CreateProviderServiceCommand: {
        type: "object",
        additionalProperties: false,
        required: [
          "catalogServiceCode",
          "catalogPriceUnitId",
          "price",
          "minimumCharge",
          "estimatedDurationMinutes",
          "expectedVersion",
          "idempotencyKey",
        ],
        properties: {
          catalogServiceCode: {
            type: "string",
            pattern: "^[A-Z][A-Z0-9_]*$",
            minLength: 2,
            maxLength: 100,
          },
          catalogPriceUnitId: { type: "string", minLength: 1 },
          price: { type: "string", pattern: MONETARY_STRING_PATTERN },
          minimumCharge: { type: "string", pattern: MONETARY_STRING_PATTERN },
          estimatedDurationMinutes: { type: "integer", minimum: 1 },
          noteAr: { type: ["string", "null"], maxLength: 1000 },
          noteEn: { type: ["string", "null"], maxLength: 1000 },
          ...createCommandProperties,
        },
      },
      R1P09ReplaceProviderServiceConfigurationCommand: {
        type: "object",
        additionalProperties: false,
        required: ["estimatedDurationMinutes", "expectedVersion", "idempotencyKey"],
        properties: {
          estimatedDurationMinutes: { type: "integer", minimum: 1 },
          noteAr: { type: ["string", "null"], maxLength: 1000 },
          noteEn: { type: ["string", "null"], maxLength: 1000 },
          ...versionedCommandProperties,
        },
      },
      R1P09ProposeProviderServicePriceCommand: {
        type: "object",
        additionalProperties: false,
        required: [
          "catalogPriceUnitId",
          "price",
          "minimumCharge",
          "reason",
          "expectedVersion",
          "idempotencyKey",
        ],
        properties: {
          catalogPriceUnitId: { type: "string", minLength: 1 },
          price: { type: "string", pattern: MONETARY_STRING_PATTERN },
          minimumCharge: { type: "string", pattern: MONETARY_STRING_PATTERN },
          reason: { type: "string", minLength: 1, maxLength: 1000 },
          ...versionedCommandProperties,
        },
      },
      R1P09ProviderServiceLifecycleCommand: {
        type: "object",
        additionalProperties: false,
        required: ["action", "reason", "expectedVersion", "idempotencyKey"],
        properties: {
          action: { type: "string", enum: ["ENABLE", "DISABLE"] },
          reason: { type: "string", minLength: 1, maxLength: 1000 },
          ...versionedCommandProperties,
        },
      },
      R1P09StaffPriceDecisionCommand: {
        type: "object",
        additionalProperties: false,
        required: ["decision", "reason", "expectedVersion", "idempotencyKey"],
        properties: {
          decision: { type: "string", enum: ["APPROVE", "REJECT"] },
          reason: { type: "string", minLength: 1, maxLength: 1000 },
          ...versionedCommandProperties,
        },
      },
      R1P09StaffPendingPriceProposalListItem: {
        type: "object",
        additionalProperties: false,
        required: [
          "providerId",
          "providerServiceId",
          "providerServiceVersion",
          "providerServicePriceId",
          "catalogServiceCode",
          "catalogPriceUnitCode",
          "price",
          "minimumCharge",
          "currencyCode",
          "proposedAt",
          "providerDisplayName",
        ],
        properties: {
          providerId: { type: "string" },
          providerServiceId: { type: "string" },
          providerServiceVersion: { type: "integer", minimum: 1 },
          providerServicePriceId: { type: "string" },
          catalogServiceCode: { type: "string" },
          catalogPriceUnitCode: { type: "string" },
          price: { type: "string", pattern: MONETARY_STRING_PATTERN },
          minimumCharge: { type: "string", pattern: MONETARY_STRING_PATTERN },
          currencyCode: { type: "string", pattern: "^[A-Z]{3}$" },
          proposedAt: { type: "string", format: "date-time" },
          providerDisplayName: { type: "string" },
        },
      },
      R1P09StaffPriceDecisionResult: {
        type: "object",
        additionalProperties: false,
        required: [
          "decision",
          "resultingVersion",
          "decidedPriceStatus",
          "effectivePriceId",
        ],
        properties: {
          decision: { type: "string", enum: ["APPROVE", "REJECT"] },
          resultingVersion: { type: "integer", minimum: 1 },
          decidedPriceStatus: {
            type: "string",
            enum: ["EFFECTIVE", "REJECTED"],
          },
          effectivePriceId: { type: ["string", "null"] },
        },
      },
    },
  };
}

export function loadR1P09OpenApiSource(): {
  readonly paths: Record<string, unknown>;
  readonly components: {
    readonly schemas: Record<string, unknown>;
    readonly parameters: Record<string, unknown>;
  };
} {
  return {
    paths: buildR1P09OpenApiPaths(),
    components: buildR1P09OpenApiComponents(),
  };
}

export const R1_P09_OPENAPI_OPERATIONS = [
  "listProviderServices",
  "createProviderService",
  "getProviderService",
  "replaceProviderServiceConfiguration",
  "proposeProviderServicePrice",
  "changeProviderServiceLifecycle",
  "listProviderServicePriceHistory",
  "listProviderServiceStatusHistory",
  "listStaffPendingServicePriceProposals",
  "getStaffPendingServicePriceProposal",
  "decideStaffServicePriceProposal",
] as const;

export const R1_P09_RUNTIME_HAS_NO_ANONYMOUS_BROWSE_OR_BOOKING = true as const;

export function buildImplementedR1P09SwaggerFragments(): {
  readonly tags: readonly { readonly name: string; readonly description: string }[];
  readonly paths: Record<string, unknown>;
  readonly parameters: Record<string, unknown>;
  readonly schemas: Record<string, unknown>;
} {
  const components = buildR1P09OpenApiComponents();
  return {
    tags: [
      {
        name: R1_P09_OPENAPI_PROVIDER_TAG,
        description:
          "Protected Provider-admin service and pricing management. No anonymous Browse or Booking routes.",
      },
      {
        name: R1_P09_OPENAPI_STAFF_TAG,
        description:
          "Protected Staff price-proposal review under providers.services.prices.approve. No customer or Booking surface.",
      },
    ],
    paths: buildR1P09OpenApiPaths(),
    parameters: components.parameters,
    schemas: components.schemas,
  };
}
