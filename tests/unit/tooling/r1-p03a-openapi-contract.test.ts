import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { cleanoraOpenApiDocument } from "../../../src/swagger/openapi.document.js";

interface OpenApiParser {
  validate(document: string | Readonly<Record<string, unknown>>): Promise<unknown>;
}

const openApiParser = require("@apidevtools/swagger-parser") as OpenApiParser;

const publishedDocuments = [
  "docs/apis/openapi/r1-p03a-staff-admin-role-management.yaml",
  "docs/apis/openapi/r1-p03a-owner-staff-admins.yaml",
] as const;

const contractDocuments = [
  "specs/R1-P03A-production-role-provisioning/contracts/staff-admin-role-management.openapi.yaml",
  "specs/R1-P03A-production-role-provisioning/contracts/owner-staff-admins.openapi.yaml",
] as const;

describe("R1-P03A OpenAPI contracts (DEC-030)", () => {
  it("validates every published and phase-owned OpenAPI document", async () => {
    for (const document of [...publishedDocuments, ...contractDocuments]) {
      await expect(
        openApiParser.validate(resolve(process.cwd(), document)),
      ).resolves.toBeDefined();
    }
  });

  it("mirrors contract paths in the runtime Swagger document", () => {
    expect(cleanoraOpenApiDocument.paths).toHaveProperty(
      "/auth/role-grants/commands",
    );
    expect(cleanoraOpenApiDocument.paths).toHaveProperty(
      "/internal/owner/staff-admins",
    );
    expect(cleanoraOpenApiDocument.paths).not.toHaveProperty(
      "/auth/first-staff-admin/bootstrap",
    );
  });

  it("documents the DEC-030 response codes on the role-grant command path", () => {
    const responses =
      cleanoraOpenApiDocument.paths["/auth/role-grants/commands"]?.post
        ?.responses ?? {};

    expect(Object.keys(responses).sort()).toEqual(
      ["200", "400", "401", "403", "429", "500"].sort(),
    );
  });

  it("documents the DEC-030 owner provisioning response codes", () => {
    const responses =
      cleanoraOpenApiDocument.paths["/internal/owner/staff-admins"]?.post
        ?.responses ?? {};

    expect(Object.keys(responses).sort()).toEqual(
      ["200", "400", "403", "429"].sort(),
    );
  });

  it("keeps published copies aligned with phase contract paths", async () => {
    const pairs = [
      {
        published: publishedDocuments[0],
        contract: contractDocuments[0],
        path: "/auth/role-grants/commands",
      },
      {
        published: publishedDocuments[1],
        contract: contractDocuments[1],
        path: "/internal/owner/staff-admins",
      },
    ] as const;

    for (const { published, contract, path } of pairs) {
      const publishedYaml = await readFile(resolve(process.cwd(), published), "utf8");
      const contractYaml = await readFile(resolve(process.cwd(), contract), "utf8");

      expect(publishedYaml).toContain(path);
      expect(contractYaml).toContain(path);
      expect(publishedYaml).not.toContain("first-staff-admin");
      expect(contractYaml).not.toContain("first-staff-admin");
    }
  });
});
