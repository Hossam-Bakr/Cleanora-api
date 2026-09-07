import { cleanoraOpenApiDocument } from "../../../src/swagger/openapi.document.js";
import {
  isR1P09ProtectedPath,
  loadR1P09OpenApiSource,
  R1_P09_OPENAPI_OPERATIONS,
} from "../../../src/swagger/r1-p09-openapi.paths.js";

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

describe("R1-P09 design/runtime OpenAPI parity", () => {
  it("mounts exactly eleven source R1-P09 path/method operations in the composed runtime document", () => {
    const source = loadR1P09OpenApiSource();
    const sourceOperations = listOperations(source.paths);
    expect(sourceOperations).toHaveLength(11);
    expect(new Set(R1_P09_OPENAPI_OPERATIONS).size).toBe(
      R1_P09_OPENAPI_OPERATIONS.length,
    );
    expect(R1_P09_OPENAPI_OPERATIONS).toHaveLength(11);

    const seenOperationIds = new Set<string>();
    for (const [method, path, design] of sourceOperations) {
      expect(isR1P09ProtectedPath(path)).toBe(true);
      const runtime = runtimeOperation(method, path);
      expect(runtime, `${method.toUpperCase()} ${path}`).toEqual(design);
      if (typeof design.operationId === "string") {
        seenOperationIds.add(design.operationId);
      }
    }
    expect([...seenOperationIds].sort()).toEqual(
      [...R1_P09_OPENAPI_OPERATIONS].sort(),
    );
  });

  it("requires bearer security on every R1-P09 operation", () => {
    const source = loadR1P09OpenApiSource();
    for (const [method, path, design] of listOperations(source.paths)) {
      expect(design.security, `${method.toUpperCase()} ${path}`).toEqual([
        { bearerAuth: [] },
      ]);
      expect(runtimeOperation(method, path)?.security).toEqual([
        { bearerAuth: [] },
      ]);
    }
  });

  it("never documents anonymous Browse or Booking service paths", () => {
    const runtimePaths = Object.keys(
      cleanoraOpenApiDocument.paths as unknown as Readonly<
        Record<string, unknown>
      >,
    );
    expect(runtimePaths.some((path) => /\/browse\b/iu.test(path))).toBe(false);
    expect(runtimePaths.some((path) => /\/booking/iu.test(path))).toBe(false);
    expect(
      runtimePaths.some(
        (path) =>
          path === "/providers/services" ||
          path.startsWith("/providers/services/"),
      ),
    ).toBe(false);
    expect(
      runtimePaths.some(
        (path) =>
          /\/providers\/.*\/services/u.test(path) &&
          !isR1P09ProtectedPath(path),
      ),
    ).toBe(false);
  });

  it("describes R1-P09 Provider services in OpenAPI info metadata", () => {
    expect(cleanoraOpenApiDocument.info.version).toBe("1.0.0-r1-p09");
    expect(cleanoraOpenApiDocument.info.summary).toMatch(/R1-P09/u);
    expect(cleanoraOpenApiDocument.info.summary).toMatch(/Provider services/iu);
    expect(cleanoraOpenApiDocument.info.description).toMatch(/R1-P09/u);
    expect(cleanoraOpenApiDocument.info.description).toMatch(
      /\/api\/v1\/providers\/:providerId\/services/u,
    );
    expect(cleanoraOpenApiDocument.info.description).toMatch(
      /\/api\/v1\/staff\/providers/u,
    );
    expect(cleanoraOpenApiDocument.info.description).toMatch(
      /no anonymous Browse or Booking/iu,
    );
  });
});
