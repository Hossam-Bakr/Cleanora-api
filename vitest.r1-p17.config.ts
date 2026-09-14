import { defineConfig } from "vitest/config";

/** R1-P17 phase-scoped suites and coverage thresholds. */
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
      "tests/unit/modules/bookings/booking-assignment.policy.test.ts",
      "tests/unit/modules/bookings/booking-assignment.service.test.ts",
      "tests/unit/modules/bookings/booking-assignment.controller.test.ts",
      "tests/unit/modules/bookings/booking-assignment.routes.test.ts",
      "tests/unit/modules/bookings/booking-assignment-boundaries.test.ts",
      "tests/unit/scripts/validate-r1-p17-migration.test.ts",
      "tests/unit/swagger/r1-p17-openapi.test.ts",
    ],
    restoreMocks: true,
    clearMocks: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      reportsDirectory: "coverage/r1-p17",
      reportOnFailure: true,
      include: [
        "src/modules/bookings/bookings.assignment.policy.ts",
        "src/modules/bookings/bookings.assignment.service.ts",
        "src/modules/bookings/bookings.assignment.controller.ts",
        "src/modules/bookings/bookings.assignment.routes.ts",
        "src/modules/bookings/bookings.assignment.schema.ts",
        "src/modules/bookings/bookings.worker-visibility.routes.ts",
        "src/modules/bookings/bookings.matrix.ts",
        "src/swagger/r1-p17-openapi.paths.ts",
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
