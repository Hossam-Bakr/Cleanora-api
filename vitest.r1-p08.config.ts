import { defineConfig } from "vitest/config";

/**
 * R1-P08 phase coverage. Include Catalog implementation and each modified
 * public cross-module adapter. Live database suites remain explicit behavioral
 * gates and must not run against an unapproved target.
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
      "tests/unit/catalog/**/*.test.ts",
      "tests/unit/modules/r1-p08-*.test.ts",
      "tests/unit/modules/authentication/authorization-catalog.test.ts",
      "tests/unit/modules/authentication/authorization-staff-separation.test.ts",
      "tests/unit/scripts/validate-r1-p08-upgrade.test.ts",
      "tests/unit/swagger/r1-p08-*.test.ts",
      "tests/integration/catalog/**/*.test.ts",
      "tests/integration/http/catalog-*.test.ts",
      "tests/integration/database/r1-p08-*.test.ts",
    ],
    restoreMocks: true,
    clearMocks: true,
    hookTimeout: 180_000,
    testTimeout: 180_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      reportsDirectory: "coverage/r1-p08",
      reportOnFailure: true,
      include: [
        "src/modules/catalog/**/*.ts",
        "src/modules/authentication/domain/authorization.catalog.ts",
        "src/modules/authentication/domain/authorization.types.ts",
        "src/modules/authentication/authentication.public.ts",
        "src/modules/media/media.public.ts",
        "src/modules/media/domain/media.types.ts",
        "src/modules/media/domain/media.ports.ts",
        "src/swagger/r1-p08-openapi.paths.ts",
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
