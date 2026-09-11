import { defineConfig } from "vitest/config";

/** R1-P13 phase-scoped suites and coverage thresholds. */
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
      "tests/unit/modules/bookings/**/*.test.ts",
      "tests/unit/swagger/r1-p13-openapi.test.ts",
      "tests/unit/modules/configuration/deposit-percent-reader.test.ts",
      "tests/unit/modules/customers/customer-address-snapshot.test.ts",
      "tests/unit/modules/media/booking-attachment-reader.test.ts",
      "tests/unit/scripts/validate-r1-p13-upgrade.test.ts",
      "tests/integration/bookings/booking-command-flow.test.ts",
    ],
    restoreMocks: true,
    clearMocks: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      reportsDirectory: "coverage/r1-p13",
      reportOnFailure: true,
      include: [
        "src/modules/bookings/**/*.ts",
        "src/modules/configuration/infrastructure/prisma-deposit-percent.reader.ts",
        "src/modules/customers/infrastructure/prisma-customer-address-snapshot.reader.ts",
        "src/modules/media/infrastructure/prisma-booking-attachment.reader.ts",
        "src/swagger/r1-p13-openapi.paths.ts",
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
