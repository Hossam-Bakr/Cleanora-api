/**
 * @desc Verify required R1-P01 documentation paths exist.
 * @access Maintainer tooling
 * @explanation This script fails CI when foundation docs or OpenAPI are missing.
 */
const { existsSync } = require("node:fs");
const { resolve } = require("node:path");

const requiredPaths = [
  "docs/apis/foundation-system.md",
  "docs/apis/openapi/r1-p01-foundation.yaml",
  "docs/apis/README.md",
  "postman/R1-P01-foundation-country-configuration.postman_collection.json",
  "specs/R1-P01-project-foundation-country-configuration/spec.md",
  "specs/R1-P01-project-foundation-country-configuration/plan.md"
];

const missing = requiredPaths.filter(
  (relativePath) => !existsSync(resolve(process.cwd(), relativePath))
);

if (missing.length > 0) {
  process.stderr.write(
    `${JSON.stringify({ ok: false, error: "DOCS_CHECK_FAILED", missing }, null, 2)}\n`
  );
  process.exitCode = 1;
} else {
  process.stdout.write(`${JSON.stringify({ ok: true, checked: requiredPaths.length })}\n`);
}
