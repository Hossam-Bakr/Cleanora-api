/** Run the optional clean-database proof only from the explicit CI target. */
import { spawnSync } from "node:child_process";

function runNodeScript(
  relativePath: string,
  environment: NodeJS.ProcessEnv
): void {
  const result = spawnSync(
    process.execPath,
    [
      "--env-file-if-exists=.env",
      "--conditions=development",
      "--import",
      "tsx",
      relativePath
    ],
    {
      cwd: process.cwd(),
      env: environment,
      stdio: "inherit"
    }
  );

  if (result.status !== 0) {
    throw new Error(`${relativePath} failed with exit code ${String(result.status)}`);
  }
}

function main(): void {
  const connectionString = process.env["CI_DATABASE_URL"];
  if (connectionString === undefined || connectionString.length === 0) {
    console.info(
      "CI_DATABASE_URL unavailable; skipped clean migration/seed database proof."
    );
    return;
  }

  const cleanDatabaseEnvironment = {
    ...process.env,
    DATABASE_URL: connectionString
  };
  runNodeScript("scripts/validate-clean-migration.ts", cleanDatabaseEnvironment);
  runNodeScript("scripts/seed.ts", cleanDatabaseEnvironment);
  runNodeScript("scripts/seed.ts", cleanDatabaseEnvironment);
  runNodeScript("scripts/count-seed-rows.ts", cleanDatabaseEnvironment);
}

try {
  main();
} catch (error: unknown) {
  console.error(
    error instanceof Error ? error.message : "Migration/seed validation failed"
  );
  process.exitCode = 1;
}
