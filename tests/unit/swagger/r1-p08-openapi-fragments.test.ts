import {
  buildImplementedR1P08SwaggerFragments,
  loadR1P08OpenApiSource,
  R1_P08_OPENAPI_OPERATIONS,
  R1_P08_OPENAPI_TAG,
  R1_P08_PROTECTED_PATH_PREFIX,
  R1_P08_RUNTIME_HAS_NO_ANONYMOUS_BROWSE,
} from "../../../src/swagger/r1-p08-openapi.paths.js";

const HTTP_METHODS = new Set(["get", "post", "put", "patch", "delete"]);

describe("R1-P08 runtime OpenAPI fragments", () => {
  it("exposes the Staff Catalog tag and protected operations/components only", () => {
    const fragments = buildImplementedR1P08SwaggerFragments();
    const source = loadR1P08OpenApiSource();

    expect(fragments.tags).toEqual([
      {
        name: R1_P08_OPENAPI_TAG,
        description:
          "Protected staff Catalog management. No anonymous or customer Browse routes.",
      },
    ]);
    expect(fragments.paths).toEqual(source.paths);
    expect(fragments.schemas).toEqual(source.components.schemas);
    expect(fragments.parameters).toEqual(source.components.parameters);

    const operationIds = new Set<string>();
    for (const [path, methods] of Object.entries(fragments.paths)) {
      expect(path.startsWith(R1_P08_PROTECTED_PATH_PREFIX)).toBe(true);
      for (const [method, operation] of Object.entries(
        methods as Readonly<Record<string, { readonly operationId?: string }>>,
      )) {
        if (!HTTP_METHODS.has(method)) {
          continue;
        }
        if (typeof operation.operationId === "string") {
          operationIds.add(operation.operationId);
        }
      }
    }
    expect([...operationIds].sort()).toEqual(
      [...R1_P08_OPENAPI_OPERATIONS].sort(),
    );
    expect(fragments.schemas["R1P08ServiceManagementDto"]).toBeDefined();
    expect(fragments.schemas["R1P08CreateCategoryCommand"]).toBeDefined();
    expect(fragments.parameters["R1P08CategoryId"]).toBeDefined();
  });

  it("keeps the no-anonymous-Browse contract closed", () => {
    const fragments = buildImplementedR1P08SwaggerFragments();
    expect(R1_P08_RUNTIME_HAS_NO_ANONYMOUS_BROWSE).toBe(true);
    expect(
      Object.keys(fragments.paths).some(
        (path) =>
          /\/catalog\/services/u.test(path) &&
          !path.startsWith(R1_P08_PROTECTED_PATH_PREFIX),
      ),
    ).toBe(false);
    expect(fragments.paths["/catalog/services"]).toBeUndefined();
    expect(
      Object.keys(fragments.paths).some((path) =>
        path.startsWith("/catalog/services"),
      ),
    ).toBe(false);
  });
});
