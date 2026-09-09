import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  loadR1P10OpenApiSource,
  R1_P10_OPENAPI_OPERATIONS,
  R1_P10_PROVIDER_PATH_PREFIX,
  R1_P10_STAFF_PATH_PREFIX,
} from "../src/swagger/r1-p10-openapi.paths.js";

type UrlPrefix = "{{baseUrl}}" | "{{hostUrl}}";

interface AvailabilityPostmanRequest {
  readonly method: string;
  readonly header: readonly { readonly key: string; readonly value: string }[];
  readonly url: string;
  readonly body?: unknown;
}

interface AvailabilityPostmanItem {
  readonly name: string;
  readonly request?: AvailabilityPostmanRequest;
  readonly item?: readonly AvailabilityPostmanItem[];
}

function rewriteUrlPrefix(
  items: readonly AvailabilityPostmanItem[],
  prefix: UrlPrefix,
): AvailabilityPostmanItem[] {
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
 * `options.raw.language` (same shape as R1-P06/P09 generators).
 */
function withRawJsonLanguage(
  items: readonly AvailabilityPostmanItem[],
): AvailabilityPostmanItem[] {
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
 * Generate the canonical R1-P10 Postman collection under postman/.
 * Exactly the 19 protected operations; never writes customer evaluation requests.
 */
async function main(): Promise<void> {
  const source = loadR1P10OpenApiSource();
  const authHeader = {
    key: "Authorization",
    value: "Bearer {{accessToken}}",
  } as const;
  const jsonHeaders = [
    authHeader,
    { key: "Content-Type", value: "application/json" },
  ] as const;

  const staffItems: AvailabilityPostmanItem[] = [
    {
      name: "List staff cities",
      request: {
        method: "GET",
        header: [authHeader],
        url: "{{baseUrl}}/api/v1/staff/configuration/countries/{{countryId}}/cities",
      },
    },
    {
      name: "Create staff city",
      request: {
        method: "POST",
        header: [...jsonHeaders],
        body: {
          mode: "raw",
          raw: JSON.stringify(
            {
              code: "GIZA",
              nameAr: "الجيزة",
              nameEn: "Giza",
              idempotencyKey: "00000000-0000-4000-8000-000000000101",
              reasonCode: "configuration_locality_change",
            },
            null,
            2,
          ),
        },
        url: "{{baseUrl}}/api/v1/staff/configuration/countries/{{countryId}}/cities",
      },
    },
    {
      name: "Patch staff city",
      request: {
        method: "PATCH",
        header: [...jsonHeaders],
        body: {
          mode: "raw",
          raw: JSON.stringify(
            {
              isActive: false,
              expectedVersion: 1,
              idempotencyKey: "00000000-0000-4000-8000-000000000102",
              reasonCode: "configuration_locality_change",
            },
            null,
            2,
          ),
        },
        url: "{{baseUrl}}/api/v1/staff/configuration/cities/{{cityId}}",
      },
    },
    {
      name: "List staff districts",
      request: {
        method: "GET",
        header: [authHeader],
        url: "{{baseUrl}}/api/v1/staff/configuration/cities/{{cityId}}/districts",
      },
    },
    {
      name: "Create staff district",
      request: {
        method: "POST",
        header: [...jsonHeaders],
        body: {
          mode: "raw",
          raw: JSON.stringify(
            {
              code: "DOKKI",
              nameAr: "الدقي",
              nameEn: "Dokki",
              idempotencyKey: "00000000-0000-4000-8000-000000000103",
              reasonCode: "configuration_locality_change",
            },
            null,
            2,
          ),
        },
        url: "{{baseUrl}}/api/v1/staff/configuration/cities/{{cityId}}/districts",
      },
    },
    {
      name: "Patch staff district",
      request: {
        method: "PATCH",
        header: [...jsonHeaders],
        body: {
          mode: "raw",
          raw: JSON.stringify(
            {
              nameEn: "Dokki District",
              expectedVersion: 1,
              idempotencyKey: "00000000-0000-4000-8000-000000000104",
              reasonCode: "configuration_locality_change",
            },
            null,
            2,
          ),
        },
        url: "{{baseUrl}}/api/v1/staff/configuration/districts/{{districtId}}",
      },
    },
    {
      name: "Get staff country time zone",
      request: {
        method: "GET",
        header: [authHeader],
        url: "{{baseUrl}}/api/v1/staff/configuration/countries/{{countryId}}/time-zone",
      },
    },
    {
      name: "Put staff country time zone",
      request: {
        method: "PUT",
        header: [...jsonHeaders],
        body: {
          mode: "raw",
          raw: JSON.stringify(
            {
              timeZone: "Africa/Cairo",
              expectedVersion: 1,
              idempotencyKey: "00000000-0000-4000-8000-000000000105",
              reasonCode: "configuration_locality_change",
            },
            null,
            2,
          ),
        },
        url: "{{baseUrl}}/api/v1/staff/configuration/countries/{{countryId}}/time-zone",
      },
    },
  ];

  const providerItems: AvailabilityPostmanItem[] = [
    {
      name: "Get provider coverage",
      request: {
        method: "GET",
        header: [authHeader],
        url: "{{baseUrl}}/api/v1/providers/{{providerId}}/availability/coverage",
      },
    },
    {
      name: "Replace provider coverage",
      request: {
        method: "PUT",
        header: [...jsonHeaders],
        body: {
          mode: "raw",
          raw: JSON.stringify(
            {
              selections: [
                { type: "CITY", id: "{{cityId}}" },
                { type: "DISTRICT", id: "{{districtId}}" },
              ],
              expectedVersion: 2,
              idempotencyKey: "00000000-0000-4000-8000-000000000201",
            },
            null,
            2,
          ),
        },
        url: "{{baseUrl}}/api/v1/providers/{{providerId}}/availability/coverage",
      },
    },
    {
      name: "Get provider calendar",
      request: {
        method: "GET",
        header: [authHeader],
        url: "{{baseUrl}}/api/v1/providers/{{providerId}}/availability/calendar",
      },
    },
    {
      name: "Replace provider calendar",
      request: {
        method: "PUT",
        header: [...jsonHeaders],
        body: {
          mode: "raw",
          raw: JSON.stringify(
            {
              weeklyPeriods: [
                {
                  weekday: 1,
                  startMinute: 540,
                  endMinute: 1020,
                  endsNextDay: false,
                },
              ],
              exceptions: [
                {
                  localDate: "2026-09-15",
                  closed: true,
                  startMinute: null,
                  endMinute: null,
                  endsNextDay: null,
                },
              ],
              expectedVersion: 3,
              idempotencyKey: "00000000-0000-4000-8000-000000000202",
            },
            null,
            2,
          ),
        },
        url: "{{baseUrl}}/api/v1/providers/{{providerId}}/availability/calendar",
      },
    },
    {
      name: "Get worker calendar",
      request: {
        method: "GET",
        header: [authHeader],
        url: "{{baseUrl}}/api/v1/providers/{{providerId}}/availability/workers/{{workerId}}/calendar",
      },
    },
    {
      name: "Replace worker calendar",
      request: {
        method: "PUT",
        header: [...jsonHeaders],
        body: {
          mode: "raw",
          raw: JSON.stringify(
            {
              weeklyPeriods: [
                {
                  weekday: 2,
                  startMinute: 600,
                  endMinute: 1080,
                  endsNextDay: false,
                },
              ],
              exceptions: [],
              expectedVersion: 1,
              idempotencyKey: "00000000-0000-4000-8000-000000000203",
            },
            null,
            2,
          ),
        },
        url: "{{baseUrl}}/api/v1/providers/{{providerId}}/availability/workers/{{workerId}}/calendar",
      },
    },
    {
      name: "Get provider capacity",
      request: {
        method: "GET",
        header: [authHeader],
        url: "{{baseUrl}}/api/v1/providers/{{providerId}}/availability/capacity",
      },
    },
    {
      name: "Replace provider capacity",
      request: {
        method: "PUT",
        header: [...jsonHeaders],
        body: {
          mode: "raw",
          raw: JSON.stringify(
            {
              maxSimultaneousTeams: 3,
              expectedVersion: 0,
              idempotencyKey: "00000000-0000-4000-8000-000000000204",
            },
            null,
            2,
          ),
        },
        url: "{{baseUrl}}/api/v1/providers/{{providerId}}/availability/capacity",
      },
    },
    {
      name: "Get provider pause",
      request: {
        method: "GET",
        header: [authHeader],
        url: "{{baseUrl}}/api/v1/providers/{{providerId}}/availability/pause",
      },
    },
    {
      name: "Start provider pause",
      request: {
        method: "POST",
        header: [...jsonHeaders],
        body: {
          mode: "raw",
          raw: JSON.stringify(
            {
              endsAt: "2026-09-20T21:00:00.000+03:00",
              expectedVersion: 0,
              idempotencyKey: "00000000-0000-4000-8000-000000000205",
            },
            null,
            2,
          ),
        },
        url: "{{baseUrl}}/api/v1/providers/{{providerId}}/availability/pause",
      },
    },
    {
      name: "Resume provider pause",
      request: {
        method: "POST",
        header: [...jsonHeaders],
        body: {
          mode: "raw",
          raw: JSON.stringify(
            {
              expectedVersion: 1,
              idempotencyKey: "00000000-0000-4000-8000-000000000206",
            },
            null,
            2,
          ),
        },
        url: "{{baseUrl}}/api/v1/providers/{{providerId}}/availability/pause/resume",
      },
    },
  ];

  const storyFolders: AvailabilityPostmanItem[] = [
    {
      name: "Staff localities and time zone",
      item: staffItems,
    },
    {
      name: "Provider availability",
      item: providerItems,
    },
  ];

  const collection = {
    info: {
      // Must be a real UUID — non-hex ids break VS Code extension create/import.
      _postman_id: "a1b0c010-4000-8000-8000-000000000010",
      name: "Cleanora R1-P10 Availability Capacity Textual Coverage",
      description: [
        `Protected Staff localities/time-zone under ${R1_P10_STAFF_PATH_PREFIX}`,
        `and Provider availability under ${R1_P10_PROVIDER_PATH_PREFIX}/:providerId/availability.`,
        "No customer, anonymous, Browse, Booking, or reservation evaluation routes.",
        `Operations: ${R1_P10_OPENAPI_OPERATIONS.join(", ")}.`,
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
      { key: "countryId", value: "" },
      { key: "cityId", value: "" },
      { key: "districtId", value: "" },
      { key: "providerId", value: "" },
      { key: "workerId", value: "" },
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
    "Cleanora-R1-P10-Availability-Capacity-Textual-Coverage.postman_collection.json",
  );
  await writeFile(out, `${JSON.stringify(collection, null, 2)}\n`, "utf8");
  console.log(`Wrote ${out}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
