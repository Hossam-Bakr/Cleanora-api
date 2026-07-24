import { readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";


const SOURCE_ROOT = join(process.cwd(), "src");
const EXCLUDED_PATH_SEGMENTS = new Set(["generated", "reference"]);
const HARD_CODED_EGYPT_BRANCH =
  /(?:countryCode|country\.code)\s*={2,3}\s*["'](?:EG|Egypt)["']|["'](?:EG|Egypt)["']\s*={2,3}\s*(?:countryCode|country\.code)/;

async function listSourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        return EXCLUDED_PATH_SEGMENTS.has(entry.name)
          ? []
          : listSourceFiles(path);
      }
      return entry.isFile() && entry.name.endsWith(".ts") ? [path] : [];
    })
  );

  return files.flat();
}

describe("country configuration guard", () => {
  it("rejects hard-coded Egypt business branches outside approved data locations", async () => {
    const sourceFiles = await listSourceFiles(SOURCE_ROOT);
    const violations = (
      await Promise.all(
        sourceFiles.map(async (file) => {
          const content = await readFile(file, "utf8");
          return file.endsWith("config-key-catalog.ts") ||
              !HARD_CODED_EGYPT_BRANCH.test(content)
            ? []
            : [relative(process.cwd(), file).split(sep).join("/")];
        })
      )
    ).flat();

    expect(violations).toEqual([]);
  });
});
