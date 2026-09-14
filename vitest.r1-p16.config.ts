import { defineConfig } from "vitest/config";

/** R1-P16 phase-scoped suites and coverage thresholds. */
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
      "tests/unit/modules/bookings/booking-response.service.test.ts",
      "tests/unit/modules/bookings/booking-response.controller.test.ts",
      "tests/unit/modules/bookings/booking-response.routes.test.ts",
      "tests/unit/modules/bookings/booking-response-boundaries.test.ts",
      "tests/unit/modules/bookings/booking-command-p16-hooks.test.ts",
      "tests/unit/modules/bookings/confirm-deposit-payment.test.ts",
      "tests/unit/modules/configuration/provider-response-hours.reader.test.ts",
      "tests/unit/scripts/validate-r1-p16-migration.test.ts",
      "tests/unit/swagger/r1-p16-openapi.test.ts",
    ],
    restoreMocks: true,
    clearMocks: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      reportsDirectory: "coverage/r1-p16",
      reportOnFailure: true,
      include: [
        "src/modules/bookings/bookings.response.service.ts",
        "src/modules/bookings/bookings.response.controller.ts",
        "src/modules/bookings/bookings.response.routes.ts",
        "src/modules/bookings/bookings.response.schema.ts",
        "src/modules/bookings/bookings.matrix.ts",
        "src/modules/bookings/infrastructure/confirm-deposit-payment.ts",
        "src/modules/configuration/infrastructure/prisma-provider-response-hours.reader.ts",
        "src/swagger/r1-p16-openapi.paths.ts",
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
