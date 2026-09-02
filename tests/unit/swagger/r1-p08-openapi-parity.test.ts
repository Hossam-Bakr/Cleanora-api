import { cleanoraOpenApiDocument } from "../../../src/swagger/openapi.document.js";
import {
  loadR1P08OpenApiSource,
  R1_P08_OPENAPI_OPERATIONS,
  R1_P08_PROTECTED_PATH_PREFIX,
} from "../../../src/swagger/r1-p08-openapi.paths.js";

type Operation = Readonly<Record<string, unknown>> & {
  readonly operationId?: string;
  readonly security?: unknown;
};

const HTTP_METHODS = new Set(["get", "post", "put", "patch", "delete"]);

function listOperations(
  paths: Readonly<Record<string, unknown>>,
): ReadonlyArray<readonly [string, string, Operation]> {
  const out: Array<readonly [string, string, Operation]> = [];
  for (const [path, methods] of Object.entries(paths)) {
    for (const [method, operation] of Object.entries(
      methods as Readonly<Record<string, Operation>>,
    )) {
      if (HTTP_METHODS.has(method)) {
        out.push([method, path, operation]);
      }
    }
  }
  return out;
}

function runtimeOperation(method: string, path: string): Operation | undefined {
  return (
    cleanoraOpenApiDocument.paths as unknown as Readonly<
      Record<string, Readonly<Record<string, Operation>>>
    >
  )[path]?.[method];
}

describe("R1-P08 design/runtime OpenAPI parity", () => {
  it("mounts every source R1-P08 path/method identically in the composed runtime document", () => {
    const source = loadR1P08OpenApiSource();
    const sourceOperations = listOperations(source.paths);
    expect(sourceOperations.length).toBeGreaterThan(0);
    expect(new Set(R1_P08_OPENAPI_OPERATIONS).size).toBe(
      R1_P08_OPENAPI_OPERATIONS.length,
    );

    const seenOperationIds = new Set<string>();
    for (const [method, path, design] of sourceOperations) {
      expect(path.startsWith(R1_P08_PROTECTED_PATH_PREFIX)).toBe(true);
      const runtime = runtimeOperation(method, path);
      expect(runtime, `${method.toUpperCase()} ${path}`).toEqual(design);
      if (typeof design.operationId === "string") {
        seenOperationIds.add(design.operationId);
      }
    }
    expect([...seenOperationIds].sort()).toEqual(
      [...R1_P08_OPENAPI_OPERATIONS].sort(),
    );
  });

  it("requires bearer security on every R1-P08 operation", () => {
    const source = loadR1P08OpenApiSource();
    for (const [method, path, design] of listOperations(source.paths)) {
      expect(design.security, `${method.toUpperCase()} ${path}`).toEqual([
        { bearerAuth: [] },
      ]);
      expect(runtimeOperation(method, path)?.security).toEqual([
        { bearerAuth: [] },
      ]);
    }
  });

  it("never documents anonymous or non-staff Catalog Browse services paths", () => {
    const runtimePaths = Object.keys(
      cleanoraOpenApiDocument.paths as unknown as Readonly<
        Record<string, unknown>
      >,
    );
    expect(
      runtimePaths.some(
        (path) =>
          /\/catalog\/services/u.test(path) &&
          !path.startsWith(R1_P08_PROTECTED_PATH_PREFIX),
      ),
    ).toBe(false);
    expect(runtimePaths.some((path) => path === "/catalog/services")).toBe(
      false,
    );
    expect(
      runtimePaths.some((path) => path.startsWith("/catalog/services/")),
    ).toBe(false);
  });

  it("describes R1-P08 Staff Catalog in OpenAPI info metadata", () => {
    expect(cleanoraOpenApiDocument.info.version).toBe("1.0.0-r1-p08");
    expect(cleanoraOpenApiDocument.info.summary).toMatch(/R1-P08/u);
    expect(cleanoraOpenApiDocument.info.summary).toMatch(/Staff Catalog/u);
    expect(cleanoraOpenApiDocument.info.description).toMatch(/R1-P08/u);
    expect(cleanoraOpenApiDocument.info.description).toMatch(
      /\/api\/v1\/staff\/catalog/u,
    );
    expect(cleanoraOpenApiDocument.info.description).toMatch(
      /no locale fallback/iu,
    );
    expect(cleanoraOpenApiDocument.info.description).toMatch(
      /no anonymous or customer Catalog Browse/iu,
    );
  });
});
