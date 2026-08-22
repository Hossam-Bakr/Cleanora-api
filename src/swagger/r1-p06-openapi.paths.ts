import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const yaml = require("js-yaml") as { load: (input: string) => unknown };

export const R1_P06_OPENAPI_SOURCE_PATH = resolve(
  process.cwd(),
  "specs/R1-P06-provider-verification-external-payout-destinations/contracts/provider-verification-api.openapi.yaml",
);

type OpenApiDocumentLike = {
  readonly paths?: Readonly<Record<string, Record<string, unknown>>>;
  readonly components?: {
    readonly schemas?: Readonly<Record<string, unknown>>;
    readonly parameters?: Readonly<Record<string, unknown>>;
    readonly responses?: Readonly<Record<string, unknown>>;
    readonly requestBodies?: Readonly<Record<string, unknown>>;
  };
  readonly tags?: readonly { readonly name: string; readonly description?: string }[];
};

const httpMethods = new Set(["get", "post", "put", "patch", "delete"]);

export function loadR1P06OpenApiSource(): OpenApiDocumentLike {
  return yaml.load(readFileSync(R1_P06_OPENAPI_SOURCE_PATH, "utf8")) as OpenApiDocumentLike;
}

export function r1P06OperationInventory(paths: Readonly<Record<string, Record<string, unknown>>>): string[] {
  return Object.entries(paths)
    .flatMap(([path, item]) => Object.keys(item)
      .filter((method) => httpMethods.has(method))
      .map((method) => `${method.toUpperCase()} ${path}`))
    .sort();
}

export function buildImplementedR1P06SwaggerFragments() {
  const source = loadR1P06OpenApiSource();
  const paths = Object.fromEntries(
    Object.entries(source.paths ?? {}).map(([path, item]) => [
      path,
      Object.fromEntries(Object.entries(item).filter(([method]) => httpMethods.has(method))),
    ]),
  );
  const operationInventory = r1P06OperationInventory(paths);
  if (operationInventory.length !== 37) {
    throw new Error(`R1-P06 OpenAPI/runtime inventory drift: expected 37 operations, received ${operationInventory.length}`);
  }
  return {
    paths,
    tags: (source.tags ?? []).map((tag) => ({
      name: tag.name,
      description: tag.description ?? `R1-P06 ${tag.name} operations.`,
    })),
    schemas: { ...(source.components?.schemas ?? {}) },
    parameters: { ...(source.components?.parameters ?? {}) },
    responses: { ...(source.components?.responses ?? {}) },
    requestBodies: { ...(source.components?.requestBodies ?? {}) },
    operationInventory,
  };
}
