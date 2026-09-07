import { defineConfig } from "vitest/config";

/**
 * R1-P09 phase coverage. Include the Provider-service vertical and each
 * modified public cross-module adapter. Live database suites remain explicit
 * behavioral gates and must not run against an unapproved target.
 */
export default defineConfig({
  resolve: {
    conditions: ["development"],
    dedupe: ["vitest", "@vitest/runner", "@vitest/expect", "@vitest/utils"],
  },
  test: {
    environment: "node",
    globals: true,
    fileParallelism: false,
    maxWorkers: 1,
    pool: "forks",
    include: [
      "tests/unit/providers/provider-service-*.test.ts",
      "tests/unit/providers/provider-service.*.test.ts",
      "tests/unit/modules/r1-p09-*.test.ts",
      "tests/unit/modules/authentication/authorization-provider-services.test.ts",
      "tests/unit/scripts/validate-r1-p09-upgrade.test.ts",
      "tests/unit/swagger/r1-p09-*.test.ts",
      "tests/unit/providers/r1-p09-postman-schema-parity.test.ts",
      "tests/integration/providers/provider-service-*.test.ts",
      "tests/integration/http/provider-services-*.test.ts",
      "tests/integration/http/provider-service-*.test.ts",
      "tests/integration/database/r1-p09-*.test.ts",
    ],
    restoreMocks: true,
    clearMocks: true,
    hookTimeout: 180_000,
    testTimeout: 180_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      reportsDirectory: "coverage/r1-p09",
      reportOnFailure: true,
      include: [
        // Provider-service vertical (R1-P09-owned)
        "src/modules/providers/domain/provider-service*.ts",
        "src/modules/providers/domain/provider-service-*.ts",
        "src/modules/providers/domain/provider-readiness.policy.ts",
        "src/modules/providers/provider-service*.ts",
        "src/modules/providers/provider-service-*.ts",
        "src/modules/providers/provider-projection.service.ts",
        "src/modules/providers/providers.public.ts",
        "src/modules/providers/infrastructure/prisma-provider-service*.ts",
        "src/modules/providers/infrastructure/provider-service-prisma-errors.ts",
        // Touched public seams (not whole R1-P08 Catalog module)
        "src/modules/catalog/catalog.public.ts",
        "src/modules/configuration/configuration.public.ts",
        "src/modules/configuration/config-key.catalog.ts",
        "src/modules/configuration/infrastructure/prisma-provider-service-pricing-policy.reader.ts",
        "src/modules/authentication/domain/authorization.catalog.ts",
        "src/modules/authentication/domain/authorization.types.ts",
        "src/modules/authentication/authentication.public.ts",
        "src/modules/authentication/infrastructure/prisma-r1-p06-security.adapters.ts",
        "src/swagger/r1-p09-openapi.paths.ts",
        "src/composition.ts",
        "src/routes/index.ts",
      ],
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
    },
  },
});
