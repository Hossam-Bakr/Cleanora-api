import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  loadR1P09OpenApiSource,
  R1_P09_OPENAPI_OPERATIONS,
  R1_P09_PROVIDER_PATH_PREFIX,
  R1_P09_STAFF_PATH_PREFIX,
} from "../src/swagger/r1-p09-openapi.paths.js";

type UrlPrefix = "{{baseUrl}}" | "{{hostUrl}}";

interface ProviderServicesPostmanRequest {
  readonly method: string;
  readonly header: readonly { readonly key: string; readonly value: string }[];
  readonly url: string;
  readonly body?: unknown;
}

interface ProviderServicesPostmanItem {
  readonly name: string;
  readonly request?: ProviderServicesPostmanRequest;
  readonly item?: readonly ProviderServicesPostmanItem[];
}

function rewriteUrlPrefix(
  items: readonly ProviderServicesPostmanItem[],
  prefix: UrlPrefix,
): ProviderServicesPostmanItem[] {
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
 * Postman VS Code/cloud import expects raw JSON bodies to declare
 * `options.raw.language` (same shape as R1-P06/P07 generators).
 */
function withRawJsonLanguage(
  items: readonly ProviderServicesPostmanItem[],
): ProviderServicesPostmanItem[] {
  return items.map((entry) => {
    if (entry.request !== undefined) {
      const body = entry.request.body;
      if (
        body !== undefined &&
        typeof body === "object" &&
        body !== null &&
        "mode" in body &&
        (body as { mode?: string }).mode === "raw"
      ) {
        return {
          ...entry,
          request: {
            ...entry.request,
            body: {
              ...(body as Record<string, unknown>),
              options: { raw: { language: "json" } },
            },
          },
        };
      }
      return entry;
    }
    return {
      ...entry,
      item: withRawJsonLanguage(entry.item ?? []),
    };
  });
}

/**
 * Generate the canonical R1-P09 Postman collection under postman/.
 * Exactly the 11 protected operations; never writes Browse or Booking requests.
 */
async function main(): Promise<void> {
  const source = loadR1P09OpenApiSource();
  const authHeader = {
    key: "Authorization",
    value: "Bearer {{accessToken}}",
  } as const;
  const jsonHeaders = [
    authHeader,
    { key: "Content-Type", value: "application/json" },
  ] as const;

  const providerItems: ProviderServicesPostmanItem[] = [
    {
      name: "List provider services",
      request: {
        method: "GET",
        header: [authHeader],
        url: "{{baseUrl}}/api/v1/providers/{{providerId}}/services",
      },
    },
    {
      name: "Create provider service",
      request: {
        method: "POST",
        header: [...jsonHeaders],
        body: {
          mode: "raw",
          raw: JSON.stringify(
            {
              catalogServiceCode: "STANDARD_HOME_CLEANING",
              catalogPriceUnitId: "{{catalogPriceUnitId}}",
              price: "250.00",
              minimumCharge: "300.00",
              estimatedDurationMinutes: 120,
              noteAr: "ملاحظات اختيارية",
              noteEn: "Optional notes",
              expectedVersion: 0,
              idempotencyKey: "00000000-0000-4000-8000-000000000001",
            },
            null,
            2,
          ),
        },
        url: "{{baseUrl}}/api/v1/providers/{{providerId}}/services",
      },
    },
    {
      name: "Get provider service",
      request: {
        method: "GET",
        header: [authHeader],
        url: "{{baseUrl}}/api/v1/providers/{{providerId}}/services/{{providerServiceId}}",
      },
    },
    {
      name: "Replace provider service configuration",
      request: {
        method: "PUT",
        header: [...jsonHeaders],
        body: {
          mode: "raw",
          raw: JSON.stringify(
            {
              estimatedDurationMinutes: 150,
              noteAr: null,
              noteEn: null,
              expectedVersion: 4,
              idempotencyKey: "00000000-0000-4000-8000-000000000002",
            },
            null,
            2,
          ),
        },
        url: "{{baseUrl}}/api/v1/providers/{{providerId}}/services/{{providerServiceId}}/configuration",
      },
    },
    {
      name: "Propose provider service price",
      request: {
        method: "POST",
        header: [...jsonHeaders],
        body: {
          mode: "raw",
          raw: JSON.stringify(
            {
              catalogPriceUnitId: "{{catalogPriceUnitId}}",
              price: "275.00",
              minimumCharge: "325.00",
              reason: "Updated operating cost",
              expectedVersion: 5,
              idempotencyKey: "00000000-0000-4000-8000-000000000003",
            },
            null,
            2,
          ),
        },
        url: "{{baseUrl}}/api/v1/providers/{{providerId}}/services/{{providerServiceId}}/price-proposals",
      },
    },
    {
      name: "Change provider service lifecycle",
      request: {
        method: "POST",
        header: [...jsonHeaders],
        body: {
          mode: "raw",
          raw: JSON.stringify(
            {
              action: "ENABLE",
              reason: "Offering is ready for use",
              expectedVersion: 6,
              idempotencyKey: "00000000-0000-4000-8000-000000000004",
            },
            null,
            2,
          ),
        },
        url: "{{baseUrl}}/api/v1/providers/{{providerId}}/services/{{providerServiceId}}/lifecycle",
      },
    },
    {
      name: "List provider service price history",
      request: {
        method: "GET",
        header: [authHeader],
        url: "{{baseUrl}}/api/v1/providers/{{providerId}}/services/{{providerServiceId}}/price-history",
      },
    },
    {
      name: "List provider service status history",
      request: {
        method: "GET",
        header: [authHeader],
        url: "{{baseUrl}}/api/v1/providers/{{providerId}}/services/{{providerServiceId}}/status-history",
      },
    },
  ];

  const staffItems: ProviderServicesPostmanItem[] = [
    {
      name: "List staff pending price proposals",
      request: {
        method: "GET",
        header: [authHeader],
        url: "{{baseUrl}}/api/v1/staff/providers/service-price-proposals",
      },
    },
    {
      name: "Get staff pending price proposal",
      request: {
        method: "GET",
        header: [authHeader],
        url: "{{baseUrl}}/api/v1/staff/providers/{{providerId}}/services/{{providerServiceId}}/price-proposals/{{providerServicePriceId}}",
      },
    },
    {
      name: "Decide staff price proposal",
      request: {
        method: "POST",
        header: [...jsonHeaders],
        body: {
          mode: "raw",
          raw: JSON.stringify(
            {
              decision: "APPROVE",
              reason: "Price evidence accepted",
              expectedVersion: 7,
              idempotencyKey: "00000000-0000-4000-8000-000000000005",
            },
            null,
            2,
          ),
        },
        url: "{{baseUrl}}/api/v1/staff/providers/{{providerId}}/services/{{providerServiceId}}/price-proposals/{{providerServicePriceId}}/decisions",
      },
    },
  ];

  const storyFolders: ProviderServicesPostmanItem[] = [
    {
      name: "Provider management",
      item: providerItems,
    },
    {
      name: "Staff price approval",
      item: staffItems,
    },
  ];

  const collection = {
    info: {
      // Must be a real UUID — non-hex ids (e.g. "p009") break VS Code extension create/import.
      _postman_id: "9f0a0c09-4000-8000-8000-000000000009",
      name: "Cleanora R1-P09 Provider Services",
      description: [
        `Protected Provider service management under ${R1_P09_PROVIDER_PATH_PREFIX}/:providerId/services`,
        `and Staff approval under ${R1_P09_STAFF_PATH_PREFIX}.`,
        "No anonymous Browse or Booking routes.",
        `Operations: ${R1_P09_OPENAPI_OPERATIONS.join(", ")}.`,
      ].join(" "),
      schema:
        "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    },
    auth: {
      type: "bearer",
      bearer: [{ key: "token", value: "{{accessToken}}", type: "string" }],
    },
    variable: [
      { key: "baseUrl", value: "http://localhost:8000" },
      { key: "hostUrl", value: "https://YOUR-HOSTED-DOMAIN.example" },
      { key: "accessToken", value: "" },
      { key: "providerId", value: "" },
      { key: "providerServiceId", value: "" },
      { key: "providerServicePriceId", value: "" },
      { key: "catalogPriceUnitId", value: "" },
    ],
    item: [
      {
        name: "Hosted (Not hosted yet)",
        item: withRawJsonLanguage(
          rewriteUrlPrefix(storyFolders, "{{hostUrl}}"),
        ),
      },
      {
        name: "Local",
        item: withRawJsonLanguage(
          rewriteUrlPrefix(storyFolders, "{{baseUrl}}"),
        ),
      },
    ],
  };

  void source;

  const out = resolve(
    process.cwd(),
    "postman",
    "Cleanora-R1-P09-Provider-Services.postman_collection.json",
  );
  await writeFile(out, `${JSON.stringify(collection, null, 2)}\n`, "utf8");
  console.log(`Wrote ${out}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
