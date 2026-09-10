import { defineConfig } from "vitest/config";

/** R1-P12 phase-scoped suites and coverage thresholds. */
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
      "tests/unit/modules/authentication/authentication-middleware.test.ts",
      "tests/unit/modules/providers/provider-browse-projection.test.ts",
      "tests/unit/modules/bookings/**/*.test.ts",
      "tests/integration/bookings/**/*.test.ts",
    ],
    restoreMocks: true,
    clearMocks: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      reportsDirectory: "coverage/r1-p12",
      reportOnFailure: true,
      include: [
        "src/modules/bookings/**/*.ts",
        "src/modules/providers/provider-browse-projection.service.ts",
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
