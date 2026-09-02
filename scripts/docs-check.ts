/**
 * @desc Verify required R1-P01 documentation paths exist.
 * @access Maintainer tooling
 * @explanation This local validation fails when required docs or OpenAPI are missing.
 */
const { existsSync } = require("node:fs");
const { resolve } = require("node:path");

const requiredPaths = [
  'docs/swagger/README.md',
  'src/swagger/openapi.document.ts',
  'docs/apis/openapi/r1-p02-authentication.yaml',
  'postman/Cleanora-R1-P02-Authentication.postman_collection.json',
  "docs/apis/foundation-system.md",
  "docs/apis/openapi/r1-p01-foundation.yaml",
  "docs/apis/openapi/r1-p05-provider-onboarding-profile-lifecycle.yaml",
  "docs/apis/README.md",
  "postman/Cleanora-R1-P01-Foundation-Country-Configuration.postman_collection.json",
  "postman/Cleanora-R1-P05-Provider-Onboarding.postman_collection.json",
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
