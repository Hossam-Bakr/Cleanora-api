import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { hasApprovedTestDatabaseUrl } from "../../helpers/resolve-test-database-url.js";
import { assertR1P05ProviderSchemaReady } from "../../helpers/assert-r1-p05-schema.js";
import { ensureActiveTestCountry } from "../../helpers/provider-fixtures.js";
import {
  signupAndLogin,
  startProviderApplicationTestApp,
} from "../../helpers/authentication/provider-application-test-app.js";
import {
  PROVIDER_PREVIEW_FIELD_ALLOWLIST,
  PROVIDER_PREVIEW_FORBIDDEN_MARKERS,
  mapProviderPreview,
  redactPrivateContactDetails,
} from "../../../src/modules/providers/provider.dto.js";
import {
  projectContactFreeProviderPreview,
  PROVIDER_PREVIEW_FORBIDDEN_MARKERS as PUBLIC_FORBIDDEN,
} from "../../../src/modules/providers/providers.public.js";

const request = require("supertest") as typeof import("supertest");

const hasDatabase = hasApprovedTestDatabaseUrl();

vi.setConfig({ testTimeout: 120_000 });

function collectKeys(value: unknown, path = ""): string[] {
  if (value === null || value === undefined) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      collectKeys(item, `${path}[${index}]`),
    );
  }
  if (typeof value !== "object") {
    return path.length === 0 ? [] : [path];
  }
  return Object.entries(value as Record<string, unknown>).flatMap(
    ([key, nested]) => {
      const next = path.length === 0 ? key : `${path}.${key}`;
      if (
        nested !== null &&
        typeof nested === "object" &&
        !Array.isArray(nested)
      ) {
        return [next, ...collectKeys(nested, next)];
      }
      if (Array.isArray(nested)) {
        return [next, ...collectKeys(nested, next)];
      }
      return [next];
    },
  );
}

function assertNoForbiddenMarkers(payload: unknown): void {
  const serialized = JSON.stringify(payload);
  for (const marker of PROVIDER_PREVIEW_FORBIDDEN_MARKERS) {
    expect(serialized).not.toMatch(new RegExp(marker, "i"));
  }
  expect(PUBLIC_FORBIDDEN).toEqual(PROVIDER_PREVIEW_FORBIDDEN_MARKERS);
}

describe.skipIf(!hasDatabase)(
  "US12 contact/secret redaction inventory (T131)",
  () => {
    it("keeps DTO/OpenAPI/runtime/log/error surfaces contact-free", async () => {
      const context = await startProviderApplicationTestApp();
      try {
        await assertR1P05ProviderSchemaReady();
        const country = await ensureActiveTestCountry(context.prisma);
        const session = await signupAndLogin(context.app, {
          accountCategory: "INDIVIDUAL",
          emailInbox: context.email,
          label: "us12-redact",
        });

        const created = await request(context.app)
          .post("/api/v1/providers")
          .set("Authorization", `Bearer ${session.accessToken}`)
          .send({ providerKind: "INDIVIDUAL_TEAM" })
          .expect(201);
        const providerId = created.body.data.provider.id as string;
        let version = created.body.data.provider.version as number;

        const profile = await request(context.app)
          .put(`/api/v1/providers/${providerId}/profile`)
          .set("Authorization", `Bearer ${session.accessToken}`)
          .send({
            displayNameAr: "معاينة",
            displayNameEn: "Preview",
            descriptionAr: "وصف",
            descriptionEn: "Desc",
            countryCode: country.code,
            expectedVersion: version,
          })
          .expect(200);
        version = profile.body.data.version as number;

        await request(context.app)
          .put(`/api/v1/providers/${providerId}/contacts`)
          .set("Authorization", `Bearer ${session.accessToken}`)
          .send({
            operationalEmail: "secret-ops@example.com",
            operationalPhone: "+201055501111",
            channels: [
              { type: "WHATSAPP", value: "+201055509999" },
              { type: "WEBSITE", value: "https://secret.example.com" },
              { type: "SOCIAL", value: "https://instagram.com/secret" },
              {
                type: "EXTERNAL_BOOKING",
                value: "https://book.example.com/x",
              },
            ],
            expectedVersion: version,
          })
          .expect(200);

        const preview = await request(context.app)
          .get(`/api/v1/providers/${providerId}/preview`)
          .set("Authorization", `Bearer ${session.accessToken}`)
          .expect(200);

        const previewData = preview.body.data as Record<string, unknown>;
        expect(Object.keys(previewData).sort()).toEqual(
          [...PROVIDER_PREVIEW_FIELD_ALLOWLIST].sort(),
        );
        assertNoForbiddenMarkers(preview.body);

        const mapped = mapProviderPreview({
          provider: { id: providerId, kind: "INDIVIDUAL_TEAM" },
          profile: {
            displayNameAr: "معاينة",
            displayNameEn: "Preview",
            descriptionAr: "وصف",
            descriptionEn: "Desc",
          },
          countryCode: country.code,
        });
        expect(Object.keys(mapped).sort()).toEqual(
          [...PROVIDER_PREVIEW_FIELD_ALLOWLIST].sort(),
        );
        assertNoForbiddenMarkers(mapped);

        const projected = projectContactFreeProviderPreview({
          provider: { id: providerId, kind: "INDIVIDUAL_TEAM" },
          profile: {
            displayNameAr: "معاينة",
            displayNameEn: "Preview",
            descriptionAr: "وصف",
            descriptionEn: "Desc",
          },
          countryCode: country.code,
        });
        assertNoForbiddenMarkers(projected);

        const denied = await request(context.app)
          .post("/api/v1/providers")
          .set("Authorization", `Bearer ${session.accessToken}`)
          .send({ providerKind: "REGISTERED_COMPANY" })
          .expect(409);
        assertNoForbiddenMarkers(denied.body);
        expect(collectKeys(denied.body).join(",")).not.toMatch(
          /secret-ops|instagram|whatsapp/iu,
        );

        const redacted = redactPrivateContactDetails({
          operationalEmail: "secret-ops@example.com",
          operationalPhone: "+201055501111",
          channels: [{ type: "WHATSAPP", value: "+201055509999" }],
          denialCodes: ["ELIGIBLE_CATEGORY_VERIFIED"],
          recoveryHints: ["ENROLL_AND_VERIFY_COMPANY"],
        });
        expect(redacted).toEqual({
          denialCodes: ["ELIGIBLE_CATEGORY_VERIFIED"],
          recoveryHints: ["ENROLL_AND_VERIFY_COMPANY"],
        });

        const openApi = await readFile(
          join(
            process.cwd(),
            "docs/apis/openapi/r1-p05-provider-onboarding-profile-lifecycle.yaml",
          ),
          "utf8",
        );
        expect(openApi).toMatch(/getProviderContactFreePreview/);
        const previewSection = openApi.slice(
          openApi.indexOf("/providers/{providerId}/preview:"),
          openApi.indexOf("/providers/{providerId}/members:"),
        );
        expect(previewSection).not.toMatch(
          /operationalEmail|whatsapp|EXTERNAL_BOOKING/iu,
        );

        const logBlob = JSON.stringify(context.logger);
        expect(logBlob).not.toMatch(/secret-ops@example\.com/iu);
        expect(logBlob).not.toMatch(/\+201055509999/);
      } finally {
        await context.stop();
      }
    });
  },
);
