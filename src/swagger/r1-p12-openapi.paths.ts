import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const yaml = require("js-yaml") as {
  load(input: string): unknown;
};

export const R1_P12_OPENAPI_SOURCE_PATH = resolve(
  process.cwd(),
  "docs/apis/openapi/r1-p12-browse-marketplace.yaml",
);

interface R1P12Document {
  readonly tags?: readonly Record<string, unknown>[];
  readonly paths?: Readonly<Record<string, Record<string, unknown>>>;
  readonly components?: {
    readonly parameters?: Readonly<Record<string, unknown>>;
    readonly responses?: Readonly<Record<string, unknown>>;
    readonly schemas?: Readonly<Record<string, unknown>>;
  };
}

/** Merge the canonical R1-P12 YAML paths and components into runtime Swagger. */
export function buildImplementedR1P12SwaggerFragments(): {
  readonly tags: readonly Record<string, unknown>[];
  readonly paths: Readonly<Record<string, Record<string, unknown>>>;
  readonly parameters: Readonly<Record<string, unknown>>;
  readonly responses: Readonly<Record<string, unknown>>;
  readonly schemas: Readonly<Record<string, unknown>>;
} {
  const document = yaml.load(
    readFileSync(R1_P12_OPENAPI_SOURCE_PATH, "utf8"),
  ) as R1P12Document;
  return {
    tags: document.tags ?? [],
    paths: document.paths ?? {},
    parameters: document.components?.parameters ?? {},
    responses: document.components?.responses ?? {},
    schemas: document.components?.schemas ?? {},
  };
}
