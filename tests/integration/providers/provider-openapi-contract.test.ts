import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { cleanoraOpenApiDocument } from "../../../src/swagger/openapi.document.js";
import {
  R1_P05_IMPLEMENTED_OPERATIONS,
  countOpenApiOperations,
  loadR1P05OpenApiSource,
} from "../../../src/swagger/r1-p05-openapi.paths.js";

const yaml = require("js-yaml") as { load: (input: string) => unknown };

describe("Provider OpenAPI contract parity (T146)", () => {
  it("keeps the source R1-P05 contract at 41 operations including suspend/reinstate", () => {
    const source = loadR1P05OpenApiSource();
    expect(countOpenApiOperations(source.paths)).toBe(41);
    expect(source.paths?.["/staff/providers/{providerId}/suspend"]?.["post"]).toBeDefined();
    expect(
      source.paths?.["/staff/providers/{providerId}/reinstate"]?.["post"],
    ).toBeDefined();
    expect(source.paths?.["/providers"]).not.toHaveProperty("options");
    expect(Object.keys(source.paths ?? {}).some((path) => path.includes("browse"))).toBe(
      false,
    );
  });

  it("publishes every implemented Provider operation in runtime Swagger", () => {
    const implemented = new Set(R1_P05_IMPLEMENTED_OPERATIONS);
    for (const key of implemented) {
      const [method, path] = key.split(" ") as [string, string];
      const pathItem = cleanoraOpenApiDocument.paths[
        path as keyof typeof cleanoraOpenApiDocument.paths
      ] as Record<string, unknown> | undefined;
      expect(pathItem, key).toBeDefined();
      expect(pathItem?.[method.toLowerCase()], key).toBeDefined();
    }
    expect(implemented.has("POST /staff/providers/{providerId}/suspend")).toBe(
      true,
    );
    expect(
      implemented.has("POST /staff/providers/{providerId}/reinstate"),
    ).toBe(true);
  });

  it("preserves the stable success/error envelope shapes", () => {
    const success = cleanoraOpenApiDocument.components.schemas
      .SuccessEnvelope as unknown as {
      required: string[];
    };
    const error = cleanoraOpenApiDocument.components.schemas
      .ErrorEnvelope as unknown as {
      required: string[];
      properties: { error: { required: string[] } };
    };
    expect(success.required).toEqual(
      expect.arrayContaining(["success", "data", "requestId"]),
    );
    expect(error.required).toEqual(
      expect.arrayContaining(["success", "error", "requestId"]),
    );
    expect(error.properties.error.required).toEqual(
      expect.arrayContaining(["code", "statusCode", "message"]),
    );

    const source = yaml.load(
      readFileSync(
        resolve(
          "docs/apis/openapi/r1-p05-provider-onboarding-profile-lifecycle.yaml",
        ),
        "utf8",
      ),
    ) as {
      components: {
        schemas: {
          ErrorEnvelope: { properties: { error: { required: string[] } } };
        };
      };
    };
    expect(source.components.schemas.ErrorEnvelope.properties.error.required).toEqual(
      expect.arrayContaining(["code", "message"]),
    );
  });
});
