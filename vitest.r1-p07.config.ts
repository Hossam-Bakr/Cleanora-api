import { defineConfig } from "vitest/config";

/**
 * R1-P07 phase coverage. The include list deliberately names every Providers
 * workforce implementation and each modified public cross-module adapter.
 * Database, HTTP, migration, privacy, and concurrency suites remain explicit
 * behavioral gates in addition to this line-coverage guardrail.
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
      "tests/unit/providers/provider-*.test.ts",
      "tests/unit/providers/worker-invitation-proof.test.ts",
      "tests/unit/modules/r1-p07-*.test.ts",
      "tests/unit/modules/admin/*.test.ts",
      "tests/unit/modules/media/*.test.ts",
      "tests/unit/swagger/r1-p07-*.test.ts",
      "tests/unit/server/{composition,route-map}.test.ts",
      "tests/integration/providers/provider-{worker,team,workforce,supervisor,escort,final-cleaner,workers-ready}*.test.ts",
      "tests/integration/providers/r1-p07-*.test.ts",
      "tests/integration/authentication/worker-*.test.ts",
      "tests/integration/media/provider-worker-avatar.test.ts",
      "tests/integration/admin/r1-p06-document-audit-safety.test.ts",
      "tests/integration/logging.test.ts",
      "tests/integration/http/{provider-worker,provider-team,provider-workforce,worker-invitation,worker-self}*.test.ts",
      "tests/integration/database/r1-p07-*.test.ts",
    ],
    restoreMocks: true,
    clearMocks: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      reportsDirectory: "coverage/r1-p07",
      reportOnFailure: true,
      include: [
        "src/modules/providers/domain/provider-workforce*.ts",
        "src/modules/providers/domain/worker-invitation-proof.policy.ts",
        "src/modules/providers/infrastructure/prisma-provider-workforce*.ts",
        "src/modules/providers/infrastructure/prisma-providers-workforce.unit-of-work.ts",
        "src/modules/providers/infrastructure/provider-workforce-email-delivery.adapter.ts",
        "src/modules/providers/infrastructure/provider-workforce.prisma-errors.ts",
        "src/modules/providers/infrastructure/worker-invitation-proof.adapter.ts",
        "src/modules/providers/provider-workforce*.ts",
        "src/modules/providers/provider-team*.ts",
        "src/modules/providers/provider-worker-self*.ts",
        "src/modules/providers/providers.public.ts",
        "src/modules/authentication/authentication.public.ts",
        "src/modules/authentication/infrastructure/prisma-worker-*.ts",
        "src/modules/authentication/infrastructure/provider-sensitive-action-proof.verifier.ts",
        "src/modules/media/media.public.ts",
        "src/modules/media/domain/media.types.ts",
        "src/modules/media/infrastructure/media-provider.factory.ts",
        "src/modules/media/infrastructure/worker-avatar.adapter.ts",
        "src/modules/admin/audit.public.ts",
        "src/modules/admin/audit.service.ts",
        "src/middlewares/http-logger.ts",
        "src/shared/logger.ts",
        "src/composition.ts",
        "src/routes/index.ts",
        "src/swagger/r1-p07-openapi.paths.ts",
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
