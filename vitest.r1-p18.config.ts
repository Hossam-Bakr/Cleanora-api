import { defineConfig } from "vitest/config";

/** R1-P18 phase-scoped suites and coverage thresholds. */
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
      "tests/unit/modules/orders/orders.matrix.test.ts",
      "tests/unit/modules/orders/orders.completion-code.test.ts",
      "tests/unit/modules/orders/orders.service.test.ts",
      "tests/unit/modules/orders/orders.boundaries.test.ts",
      "tests/unit/modules/orders/orders.controller.test.ts",
      "tests/unit/modules/orders/orders.routes.test.ts",
      "tests/unit/modules/orders/orders.authz-schema.test.ts",
      "tests/unit/modules/orders/booking-order-activation.reader.test.ts",
      "tests/unit/scripts/validate-r1-p18-migration.test.ts",
      "tests/unit/swagger/r1-p18-openapi.test.ts",
    ],
    restoreMocks: true,
    clearMocks: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      reportsDirectory: "coverage/r1-p18",
      reportOnFailure: true,
      include: [
        "src/modules/orders/orders.matrix.ts",
        "src/modules/orders/orders.errors.ts",
        "src/modules/orders/orders.schema.ts",
        "src/modules/orders/orders.service.ts",
        "src/modules/orders/orders.controller.ts",
        "src/modules/orders/orders.public.ts",
        "src/modules/orders/domain/completion-code.ts",
        "src/modules/orders/domain/order-authz.ts",
        "src/swagger/r1-p18-openapi.paths.ts",
        "src/modules/bookings/infrastructure/prisma-booking-order-activation.reader.ts",
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
