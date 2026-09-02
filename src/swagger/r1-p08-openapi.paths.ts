/**
 * R1-P08 runtime OpenAPI path/schema contributions for protected staff Catalog
 * management. Filled story by story; no anonymous Browse paths.
 */

export const R1_P08_OPENAPI_TAG = "Staff Catalog";

export const R1_P08_PROTECTED_PATH_PREFIX = "/staff/catalog";

const commandBaseProperties = {
  idempotencyKey: { type: "string", format: "uuid" },
  reasonCode: { type: "string", const: "catalog_management_change" },
} as const;

const versionedCommandProperties = {
  ...commandBaseProperties,
  expectedVersion: { type: "integer", minimum: 1 },
} as const;

const categoryDtoSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "code",
    "nameAr",
    "nameEn",
    "descriptionAr",
    "descriptionEn",
    "displayOrder",
    "isActive",
    "version",
    "createdAt",
    "updatedAt",
  ],
  properties: {
    id: { type: "string" },
    code: { type: "string" },
    nameAr: { type: ["string", "null"] },
    nameEn: { type: ["string", "null"] },
    descriptionAr: { type: ["string", "null"] },
    descriptionEn: { type: ["string", "null"] },
    displayOrder: { type: "integer", minimum: 0 },
    isActive: { type: "boolean" },
    version: { type: "integer", minimum: 1 },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
} as const;

const priceUnitDtoSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "code", "labelAr", "labelEn", "displayOrder", "isActive"],
  properties: {
    id: { type: "string" },
    code: { type: "string" },
    labelAr: { type: ["string", "null"] },
    labelEn: { type: ["string", "null"] },
    displayOrder: { type: "integer", minimum: 0 },
    isActive: { type: "boolean" },
  },
} as const;

const fieldOptionDtoSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "value", "labelAr", "labelEn", "displayOrder", "isActive"],
  properties: {
    id: { type: "string" },
    value: { type: "string" },
    labelAr: { type: ["string", "null"] },
    labelEn: { type: ["string", "null"] },
    displayOrder: { type: "integer", minimum: 0 },
    isActive: { type: "boolean" },
  },
} as const;

const fieldDtoSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "code",
    "kind",
    "labelAr",
    "labelEn",
    "helpTextAr",
    "helpTextEn",
    "isRequired",
    "isActive",
    "minLength",
    "maxLength",
    "numberMode",
    "minValue",
    "maxValue",
    "minSelections",
    "maxSelections",
    "displayOrder",
    "options",
  ],
  properties: {
    id: { type: "string" },
    code: { type: "string" },
    kind: {
      type: "string",
      enum: [
        "INFORMATION",
        "TEXT",
        "NUMBER",
        "BOOLEAN",
        "SINGLE_SELECT",
        "MULTI_SELECT",
      ],
    },
    labelAr: { type: ["string", "null"] },
    labelEn: { type: ["string", "null"] },
    helpTextAr: { type: ["string", "null"] },
    helpTextEn: { type: ["string", "null"] },
    isRequired: { type: "boolean" },
    isActive: { type: "boolean" },
    minLength: { type: ["integer", "null"], minimum: 0 },
    maxLength: { type: ["integer", "null"], minimum: 0 },
    numberMode: { type: ["string", "null"], enum: ["INTEGER", "DECIMAL", null] },
    minValue: { type: ["string", "null"] },
    maxValue: { type: ["string", "null"] },
    minSelections: { type: ["integer", "null"], minimum: 0 },
    maxSelections: { type: ["integer", "null"], minimum: 0 },
    displayOrder: { type: "integer", minimum: 0 },
    options: { type: "array", items: fieldOptionDtoSchema },
  },
} as const;

const serviceDtoSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "categoryId",
    "code",
    "displayOrder",
    "isActive",
    "version",
    "translations",
    "priceUnits",
    "fields",
    "createdAt",
    "updatedAt",
  ],
  properties: {
    id: { type: "string" },
    categoryId: { type: "string" },
    code: { type: "string" },
    displayOrder: { type: "integer", minimum: 0 },
    isActive: { type: "boolean" },
    version: { type: "integer", minimum: 1 },
    translations: {
      type: "array",
      maxItems: 2,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["locale", "name", "description"],
        properties: {
          locale: { type: "string", enum: ["AR", "EN"] },
          name: { type: ["string", "null"] },
          description: { type: ["string", "null"] },
        },
      },
    },
    priceUnits: { type: "array", items: priceUnitDtoSchema },
    fields: { type: "array", items: fieldDtoSchema },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
} as const;

/** Paths filled as stories land. */
export function buildR1P08OpenApiPaths(): Record<string, unknown> {
  const bearer = [{ bearerAuth: [] }];
  const errorResponses = {
    "400": { $ref: "#/components/responses/ApiError" },
    "401": { $ref: "#/components/responses/ApiError" },
    "403": { $ref: "#/components/responses/ApiError" },
    "404": { $ref: "#/components/responses/ApiError" },
    "409": { $ref: "#/components/responses/ApiError" },
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
      schema: { type: "integer", minimum: 1, maximum: 100 },
    },
  ];

  return {
    "/staff/catalog/categories": {
      get: {
        tags: [R1_P08_OPENAPI_TAG],
        operationId: "listCatalogCategoriesForManagement",
        security: bearer,
        parameters: cursorParams,
        responses: {
          "200": { description: "Protected category list including inactive drafts" },
          "401": errorResponses["401"],
          "403": errorResponses["403"],
        },
      },
      post: {
        tags: [R1_P08_OPENAPI_TAG],
        operationId: "createCatalogCategory",
        security: bearer,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/R1P08CreateCategoryCommand" },
            },
          },
        },
        responses: {
          "201": { description: "Inactive category created" },
          "200": { description: "Idempotent replay of the same create" },
          ...errorResponses,
        },
      },
    },
    "/staff/catalog/categories/{categoryId}": {
      get: {
        tags: [R1_P08_OPENAPI_TAG],
        operationId: "getCatalogCategoryForManagement",
        security: bearer,
        parameters: [
          {
            name: "categoryId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": { description: "Protected category detail" },
          "401": errorResponses["401"],
          "403": errorResponses["403"],
          "404": errorResponses["404"],
        },
      },
      put: {
        tags: [R1_P08_OPENAPI_TAG],
        operationId: "replaceCatalogCategoryContent",
        security: bearer,
        parameters: [
          {
            name: "categoryId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/R1P08ReplaceCategoryCommand" },
            },
          },
        },
        responses: {
          "200": { description: "Category content replaced at one new version" },
          ...errorResponses,
        },
      },
    },
    "/staff/catalog/categories/{categoryId}/lifecycle": {
      post: {
        tags: [R1_P08_OPENAPI_TAG],
        operationId: "changeCatalogCategoryLifecycle",
        security: bearer,
        parameters: [
          {
            name: "categoryId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/R1P08CategoryLifecycleCommand" },
            },
          },
        },
        responses: {
          "200": { description: "Category lifecycle changed atomically" },
          ...errorResponses,
        },
      },
    },
    "/staff/catalog/categories/order": {
      put: {
        tags: [R1_P08_OPENAPI_TAG],
        operationId: "replaceCatalogCategoryOrder",
        security: bearer,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/R1P08ReplaceOrderCommand" },
            },
          },
        },
        responses: {
          "200": { description: "Complete category order replaced atomically" },
          ...errorResponses,
        },
      },
    },
    "/staff/catalog/services": {
      get: {
        tags: [R1_P08_OPENAPI_TAG],
        operationId: "listCatalogServicesForManagement",
        security: bearer,
        parameters: [
          {
            name: "categoryId",
            in: "query",
            required: false,
            schema: { type: "string" },
          },
          ...cursorParams,
        ],
        responses: {
          "200": { description: "Protected service list including inactive drafts" },
          "401": errorResponses["401"],
          "403": errorResponses["403"],
        },
      },
      post: {
        tags: [R1_P08_OPENAPI_TAG],
        operationId: "createCatalogService",
        security: bearer,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/R1P08CreateServiceCommand" },
            },
          },
        },
        responses: {
          "201": { description: "Inactive service created" },
          "200": { description: "Idempotent replay of the same create" },
          ...errorResponses,
        },
      },
    },
    "/staff/catalog/services/{serviceId}": {
      get: {
        tags: [R1_P08_OPENAPI_TAG],
        operationId: "getCatalogServiceForManagement",
        security: bearer,
        parameters: [
          {
            name: "serviceId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": { description: "Protected service detail" },
          "401": errorResponses["401"],
          "403": errorResponses["403"],
          "404": errorResponses["404"],
        },
      },
      put: {
        tags: [R1_P08_OPENAPI_TAG],
        operationId: "moveCatalogServiceToCategory",
        security: bearer,
        parameters: [
          {
            name: "serviceId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/R1P08MoveServiceCommand" },
            },
          },
        },
        responses: {
          "200": { description: "Service moved to the category at a new version" },
          ...errorResponses,
        },
      },
    },
    "/staff/catalog/services/{serviceId}/lifecycle": {
      post: {
        tags: [R1_P08_OPENAPI_TAG],
        operationId: "changeCatalogServiceLifecycle",
        security: bearer,
        parameters: [
          {
            name: "serviceId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/R1P08ServiceLifecycleCommand" },
            },
          },
        },
        responses: {
          "200": { description: "Service lifecycle changed atomically" },
          ...errorResponses,
        },
      },
    },
    "/staff/catalog/services/order": {
      put: {
        tags: [R1_P08_OPENAPI_TAG],
        operationId: "replaceCatalogServiceOrder",
        security: bearer,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/R1P08ReplaceServiceOrderCommand" },
            },
          },
        },
        responses: {
          "200": {
            description: "Complete service order in one category replaced atomically",
          },
          ...errorResponses,
        },
      },
    },
    "/staff/catalog/services/{serviceId}/availability": {
      put: {
        tags: [R1_P08_OPENAPI_TAG],
        operationId: "replaceCatalogServiceAvailability",
        security: bearer,
        parameters: [
          {
            name: "serviceId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/R1P08ReplaceServiceAvailabilityCommand",
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Service country availability replaced at one new version",
          },
          ...errorResponses,
        },
      },
    },
    "/staff/catalog/services/{serviceId}/media": {
      post: {
        tags: [R1_P08_OPENAPI_TAG],
        operationId: "uploadCatalogServiceImage",
        security: bearer,
        parameters: [
          {
            name: "serviceId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                additionalProperties: false,
                required: [
                  "file",
                  "expectedVersion",
                  "idempotencyKey",
                  "reasonCode",
                ],
                properties: {
                  file: {
                    type: "string",
                    format: "binary",
                  },
                  expectedVersion: { type: "integer", minimum: 1 },
                  idempotencyKey: { type: "string", format: "uuid" },
                  reasonCode: {
                    type: "string",
                    const: "catalog_management_change",
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "READY Catalog service image associated",
          },
          "200": {
            description: "Idempotent replay of a completed media upload",
          },
          ...errorResponses,
          "503": { description: "Media dependency unavailable" },
        },
      },
    },
    "/staff/catalog/services/{serviceId}/media/order": {
      put: {
        tags: [R1_P08_OPENAPI_TAG],
        operationId: "replaceCatalogServiceMediaOrder",
        security: bearer,
        parameters: [
          {
            name: "serviceId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/R1P08ReorderServiceMediaCommand",
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Exact service media association order replaced",
          },
          ...errorResponses,
        },
      },
    },
    "/staff/catalog/services/{serviceId}/media/{associationId}/remove": {
      post: {
        tags: [R1_P08_OPENAPI_TAG],
        operationId: "removeCatalogServiceImage",
        security: bearer,
        parameters: [
          {
            name: "serviceId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
          {
            name: "associationId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                additionalProperties: false,
                required: ["expectedVersion", "idempotencyKey", "reasonCode"],
                properties: versionedCommandProperties,
              },
            },
          },
        },
        responses: {
          "200": {
            description:
              "Association removed without deleting the Media-owned file",
          },
          ...errorResponses,
        },
      },
    },
    "/staff/catalog/services/{serviceId}/configuration": {
      put: {
        tags: [R1_P08_OPENAPI_TAG],
        operationId: "replaceCatalogServiceConfiguration",
        description:
          "US2: atomic price-unit and field/option replacement. Country availability uses the dedicated availability route.",
        security: bearer,
        parameters: [
          {
            name: "serviceId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/R1P08ReplaceServiceConfigurationCommand",
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Service configuration replaced atomically at one new version",
          },
          ...errorResponses,
        },
      },
    },
  };
}

export function buildR1P08OpenApiComponents(): {
  readonly schemas: Record<string, unknown>;
  readonly parameters: Record<string, unknown>;
} {
  return {
    parameters: {
      R1P08CategoryId: {
        name: "categoryId",
        in: "path",
        required: true,
        schema: { type: "string" },
      },
      R1P08ServiceId: {
        name: "serviceId",
        in: "path",
        required: true,
        schema: { type: "string" },
      },
      R1P08CategoryIdQuery: {
        name: "categoryId",
        in: "query",
        required: false,
        schema: { type: "string" },
      },
    },
    schemas: {
      R1P08CategoryManagementDto: categoryDtoSchema,
      R1P08ServiceManagementDto: serviceDtoSchema,
      R1P08CreateCategoryCommand: {
        type: "object",
        additionalProperties: false,
        required: [
          "idempotencyKey",
          "reasonCode",
          "code",
          "nameAr",
          "nameEn",
          "descriptionAr",
          "descriptionEn",
        ],
        properties: {
          ...commandBaseProperties,
          code: { type: "string", pattern: "^[A-Z][A-Z0-9_]*$", minLength: 2, maxLength: 80 },
          nameAr: { type: ["string", "null"] },
          nameEn: { type: ["string", "null"] },
          descriptionAr: { type: ["string", "null"] },
          descriptionEn: { type: ["string", "null"] },
        },
      },
      R1P08ReplaceCategoryCommand: {
        type: "object",
        additionalProperties: false,
        required: [
          "idempotencyKey",
          "reasonCode",
          "expectedVersion",
          "nameAr",
          "nameEn",
          "descriptionAr",
          "descriptionEn",
        ],
        properties: {
          ...versionedCommandProperties,
          nameAr: { type: ["string", "null"] },
          nameEn: { type: ["string", "null"] },
          descriptionAr: { type: ["string", "null"] },
          descriptionEn: { type: ["string", "null"] },
        },
      },
      R1P08CategoryLifecycleCommand: {
        type: "object",
        additionalProperties: false,
        required: ["idempotencyKey", "reasonCode", "expectedVersion", "action"],
        properties: {
          ...versionedCommandProperties,
          action: { type: "string", enum: ["ACTIVATE", "DEACTIVATE"] },
        },
      },
      R1P08CreateServiceCommand: {
        type: "object",
        additionalProperties: false,
        required: [
          "idempotencyKey",
          "reasonCode",
          "categoryId",
          "code",
          "translations",
        ],
        properties: {
          ...commandBaseProperties,
          categoryId: { type: "string" },
          code: { type: "string", pattern: "^[A-Z][A-Z0-9_]*$", minLength: 2, maxLength: 100 },
          translations: {
            type: "array",
            maxItems: 2,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["locale", "name", "description"],
              properties: {
                locale: { type: "string", enum: ["AR", "EN"] },
                name: { type: ["string", "null"] },
                description: { type: ["string", "null"] },
              },
            },
          },
        },
      },
      R1P08MoveServiceCommand: {
        type: "object",
        additionalProperties: false,
        required: ["idempotencyKey", "reasonCode", "expectedVersion", "categoryId"],
        properties: {
          ...versionedCommandProperties,
          categoryId: { type: "string" },
        },
      },
      R1P08ServiceLifecycleCommand: {
        type: "object",
        additionalProperties: false,
        required: ["idempotencyKey", "reasonCode", "expectedVersion", "action"],
        properties: {
          ...versionedCommandProperties,
          action: { type: "string", enum: ["ACTIVATE", "DEACTIVATE"] },
        },
      },
      R1P08PriceUnitInput: {
        type: "object",
        additionalProperties: false,
        required: ["code", "labelAr", "labelEn", "isActive"],
        properties: {
          code: { type: "string", pattern: "^[A-Z][A-Z0-9_]*$", minLength: 2, maxLength: 64 },
          labelAr: { type: ["string", "null"] },
          labelEn: { type: ["string", "null"] },
          isActive: { type: "boolean" },
        },
      },
      R1P08FieldOptionInput: {
        type: "object",
        additionalProperties: false,
        required: ["value", "labelAr", "labelEn", "isActive"],
        properties: {
          value: { type: "string", pattern: "^[A-Z][A-Z0-9_]*$", minLength: 1, maxLength: 80 },
          labelAr: { type: ["string", "null"] },
          labelEn: { type: ["string", "null"] },
          isActive: { type: "boolean" },
        },
      },
      R1P08FieldInput: {
        type: "object",
        additionalProperties: false,
        required: [
          "code",
          "kind",
          "labelAr",
          "labelEn",
          "helpTextAr",
          "helpTextEn",
          "isRequired",
          "isActive",
          "minLength",
          "maxLength",
          "numberMode",
          "minValue",
          "maxValue",
          "minSelections",
          "maxSelections",
          "options",
        ],
        properties: {
          code: { type: "string", pattern: "^[A-Z][A-Z0-9_]*$", minLength: 2, maxLength: 80 },
          kind: {
            type: "string",
            enum: [
              "INFORMATION",
              "TEXT",
              "NUMBER",
              "BOOLEAN",
              "SINGLE_SELECT",
              "MULTI_SELECT",
            ],
          },
          labelAr: { type: ["string", "null"] },
          labelEn: { type: ["string", "null"] },
          helpTextAr: { type: ["string", "null"] },
          helpTextEn: { type: ["string", "null"] },
          isRequired: { type: "boolean" },
          isActive: { type: "boolean" },
          minLength: { type: ["integer", "null"], minimum: 0 },
          maxLength: { type: ["integer", "null"], minimum: 0 },
          numberMode: { type: ["string", "null"], enum: ["INTEGER", "DECIMAL", null] },
          minValue: { type: ["string", "null"] },
          maxValue: { type: ["string", "null"] },
          minSelections: { type: ["integer", "null"], minimum: 0 },
          maxSelections: { type: ["integer", "null"], minimum: 0 },
          options: {
            type: "array",
            items: { $ref: "#/components/schemas/R1P08FieldOptionInput" },
          },
        },
      },
      R1P08ReplaceServiceConfigurationCommand: {
        type: "object",
        additionalProperties: false,
        required: [
          "idempotencyKey",
          "reasonCode",
          "expectedVersion",
          "translations",
          "priceUnits",
          "fields",
        ],
        properties: {
          ...versionedCommandProperties,
          translations: {
            type: "array",
            maxItems: 2,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["locale", "name", "description"],
              properties: {
                locale: { type: "string", enum: ["AR", "EN"] },
                name: { type: ["string", "null"] },
                description: { type: ["string", "null"] },
              },
            },
          },
          priceUnits: {
            type: "array",
            items: { $ref: "#/components/schemas/R1P08PriceUnitInput" },
          },
          fields: {
            type: "array",
            items: { $ref: "#/components/schemas/R1P08FieldInput" },
          },
        },
      },
      R1P08OrderItem: {
        type: "object",
        additionalProperties: false,
        required: ["id", "expectedVersion"],
        properties: {
          id: { type: "string", minLength: 1 },
          expectedVersion: { type: "integer", minimum: 1 },
        },
      },
      R1P08ReplaceOrderCommand: {
        type: "object",
        additionalProperties: false,
        required: ["idempotencyKey", "reasonCode", "items"],
        properties: {
          ...commandBaseProperties,
          items: {
            type: "array",
            minItems: 1,
            items: { $ref: "#/components/schemas/R1P08OrderItem" },
          },
        },
      },
      R1P08ReplaceServiceOrderCommand: {
        type: "object",
        additionalProperties: false,
        required: ["idempotencyKey", "reasonCode", "categoryId", "items"],
        properties: {
          ...commandBaseProperties,
          categoryId: { type: "string", minLength: 1 },
          items: {
            type: "array",
            minItems: 1,
            items: { $ref: "#/components/schemas/R1P08OrderItem" },
          },
        },
      },
      R1P08CountryAvailabilityInput: {
        type: "object",
        additionalProperties: false,
        required: ["countryCode", "isAvailable"],
        properties: {
          countryCode: { type: "string", pattern: "^[A-Z]{2}$" },
          isAvailable: { type: "boolean" },
        },
      },
      R1P08ReplaceServiceAvailabilityCommand: {
        type: "object",
        additionalProperties: false,
        required: [
          "idempotencyKey",
          "reasonCode",
          "expectedVersion",
          "countries",
        ],
        properties: {
          ...versionedCommandProperties,
          countries: {
            type: "array",
            items: { $ref: "#/components/schemas/R1P08CountryAvailabilityInput" },
          },
        },
      },
      R1P08ReorderServiceMediaCommand: {
        type: "object",
        additionalProperties: false,
        required: [
          "idempotencyKey",
          "reasonCode",
          "expectedVersion",
          "orderedAssociationIds",
        ],
        properties: {
          ...versionedCommandProperties,
          orderedAssociationIds: {
            type: "array",
            uniqueItems: true,
            items: { type: "string", minLength: 1 },
          },
        },
      },
      R1P08ManagementMediaView: {
        type: "object",
        additionalProperties: false,
        required: [
          "associationId",
          "mediaId",
          "displayOrder",
          "status",
          "contentType",
          "width",
          "height",
          "deliveryUrl",
          "deliveryExpiresAt",
        ],
        properties: {
          associationId: { type: "string" },
          mediaId: { type: "string" },
          displayOrder: { type: "integer", minimum: 0 },
          status: { type: "string", const: "READY" },
          contentType: {
            type: "string",
            enum: ["image/jpeg", "image/png", "image/webp"],
          },
          width: { type: ["integer", "null"] },
          height: { type: ["integer", "null"] },
          deliveryUrl: { type: "string", format: "uri" },
          deliveryExpiresAt: { type: "string", format: "date-time" },
        },
      },
    },
  };
}

export function loadR1P08OpenApiSource(): {
  readonly paths: Record<string, unknown>;
  readonly components: {
    readonly schemas: Record<string, unknown>;
    readonly parameters: Record<string, unknown>;
  };
} {
  return {
    paths: buildR1P08OpenApiPaths(),
    components: buildR1P08OpenApiComponents(),
  };
}

export const R1_P08_OPENAPI_OPERATIONS = [
  "listCatalogCategoriesForManagement",
  "createCatalogCategory",
  "getCatalogCategoryForManagement",
  "replaceCatalogCategoryContent",
  "changeCatalogCategoryLifecycle",
  "replaceCatalogCategoryOrder",
  "listCatalogServicesForManagement",
  "createCatalogService",
  "getCatalogServiceForManagement",
  "moveCatalogServiceToCategory",
  "changeCatalogServiceLifecycle",
  "replaceCatalogServiceOrder",
  "replaceCatalogServiceAvailability",
  "replaceCatalogServiceConfiguration",
  "uploadCatalogServiceImage",
  "replaceCatalogServiceMediaOrder",
  "removeCatalogServiceImage",
] as const;

export const R1_P08_RUNTIME_HAS_NO_ANONYMOUS_BROWSE = true as const;

export function buildImplementedR1P08SwaggerFragments(): {
  readonly tags: readonly { readonly name: string; readonly description: string }[];
  readonly paths: Record<string, unknown>;
  readonly parameters: Record<string, unknown>;
  readonly schemas: Record<string, unknown>;
} {
  const components = buildR1P08OpenApiComponents();
  return {
    tags: [
      {
        name: R1_P08_OPENAPI_TAG,
        description:
          "Protected staff Catalog management. No anonymous or customer Browse routes.",
      },
    ],
    paths: buildR1P08OpenApiPaths(),
    parameters: components.parameters,
    schemas: components.schemas,
  };
}
