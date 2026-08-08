import { resolve, sep } from "node:path";

const {
  resolveCoverageDirectory,
} = require("../../../scripts/clean-coverage.cjs") as {
  resolveCoverageDirectory: (cwd?: string) => string;
};

describe("clean-coverage.cjs (T116/T119)", () => {
  it("targets only the repository-local coverage directory", () => {
    const repositoryRoot = resolve(process.cwd());
    const target = resolveCoverageDirectory(repositoryRoot);
    expect(target).toBe(resolve(repositoryRoot, "coverage"));
    expect(target.startsWith(`${repositoryRoot}${sep}`)).toBe(true);
  });

  it("refuses to resolve/delete outside the repository root", () => {
    expect(() => resolveCoverageDirectory("/tmp/not-the-repo")).toThrow(
      /Refusing to delete coverage outside repository root/u,
    );
  });
});
