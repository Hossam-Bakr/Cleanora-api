import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";


describe("OpenAPI validation tooling", () => {
  it("rejects malformed YAML even when expected path strings are present", async () => {
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
});
