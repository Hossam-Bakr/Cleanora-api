import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const yaml = require("js-yaml") as {
  load(input: string): unknown;
};

/**
 * @desc Merge R1-P15 payment paths into the runtime OpenAPI document.
 * @access Swagger composition
 */
export function buildImplementedR1P15SwaggerFragments(): {
  readonly paths: Record<string, unknown>;
  readonly tags: readonly { readonly name: string; readonly description: string }[];
} {
  const document = yaml.load(
    readFileSync(
      resolve(
        process.cwd(),
        "docs/apis/openapi/r1-p15-deposit-payments-methods-webhooks.yaml",
      ),
      "utf8",
    ),
  ) as { readonly paths?: Record<string, unknown> };
  return {
    paths: document.paths ?? {},
    tags: [
      {
        name: "Payments",
        description: "R1-P15 customer deposit payment operations",
      },
      {
        name: "PaymentsWebhooks",
        description: "R1-P15 Paymob webhook receiver",
      },
      {
        name: "StaffPayments",
        description: "R1-P15 staff payment method configuration",
      },
    ],
  };
}
