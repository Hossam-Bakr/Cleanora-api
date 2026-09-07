import {
  buildImplementedR1P09SwaggerFragments,
  isR1P09ProtectedPath,
  loadR1P09OpenApiSource,
  R1_P09_OPENAPI_OPERATIONS,
  R1_P09_OPENAPI_PROVIDER_TAG,
  R1_P09_OPENAPI_STAFF_TAG,
  R1_P09_RUNTIME_HAS_NO_ANONYMOUS_BROWSE_OR_BOOKING,
} from "../../../src/swagger/r1-p09-openapi.paths.js";

const HTTP_METHODS = new Set(["get", "post", "put", "patch", "delete"]);

describe("R1-P09 runtime OpenAPI fragments", () => {
  it("exposes Provider and Staff tags with exactly eleven protected operations", () => {
    const fragments = buildImplementedR1P09SwaggerFragments();
    const source = loadR1P09OpenApiSource();

    expect(fragments.tags).toEqual([
      {
        name: R1_P09_OPENAPI_PROVIDER_TAG,
        description:
          "Protected Provider-admin service and pricing management. No anonymous Browse or Booking routes.",
      },
      {
        name: R1_P09_OPENAPI_STAFF_TAG,
        description:
          "Protected Staff price-proposal review under providers.services.prices.approve. No customer or Booking surface.",
      },
    ]);
    expect(fragments.paths).toEqual(source.paths);
    expect(fragments.schemas).toEqual(source.components.schemas);
    expect(fragments.parameters).toEqual(source.components.parameters);

    const operationIds = new Set<string>();
    for (const [path, methods] of Object.entries(fragments.paths)) {
      expect(isR1P09ProtectedPath(path)).toBe(true);
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
      [...R1_P09_OPENAPI_OPERATIONS].sort(),
    );
    expect(operationIds.size).toBe(11);
    expect(fragments.schemas["R1P09ProviderServiceManagementDto"]).toBeDefined();
    expect(fragments.schemas["R1P09CreateProviderServiceCommand"]).toBeDefined();
    expect(fragments.schemas["R1P09StaffPriceDecisionCommand"]).toBeDefined();
    expect(fragments.parameters["R1P09ProviderId"]).toBeDefined();
  });

  it("keeps the no-anonymous-Browse-or-Booking contract closed", () => {
    const fragments = buildImplementedR1P09SwaggerFragments();
    expect(R1_P09_RUNTIME_HAS_NO_ANONYMOUS_BROWSE_OR_BOOKING).toBe(true);
    expect(
      Object.keys(fragments.paths).some((path) => /\/browse\b/iu.test(path)),
    ).toBe(false);
    expect(
      Object.keys(fragments.paths).some((path) => /\/booking/iu.test(path)),
    ).toBe(false);
    expect(fragments.paths["/providers/services"]).toBeUndefined();
    expect(fragments.paths["/catalog/services"]).toBeUndefined();
  });

  it("rejects client monetary-result fields on mutation schemas", () => {
    const fragments = buildImplementedR1P09SwaggerFragments();
    for (const schemaName of [
      "R1P09CreateProviderServiceCommand",
      "R1P09ReplaceProviderServiceConfigurationCommand",
      "R1P09ProposeProviderServicePriceCommand",
      "R1P09ProviderServiceLifecycleCommand",
      "R1P09StaffPriceDecisionCommand",
    ]) {
      const schema = fragments.schemas[schemaName] as {
        readonly additionalProperties?: boolean;
        readonly properties?: Readonly<Record<string, unknown>>;
      };
      expect(schema.additionalProperties).toBe(false);
      for (const forbidden of [
        "subtotal",
        "total",
        "tax",
        "fee",
        "discount",
        "commission",
        "deposit",
        "payable",
      ]) {
        expect(schema.properties?.[forbidden]).toBeUndefined();
      }
    }
  });
});
