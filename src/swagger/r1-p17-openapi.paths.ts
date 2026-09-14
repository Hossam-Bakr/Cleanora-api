import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * @desc Merge R1-P17 assignment paths into the runtime OpenAPI document.
 * @access Swagger composition
 */
export function buildImplementedR1P17SwaggerFragments(): {
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
        "docs/apis/openapi/r1-p17-worker-team-assignment.yaml",
      ),
      "utf8",
    ),
  ) as { readonly paths?: Record<string, unknown> };
  return {
    paths: document.paths === undefined ? {} : document.paths,
    tags: [
      {
        name: "BookingAssignment",
        description: "R1-P17 provider assign/replace and assignment reads",
      },
      {
        name: "WorkerAssignments",
        description: "R1-P17 worker order visibility",
      },
    ],
  };
}
