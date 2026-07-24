import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    conditions: ["development"]
  },
  test: {
    environment: "node",
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
