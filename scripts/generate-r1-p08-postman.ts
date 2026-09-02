import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  loadR1P08OpenApiSource,
  R1_P08_OPENAPI_OPERATIONS,
  R1_P08_PROTECTED_PATH_PREFIX,
} from "../src/swagger/r1-p08-openapi.paths.js";

type UrlPrefix = "{{baseUrl}}" | "{{hostUrl}}";

interface CatalogPostmanRequest {
  readonly method: string;
  readonly header: readonly { readonly key: string; readonly value: string }[];
  readonly url: string;
  readonly body?: unknown;
}

interface CatalogPostmanItem {
  readonly name: string;
  readonly request?: CatalogPostmanRequest;
  readonly item?: readonly CatalogPostmanItem[];
}

function rewriteUrlPrefix(
  items: readonly CatalogPostmanItem[],
  prefix: UrlPrefix,
): CatalogPostmanItem[] {
  return items.map((entry) => {
    if (entry.request !== undefined) {
      return {
        ...entry,
        request: {
          ...entry.request,
          url: entry.request.url.replace(/^\{\{baseUrl\}\}/u, prefix),
        },
      };
    }
    return {
      ...entry,
      item: rewriteUrlPrefix(entry.item ?? [], prefix),
    };
  });
}

/**
 * Generate the canonical R1-P08 Postman collection under postman/.
 * Filled story by story; never writes anonymous Browse requests.
 */
async function main(): Promise<void> {
  const source = loadR1P08OpenApiSource();
  const authHeader = {
    key: "Authorization",
    value: "Bearer {{accessToken}}",
  } as const;

  const taxonomyItems = [
    {
      name: "List categories",
      request: {
        method: "GET",
        header: [authHeader],
        url: "{{baseUrl}}/api/v1/staff/catalog/categories",
      },
    },
    {
      name: "Create category",
      request: {
        method: "POST",
        header: [authHeader, { key: "Content-Type", value: "application/json" }],
        body: {
          mode: "raw",
          raw: JSON.stringify(
            {
              idempotencyKey: "00000000-0000-4000-8000-000000000001",
              reasonCode: "catalog_management_change",
              code: "HOME_CLEANING",
              nameEn: "Home Cleaning",
              nameAr: "تنظيف المنازل",
              descriptionEn: "Home cleaning and housekeeping services.",
              descriptionAr: "خدمات تنظيف المنازل والتدبير المنزلي.",
            },
            null,
            2,
          ),
        },
        url: "{{baseUrl}}/api/v1/staff/catalog/categories",
      },
    },
    {
      name: "Get category",
      request: {
        method: "GET",
        header: [authHeader],
        url: "{{baseUrl}}/api/v1/staff/catalog/categories/{{categoryId}}",
      },
    },
    {
      name: "Replace category content",
      request: {
        method: "PUT",
        header: [authHeader, { key: "Content-Type", value: "application/json" }],
        body: {
          mode: "raw",
          raw: JSON.stringify(
            {
              idempotencyKey: "00000000-0000-4000-8000-000000000002",
              reasonCode: "catalog_management_change",
              expectedVersion: 1,
              nameEn: "Home Cleaning",
              nameAr: "تنظيف المنازل",
              descriptionEn: "Updated description",
              descriptionAr: "وصف محدث",
            },
            null,
            2,
          ),
        },
        url: "{{baseUrl}}/api/v1/staff/catalog/categories/{{categoryId}}",
      },
    },
    {
      name: "Change category lifecycle",
      request: {
        method: "POST",
        header: [authHeader, { key: "Content-Type", value: "application/json" }],
        body: {
          mode: "raw",
          raw: JSON.stringify(
            {
              idempotencyKey: "00000000-0000-4000-8000-000000000003",
              reasonCode: "catalog_management_change",
              expectedVersion: 2,
              action: "ACTIVATE",
            },
            null,
            2,
          ),
        },
        url: "{{baseUrl}}/api/v1/staff/catalog/categories/{{categoryId}}/lifecycle",
      },
    },
    {
      name: "List services",
      request: {
        method: "GET",
        header: [authHeader],
        url: "{{baseUrl}}/api/v1/staff/catalog/services?categoryId={{categoryId}}",
      },
    },
    {
      name: "Create service",
      request: {
        method: "POST",
        header: [authHeader, { key: "Content-Type", value: "application/json" }],
        body: {
          mode: "raw",
          raw: JSON.stringify(
            {
              idempotencyKey: "00000000-0000-4000-8000-000000000004",
              reasonCode: "catalog_management_change",
              categoryId: "{{categoryId}}",
              code: "STANDARD_HOME_CLEANING",
              translations: [
                {
                  locale: "EN",
                  name: "Standard Home Cleaning",
                  description: "Routine home cleaning.",
                },
                {
                  locale: "AR",
                  name: "تنظيف منزلي قياسي",
                  description: "تنظيف منزلي دوري.",
                },
              ],
            },
            null,
            2,
          ),
        },
        url: "{{baseUrl}}/api/v1/staff/catalog/services",
      },
    },
    {
      name: "Get service",
      request: {
        method: "GET",
        header: [authHeader],
        url: "{{baseUrl}}/api/v1/staff/catalog/services/{{serviceId}}",
      },
    },
    {
      name: "Move service",
      request: {
        method: "PUT",
        header: [authHeader, { key: "Content-Type", value: "application/json" }],
        body: {
          mode: "raw",
          raw: JSON.stringify(
            {
              idempotencyKey: "00000000-0000-4000-8000-000000000005",
              reasonCode: "catalog_management_change",
              expectedVersion: 1,
              categoryId: "{{categoryId}}",
            },
            null,
            2,
          ),
        },
        url: "{{baseUrl}}/api/v1/staff/catalog/services/{{serviceId}}",
      },
    },
    {
      name: "Change service lifecycle",
      request: {
        method: "POST",
        header: [authHeader, { key: "Content-Type", value: "application/json" }],
        body: {
          mode: "raw",
          raw: JSON.stringify(
            {
              idempotencyKey: "00000000-0000-4000-8000-000000000006",
              reasonCode: "catalog_management_change",
              expectedVersion: 1,
              action: "ACTIVATE",
            },
            null,
            2,
          ),
        },
        url: "{{baseUrl}}/api/v1/staff/catalog/services/{{serviceId}}/lifecycle",
      },
    },
  ];

  const configurationItems = [
    {
      name: "Replace service configuration (valid six kinds)",
      request: {
        method: "PUT",
        header: [authHeader, { key: "Content-Type", value: "application/json" }],
        body: {
          mode: "raw",
          raw: JSON.stringify(
            {
              idempotencyKey: "00000000-0000-4000-8000-000000000007",
              reasonCode: "catalog_management_change",
              expectedVersion: 1,
              translations: [
                { locale: "EN", name: "Standard Home Cleaning", description: "Routine." },
              ],
              priceUnits: [
                { code: "PER_VISIT", labelAr: null, labelEn: "Per visit", isActive: false },
              ],
              fields: [
                {
                  code: "PREP_INFO",
                  kind: "INFORMATION",
                  labelAr: null,
                  labelEn: "Preparation",
                  helpTextAr: null,
                  helpTextEn: null,
                  isRequired: false,
                  isActive: false,
                  minLength: null,
                  maxLength: null,
                  numberMode: null,
                  minValue: null,
                  maxValue: null,
                  minSelections: null,
                  maxSelections: null,
                  options: [],
                },
                {
                  code: "BEDROOMS",
                  kind: "NUMBER",
                  labelAr: null,
                  labelEn: "Bedrooms",
                  helpTextAr: null,
                  helpTextEn: null,
                  isRequired: true,
                  isActive: false,
                  minLength: null,
                  maxLength: null,
                  numberMode: "INTEGER",
                  minValue: "1",
                  maxValue: "10",
                  minSelections: null,
                  maxSelections: null,
                  options: [],
                },
                {
                  code: "PETS",
                  kind: "BOOLEAN",
                  labelAr: null,
                  labelEn: "Pets",
                  helpTextAr: null,
                  helpTextEn: null,
                  isRequired: false,
                  isActive: false,
                  minLength: null,
                  maxLength: null,
                  numberMode: null,
                  minValue: null,
                  maxValue: null,
                  minSelections: null,
                  maxSelections: null,
                  options: [],
                },
              ],
            },
            null,
            2,
          ),
        },
        url: "{{baseUrl}}/api/v1/staff/catalog/services/{{serviceId}}/configuration",
      },
    },
    {
      name: "Replace service configuration (invalid NUMBER without mode)",
      request: {
        method: "PUT",
        header: [authHeader, { key: "Content-Type", value: "application/json" }],
        body: {
          mode: "raw",
          raw: JSON.stringify(
            {
              idempotencyKey: "00000000-0000-4000-8000-000000000008",
              reasonCode: "catalog_management_change",
              expectedVersion: 1,
              translations: [{ locale: "EN", name: "Draft", description: null }],
              priceUnits: [],
              fields: [
                {
                  code: "AREA",
                  kind: "NUMBER",
                  labelAr: null,
                  labelEn: "Area",
                  helpTextAr: null,
                  helpTextEn: null,
                  isRequired: false,
                  isActive: false,
                  minLength: null,
                  maxLength: null,
                  minValue: null,
                  maxValue: null,
                  minSelections: null,
                  maxSelections: null,
                  options: [],
                },
              ],
            },
            null,
            2,
          ),
        },
        url: "{{baseUrl}}/api/v1/staff/catalog/services/{{serviceId}}/configuration",
      },
    },
  ];

  const lifecycleOrderItems = [
    {
      name: "Replace category order",
      request: {
        method: "PUT",
        header: [authHeader, { key: "Content-Type", value: "application/json" }],
        body: {
          mode: "raw",
          raw: JSON.stringify(
            {
              idempotencyKey: "00000000-0000-4000-8000-000000000301",
              reasonCode: "catalog_management_change",
              items: [{ id: "{{categoryId}}", expectedVersion: 1 }],
            },
            null,
            2,
          ),
        },
        url: "{{baseUrl}}/api/v1/staff/catalog/categories/order",
      },
    },
    {
      name: "Replace service order",
      request: {
        method: "PUT",
        header: [authHeader, { key: "Content-Type", value: "application/json" }],
        body: {
          mode: "raw",
          raw: JSON.stringify(
            {
              idempotencyKey: "00000000-0000-4000-8000-000000000302",
              reasonCode: "catalog_management_change",
              categoryId: "{{categoryId}}",
              items: [{ id: "{{serviceId}}", expectedVersion: 1 }],
            },
            null,
            2,
          ),
        },
        url: "{{baseUrl}}/api/v1/staff/catalog/services/order",
      },
    },
    {
      name: "Replace service availability (EG)",
      request: {
        method: "PUT",
        header: [authHeader, { key: "Content-Type", value: "application/json" }],
        body: {
          mode: "raw",
          raw: JSON.stringify(
            {
              idempotencyKey: "00000000-0000-4000-8000-000000000303",
              reasonCode: "catalog_management_change",
              expectedVersion: 1,
              countries: [{ countryCode: "EG", isAvailable: true }],
            },
            null,
            2,
          ),
        },
        url: "{{baseUrl}}/api/v1/staff/catalog/services/{{serviceId}}/availability",
      },
    },
  ];

  const mediaItems = [
    {
      name: "Upload service media (multipart)",
      request: {
        method: "POST",
        header: [authHeader],
        body: {
          mode: "formdata",
          formdata: [
            {
              key: "file",
              type: "file",
              src: "{{catalogServiceImagePath}}",
              description: "JPEG/PNG/WebP service image, max 5 MiB",
            },
            {
              key: "expectedVersion",
              value: "1",
              type: "text",
            },
            {
              key: "idempotencyKey",
              value: "00000000-0000-4000-8000-000000000401",
              type: "text",
            },
            {
              key: "reasonCode",
              value: "catalog_management_change",
              type: "text",
            },
          ],
        },
        url: "{{baseUrl}}/api/v1/staff/catalog/services/{{serviceId}}/media",
      },
    },
    {
      name: "Reorder service media",
      request: {
        method: "PUT",
        header: [authHeader, { key: "Content-Type", value: "application/json" }],
        body: {
          mode: "raw",
          raw: JSON.stringify(
            {
              idempotencyKey: "00000000-0000-4000-8000-000000000402",
              reasonCode: "catalog_management_change",
              expectedVersion: 2,
              orderedAssociationIds: ["{{associationId}}"],
            },
            null,
            2,
          ),
        },
        url: "{{baseUrl}}/api/v1/staff/catalog/services/{{serviceId}}/media/order",
      },
    },
    {
      name: "Remove service media association",
      request: {
        method: "POST",
        header: [authHeader, { key: "Content-Type", value: "application/json" }],
        body: {
          mode: "raw",
          raw: JSON.stringify(
            {
              idempotencyKey: "00000000-0000-4000-8000-000000000403",
              reasonCode: "catalog_management_change",
              expectedVersion: 3,
            },
            null,
            2,
          ),
        },
        url: "{{baseUrl}}/api/v1/staff/catalog/services/{{serviceId}}/media/{{associationId}}/remove",
      },
    },
    {
      name: "Upload service media — invalid Media example",
      request: {
        method: "POST",
        header: [authHeader],
        body: {
          mode: "formdata",
          formdata: [
            {
              key: "file",
              type: "file",
              src: "{{catalogServiceImagePath}}",
              description: "Intentionally unsupported GIF to exercise CATALOG_MEDIA_INVALID",
            },
            {
              key: "expectedVersion",
              value: "1",
              type: "text",
            },
            {
              key: "idempotencyKey",
              value: "00000000-0000-4000-8000-000000000404",
              type: "text",
            },
            {
              key: "reasonCode",
              value: "catalog_management_change",
              type: "text",
            },
          ],
        },
        url: "{{baseUrl}}/api/v1/staff/catalog/services/{{serviceId}}/media",
      },
    },
  ];

  const storyFolders: CatalogPostmanItem[] = [
    {
      name: "US1 Taxonomy",
      item: taxonomyItems,
    },
    {
      name: "US2 Configuration",
      item: configurationItems,
    },
    {
      name: "US3 Lifecycle Order Availability",
      item: lifecycleOrderItems,
    },
    {
      name: "US4 Service Media",
      item: mediaItems,
    },
  ];

  const collection = {
    info: {
      _postman_id: "00000000-p008-4000-8000-000000000008",
      name: "Cleanora R1-P08 Catalog Management",
      description:
        `Protected staff Catalog management only under ${R1_P08_PROTECTED_PATH_PREFIX}. No anonymous Browse routes. Operations: ${R1_P08_OPENAPI_OPERATIONS.join(", ")}.`,
      schema:
        "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    },
    variable: [
      { key: "baseUrl", value: "http://localhost:8000" },
      { key: "hostUrl", value: "https://YOUR-HOSTED-DOMAIN.example" },
      { key: "accessToken", value: "" },
      { key: "categoryId", value: "" },
      { key: "serviceId", value: "" },
      { key: "associationId", value: "" },
      { key: "catalogServiceImagePath", value: "" },
    ],
    item: [
      {
        name: "Hosted (Not hosted yet)",
        item: rewriteUrlPrefix(storyFolders, "{{hostUrl}}"),
      },
      {
        name: "Local",
        item: rewriteUrlPrefix(storyFolders, "{{baseUrl}}"),
      },
    ],
  };

  void source;

  const out = resolve(
    process.cwd(),
    "postman",
    "Cleanora-R1-P08-Catalog-Management.postman_collection.json",
  );
  await writeFile(out, `${JSON.stringify(collection, null, 2)}\n`, "utf8");
  console.log(`Wrote ${out}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
