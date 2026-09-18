import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * @desc Merge R1-P18 order paths into the runtime OpenAPI document.
 * @access Swagger composition
 */
export function buildImplementedR1P18SwaggerFragments(): {
  readonly paths: Record<string, unknown>;
  readonly tags: readonly { readonly name: string; readonly description: string }[];
} {
  const yaml = require("js-yaml") as {
    load(input: string): unknown;
  };
  const document = yaml.load(
    readFileSync(
      resolve(
        process.cwd(),
        "docs/apis/openapi/r1-p18-order-execution-completion-code.yaml",
      ),
      "utf8",
    ),
  ) as { readonly paths?: Record<string, unknown> };
  return {
    paths: document.paths === undefined ? {} : document.paths,
    tags: [
      {
        name: "Orders",
        description:
          "R1-P18 order execution, completion codes, media, notes, and timeline",
      },
    ],
  };
}
