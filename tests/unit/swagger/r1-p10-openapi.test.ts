import { cleanoraOpenApiDocument } from "../../../src/swagger/openapi.document.js";
import {
  isR1P10ProtectedPath,
  loadR1P10OpenApiSource,
  R1_P10_OPENAPI_OPERATIONS,
  R1_P10_RUNTIME_HAS_NO_CUSTOMER_EVALUATION,
  buildImplementedR1P10SwaggerFragments,
} from "../../../src/swagger/r1-p10-openapi.paths.js";

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

describe("R1-P10 design/runtime OpenAPI parity", () => {
  it("mounts exactly nineteen source R1-P10 path/method operations in the composed runtime document", () => {
    const source = loadR1P10OpenApiSource();
    const sourceOperations = listOperations(source.paths ?? {});
    expect(sourceOperations).toHaveLength(19);
    expect(new Set(R1_P10_OPENAPI_OPERATIONS).size).toBe(
      R1_P10_OPENAPI_OPERATIONS.length,
    );
    expect(R1_P10_OPENAPI_OPERATIONS).toHaveLength(19);

    const seenOperationIds = new Set<string>();
    for (const [method, path, design] of sourceOperations) {
      expect(isR1P10ProtectedPath(path)).toBe(true);
      const runtime = runtimeOperation(method, path);
      expect(runtime, `${method.toUpperCase()} ${path}`).toEqual(design);
      if (typeof design.operationId === "string") {
        seenOperationIds.add(design.operationId);
      }
    }
    expect([...seenOperationIds].sort()).toEqual(
      [...R1_P10_OPENAPI_OPERATIONS].sort(),
    );
  });

  it("requires bearer security on every R1-P10 operation", () => {
    const source = loadR1P10OpenApiSource();
    for (const [method, path, design] of listOperations(source.paths ?? {})) {
      expect(design.security, `${method.toUpperCase()} ${path}`).toEqual([
        { bearerAuth: [] },
      ]);
      expect(runtimeOperation(method, path)?.security).toEqual([
        { bearerAuth: [] },
      ]);
    }
  });

  it("never exposes Eligibility or unprotected Provider availability paths", () => {
    const runtimePaths = Object.keys(
      cleanoraOpenApiDocument.paths as unknown as Readonly<
        Record<string, unknown>
      >,
    );
    expect(R1_P10_RUNTIME_HAS_NO_CUSTOMER_EVALUATION).toBe(true);
    expect(
      runtimePaths.some((path) => /\/eligibility/iu.test(path)),
    ).toBe(false);
    expect(
      runtimePaths.some(
        (path) =>
          /\/providers\/.*\/availability/u.test(path) &&
          !isR1P10ProtectedPath(path),
      ),
    ).toBe(false);
  });

  it("documents the catalogued Staff locality privileged reason code", () => {
    const source = loadR1P10OpenApiSource();
    const serialized = JSON.stringify(source);
    expect(serialized).toContain("configuration_locality_change");
    expect(serialized).not.toContain("configuration_locality_write");
  });

  it("describes R1-P10 availability surfaces in OpenAPI info metadata", () => {
    expect(cleanoraOpenApiDocument.info.version).toMatch(
      /^1\.0\.0-r1-p\d{2}$/u,
    );
    expect(cleanoraOpenApiDocument.info.description).toMatch(/R1-P10/u);
    expect(cleanoraOpenApiDocument.info.description).toMatch(
      /\/api\/v1\/staff\/configuration/u,
    );
    expect(cleanoraOpenApiDocument.info.description).toMatch(
      /\/api\/v1\/providers\/:providerId\/availability/u,
    );
    expect(cleanoraOpenApiDocument.info.description).toMatch(
      /no customer or anonymous availability evaluation/iu,
    );
  });

  it("exposes Staff and Provider tags with safe mutation schemas", () => {
    const fragments = buildImplementedR1P10SwaggerFragments();
    expect(fragments.tags.map((tag) => tag.name)).toEqual([
      "Staff Localities",
      "Staff Country Time Zone",
      "Provider Availability",
    ]);
    expect(fragments.schemas["R1P10ReplaceCoverageCommand"]).toBeDefined();
    expect(fragments.schemas["R1P10ReplaceCalendarCommand"]).toBeDefined();
    expect(fragments.schemas["R1P10StartPauseCommand"]).toBeDefined();
    expect(fragments.parameters["R1P10ProviderId"]).toBeDefined();

    for (const schemaName of [
      "R1P10ReplaceCoverageCommand",
      "R1P10ReplaceCalendarCommand",
      "R1P10ReplaceCapacityCommand",
      "R1P10StartPauseCommand",
      "R1P10ResumePauseCommand",
      "R1P10CreateCityCommand",
      "R1P10PutCountryTimeZoneCommand",
    ]) {
      const schema = fragments.schemas[schemaName] as {
        readonly properties?: Readonly<Record<string, unknown>>;
      };
      expect(schema.properties?.["idempotencyKey"]).toBeDefined();
      expect(schema.properties?.["password"]).toBeUndefined();
      expect(schema.properties?.["accessToken"]).toBeUndefined();
      expect(schema.properties?.["secret"]).toBeUndefined();
    }
  });
});
