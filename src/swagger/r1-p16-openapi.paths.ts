import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const yaml = require("js-yaml") as {
  load(input: string): unknown;
};

/**
 * @desc Merge R1-P16 booking-response paths into the runtime OpenAPI document.
 * @access Swagger composition
 */
export function buildImplementedR1P16SwaggerFragments(): {
  readonly paths: Record<string, unknown>;
  readonly tags: readonly { readonly name: string; readonly description: string }[];
} {
  const document = yaml.load(
    readFileSync(
      resolve(
        process.cwd(),
        "docs/apis/openapi/r1-p16-provider-booking-response-cancellation-events.yaml",
      ),
      "utf8",
    ),
  ) as { readonly paths?: Record<string, unknown> };
  return {
    paths: document.paths === undefined ? {} : document.paths,
    tags: [
      {
        name: "BookingResponse",
        description: "R1-P16 selected-provider inbox, accept, reject, and cancel",
      },
      {
        name: "StaffBookings",
        description: "R1-P16 staff booking dossier and privileged cancel",
      },
    ],
  };
}
