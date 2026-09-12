import { defineConfig } from "vitest/config";

/** R1-P15 phase-scoped suites and coverage thresholds. */
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
      "tests/unit/modules/payments/**/*.test.ts",
      "tests/unit/modules/bookings/booking-financial-snapshot.test.ts",
      "tests/unit/modules/bookings/confirm-deposit-payment.test.ts",
      "tests/unit/scripts/validate-r1-p15-migration.test.ts",
    ],
    restoreMocks: true,
    clearMocks: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      reportsDirectory: "coverage/r1-p15",
      reportOnFailure: true,
      include: [
        "src/modules/payments/**/*.ts",
        "src/modules/bookings/infrastructure/prisma-booking-financial-snapshot.reader.ts",
        "src/modules/bookings/infrastructure/confirm-deposit-payment.ts",
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
