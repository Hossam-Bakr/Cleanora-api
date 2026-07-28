
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    conditions: ["development"],
    dedupe: ["vitest", "@vitest/runner", "@vitest/expect", "@vitest/utils"]
  },
  test: {
    environment: "node",
    globals: true,
    // Keep one file and one worker active because database suites share one isolated remote target.
    // Vitest 4: maxWorkers 1 replaces singleFork. Multiple workers each open a pg pool; under coverage
    // that contention surfaces as signup 500s and Prisma "Unable to start a transaction in the given time".
    fileParallelism: false,
    maxWorkers: 1,
    pool: "forks",
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
    restoreMocks: true,
    clearMocks: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/generated/**",
        "src/server.ts",
        "src/integrations/database/**",
        "src/shared/types/**"
      ],
      thresholds: {
        branches: 75,
        functions: 80,
        lines: 80,
        statements: 80
      }
    }
  }
});
