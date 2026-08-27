
import { cleanoraOpenApiDocument } from "../../../src/swagger/openapi.document.js";
import {
  loadR1P07OpenApiSource,
  R1_P07_OPENAPI_OPERATIONS,
  R1_P07_OPERATION_IDS,
} from "../../../src/swagger/r1-p07-openapi.paths.js";

type Operation = Readonly<Record<string, unknown>> & { readonly operationId?: string };

function runtimeOperation(method: string, path: string): Operation | undefined {
  return (cleanoraOpenApiDocument.paths as unknown as Readonly<Record<string, Readonly<Record<string, Operation>>>>)[path]?.[method];
}

describe("R1-P07 design/runtime OpenAPI parity", () => {
  it("mounts every and only the 25 approved runtime operation identities", () => {
    expect(R1_P07_OPENAPI_OPERATIONS).toHaveLength(25);
    expect(new Set(R1_P07_OPERATION_IDS).size).toBe(25);
    const actual = R1_P07_OPENAPI_OPERATIONS.map(([method, path]) => runtimeOperation(method, path)?.operationId);
    expect(actual).toEqual(R1_P07_OPERATION_IDS);
  });

  it("preserves exact design path operations, schemas, parameters, responses, security, and error contracts", () => {
    const source = loadR1P07OpenApiSource();
    for (const [method, path, operationId] of R1_P07_OPENAPI_OPERATIONS) {
      const design = source.paths?.[path]?.[method] as Operation | undefined;
      const runtime = runtimeOperation(method, path);
      expect(design?.operationId).toBe(operationId);
      expect(runtime, `${method.toUpperCase()} ${path}`).toEqual(design);
    }
    const runtimeComponents = cleanoraOpenApiDocument.components as Readonly<Record<string, unknown>>;
    expect(runtimeComponents["schemas"]).toEqual(expect.objectContaining(source.components?.schemas ?? {}));
    expect(runtimeComponents["parameters"]).toEqual(expect.objectContaining(source.components?.parameters ?? {}));
    expect(runtimeComponents["responses"]).toEqual(expect.objectContaining(source.components?.responses ?? {}));
    expect(runtimeComponents["requestBodies"]).toEqual(expect.objectContaining(source.components?.requestBodies ?? {}));
    const runtimeSecurity = runtimeComponents["securitySchemes"] as Readonly<Record<string, unknown>>;
    for (const [name, scheme] of Object.entries(source.components?.securitySchemes ?? {})) {
      expect(runtimeSecurity[name]).toEqual(expect.objectContaining(scheme as Readonly<Record<string, unknown>>));
    }
  });

  it("keeps invitation routes explicitly public and all private responses no-store", () => {
    const source = loadR1P07OpenApiSource();
    for (const path of [
      "/worker-invitations/inspect",
      "/worker-invitations/onboarding/start",
      "/worker-invitations/onboarding/verify-email",
    ]) {
      expect(source.paths?.[path]?.["post"]).toEqual(expect.objectContaining({ security: [] }));
    }
    const serializedResponses = JSON.stringify(source.components?.responses ?? {});
    expect(serializedResponses).toContain("no-store, private");
    expect(serializedResponses).toContain("no private existence, phone, proof, credential");
  });
});
