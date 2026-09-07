import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { cleanoraOpenApiDocument } from "../../../src/swagger/openapi.document.js";
import {
  isR1P09ProtectedPath,
  loadR1P09OpenApiSource,
  R1_P09_OPENAPI_OPERATIONS,
} from "../../../src/swagger/r1-p09-openapi.paths.js";

const HTTP_METHODS = new Set(["get", "post", "put", "patch", "delete"]);

const FORBIDDEN_PATH_MARKERS = [
  /\/browse\b/iu,
  /\/booking\b/iu,
  /\/api\/v1\/catalog\/services/iu,
] as const;

const FORBIDDEN_FIELD_MARKERS = [
  /"subtotal"/u,
  /"total"/u,
  /"tax"/u,
  /"fee"/u,
  /"discount"/u,
  /"commission"/u,
  /"deposit"/u,
  /"payable"/u,
] as const;

const ROUTES_SOURCE = readFileSync(
  resolve("src/modules/providers/provider-service.routes.ts"),
  "utf8",
);
const OPENAPI_SOURCE = readFileSync(
  resolve("src/swagger/r1-p09-openapi.paths.ts"),
  "utf8",
);
const POSTMAN_COLLECTION = readFileSync(
  resolve("postman/Cleanora-R1-P09-Provider-Services.postman_collection.json"),
  "utf8",
);

function listOperationIds(
  paths: Readonly<Record<string, unknown>>,
): string[] {
  const ids: string[] = [];
  for (const methods of Object.values(paths)) {
    for (const [method, operation] of Object.entries(
      methods as Readonly<Record<string, { readonly operationId?: string }>>,
    )) {
      if (
        HTTP_METHODS.has(method) &&
        typeof operation.operationId === "string"
      ) {
        ids.push(operation.operationId);
      }
    }
  }
  return ids;
}

describe("R1-P09 Provider services negative surface", () => {
  it("keeps OpenAPI, routes, and Postman limited to the eleven protected operations", () => {
    const source = loadR1P09OpenApiSource();
    const sourceIds = listOperationIds(source.paths).sort();
    expect(sourceIds).toEqual([...R1_P09_OPENAPI_OPERATIONS].sort());

    const runtimeIds = listOperationIds(
      Object.fromEntries(
        Object.entries(
          cleanoraOpenApiDocument.paths as unknown as Readonly<
            Record<string, unknown>
          >,
        ).filter(([path]) => isR1P09ProtectedPath(path)),
      ),
    ).sort();
    expect(runtimeIds).toEqual(sourceIds);

    expect(ROUTES_SOURCE).toContain("/:providerId/services");
    expect(ROUTES_SOURCE).toContain("/service-price-proposals");
    expect(ROUTES_SOURCE).toContain("/decisions");
    expect(ROUTES_SOURCE).not.toMatch(/\/browse\b/iu);
    expect(ROUTES_SOURCE).not.toMatch(/\/booking\b/iu);
  });

  it("rejects anonymous Browse, Booking, and client monetary-result markers across the surface", () => {
    for (const surface of [
      ["routes", ROUTES_SOURCE],
      ["openapi", OPENAPI_SOURCE],
      ["postman", POSTMAN_COLLECTION],
    ] as const) {
      const [label, text] = surface;
      for (const marker of FORBIDDEN_PATH_MARKERS) {
        expect(text, `${label} must not match ${marker}`).not.toMatch(marker);
      }
    }

    for (const surface of [
      ["routes", ROUTES_SOURCE],
      ["postman", POSTMAN_COLLECTION],
    ] as const) {
      const [label, text] = surface;
      for (const marker of FORBIDDEN_FIELD_MARKERS) {
        expect(text, `${label} must not match ${marker}`).not.toMatch(marker);
      }
    }

    expect(POSTMAN_COLLECTION).not.toMatch(/\/api\/v1\/browse/iu);
    expect(POSTMAN_COLLECTION).not.toMatch(/\/api\/v1\/booking/iu);
    expect(OPENAPI_SOURCE).not.toMatch(/"\/providers\/services"/u);
  });

  it("documents only bearer-protected Provider and Staff paths in the composed document", () => {
    const paths = Object.keys(
      cleanoraOpenApiDocument.paths as unknown as Readonly<
        Record<string, unknown>
      >,
    );
    const p09Paths = paths.filter((path) => isR1P09ProtectedPath(path));
    expect(p09Paths.length).toBeGreaterThan(0);
    for (const path of p09Paths) {
      expect(path.startsWith("/providers/") || path.startsWith("/staff/providers")).toBe(
        true,
      );
    }
    expect(paths.some((path) => /\/browse\b/iu.test(path))).toBe(false);
    expect(paths.some((path) => /\/booking/iu.test(path))).toBe(false);
  });
});
