import { readFileSync } from "node:fs";
import { join } from "node:path";

import { cleanoraOpenApiDocument } from "../../../src/swagger/openapi.document.js";

const r1P03AWorkflowFiles = [
  "src/modules/authentication/role-grant-command.controller.ts",
  "src/modules/authentication/role-grant-command.schema.ts",
  "src/modules/authentication/owner-staff-admin.controller.ts",
  "src/modules/authentication/owner-staff-admin.schema.ts",
  "src/modules/authentication/owner-staff-admin.service.ts",
  "src/modules/authentication/owner-staff-admin.routes.ts",
  "src/modules/authentication/infrastructure/prisma-owner-staff-admin.unit-of-work.ts",
] as const;

describe("R1-P03A module boundaries (DEC-030)", () => {
  it("keeps R1-P03A HTTP adapters off direct persistence imports", () => {
    for (const file of [
      "src/modules/authentication/role-grant-command.controller.ts",
      "src/modules/authentication/owner-staff-admin.controller.ts",
    ]) {
      const source = readFileSync(join(process.cwd(), file), "utf8");
      expect(source).not.toMatch(/#database\/prisma/u);
      expect(source).not.toMatch(/#generated\//u);
    }
  });

  it("keeps R1-P03A workflows on approved module contracts only", () => {
    const allowedCrossModuleImport =
      /from\s+["']#modules\/(?:admin\/audit\.service)/u;

    for (const file of r1P03AWorkflowFiles) {
      const source = readFileSync(join(process.cwd(), file), "utf8");
      const imports = [...source.matchAll(/from\s+["']#modules\/[^"']+["']/gu)].map(
        (match) => match[0]!,
      );

      for (const importStatement of imports) {
        const allowed =
          allowedCrossModuleImport.test(importStatement) ||
          /from\s+["']#modules\/authentication\//u.test(importStatement);
        expect({ file, importStatement, allowed }).toEqual(
          expect.objectContaining({ allowed: true }),
        );
      }
    }
  });

  it("does not expose obsolete bootstrap routes in runtime routers or Swagger", () => {
    const authRoutes = readFileSync(
      join(process.cwd(), "src/modules/authentication/auth.routes.ts"),
      "utf8",
    );
    const ownerRoutes = readFileSync(
      join(process.cwd(), "src/modules/authentication/owner-staff-admin.routes.ts"),
      "utf8",
    );
    const serialized = JSON.stringify(cleanoraOpenApiDocument);

    for (const source of [authRoutes, ownerRoutes, serialized]) {
      expect(source).not.toMatch(/first-staff-admin|bootstrap/i);
    }
  });
});
