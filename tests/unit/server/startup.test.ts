import { readFile } from "node:fs/promises";
import { join } from "node:path";

describe("junior-readable server entry", () => {
  it("shows the direct startup order without factory override plumbing", async () => {
    const source = await readFile(
      join(process.cwd(), "src/server.ts"),
      "utf8",
    );

    const steps = [
      "loadEnvironment(process.env)",
      "createRuntimeDependencies(environment)",
      "runtime.database.connect()",
      "createApp(runtime.routes)",
      "createServer(app)",
      "listenForHttp(httpServer",
      'process.once("SIGINT"',
      'process.once("SIGTERM"',
    ];
    const positions = steps.map((step) => source.indexOf(step));

    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((left, right) => left - right));
    expect(source).not.toContain("StartApplicationDependencies");
    expect(source).not.toContain("dependencies.create");
    expect(source).not.toContain("createRuntime ??");
    expect(source).not.toContain("mountPublicRoutes");
    expect(source).not.toContain("installSignalHandlers");
    expect(source).not.toContain("environmentInput");
  });
});
