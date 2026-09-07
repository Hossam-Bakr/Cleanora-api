import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";


describe("OpenAPI validation tooling", () => {
  it("rejects malformed YAML even when expected path strings are present", { timeout: 30_000 }, async () => {
    const directory = await mkdtemp(join(tmpdir(), "cleanora-openapi-"));
    const documentPath = join(directory, "invalid.yaml");
    await writeFile(
      documentPath,
      [
        "openapi: 3.1.0",
        "paths:",
        "  /api/v1/system/health/live: {}",
        "  /api/v1/system/health/ready: {}",
        "  /api/v1/system/health/database: {}",
        "broken: ["
      ].join("\n"),
      "utf8"
    );

    try {
      const result = spawnSync(
        process.execPath,
        [
          "--conditions=development",
          "--import",
          "tsx",
          "scripts/openapi-validate.ts",
          documentPath
        ],
        { cwd: process.cwd(), encoding: "utf8" }
      );

      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("OPENAPI_INVALID");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  // R1-P03 role management is an internal contract, so no published document
  // may gain a role, permission, or privileged-audit path.
  it("publishes no R1-P03 authorization path in foundation and authentication docs", async () => {
    const documents = [
      "docs/apis/openapi/r1-p01-foundation.yaml",
      "docs/apis/openapi/r1-p02-authentication.yaml",
    ];

    for (const document of documents) {
      const yaml = await readFile(resolve(document), "utf8");
      const pathLines = yaml
        .split("\n")
        .filter((line) => /^\s{2}\/api\//u.test(line));

      for (const pathLine of pathLines) {
        expect(pathLine).not.toMatch(
          /\/(roles?|permissions?|user-roles|privileged)\b/iu,
        );
      }
    }
  });

  it("keeps the runtime document free of unpublished R1-P03 authorization paths", async () => {
    const { cleanoraOpenApiDocument } = await import(
      "../../../src/swagger/openapi.document.js"
    );
    const approvedR1P03APaths = new Set([
      "/auth/role-grants/commands",
      "/internal/owner/staff-admins",
    ]);

    for (const path of Object.keys(cleanoraOpenApiDocument.paths ?? {})) {
      if (approvedR1P03APaths.has(path)) {
        continue;
      }
      expect(path).not.toMatch(
        /\/(roles?|permissions?|user-roles|privileged)\b/iu,
      );
    }
  });
});
