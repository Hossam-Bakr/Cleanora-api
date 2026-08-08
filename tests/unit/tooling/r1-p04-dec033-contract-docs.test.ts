import { readFileSync } from "node:fs";
import { join } from "node:path";

const PHASE_ROOT = join(
  process.cwd(),
  "specs/R1-P04-customer-profiles-preferences-text-addresses",
);

const CLOUDINARY_MIGRATION =
  "r1_p04_customer_profiles_preferences_text_addresses_02_cloudinary_profile_image_storage";
const OBSOLETE_SHORT_MIGRATION = "r1_p04_cloudinary_profile_image_storage";

const NORMATIVE_SURFACES = [
  "data-model.md",
  "contracts/README.md",
  "contracts/transaction-boundaries.md",
  "contracts/media-profile-image.md",
  "contracts/customer-self-service.md",
  "quickstart.md",
  "plan.md",
  "contracts/customer-self-service.openapi.yaml",
] as const;

const MIGRATION_NAME_SURFACES = new Set(["data-model.md", "plan.md"]);

function readPhaseFile(relativePath: string): string {
  return readFileSync(join(PHASE_ROOT, relativePath), "utf8");
}

function isHistoricalLine(line: string): boolean {
  return /historical evidence only|Historical planning evidence only|superseded and removed|superseded\.|Removed env:|Removed:|No local filesystem|MEDIA_STORAGE_ROOT superseded|No `MEDIA_STORAGE_ROOT`/iu.test(
    line,
  );
}

function assertNoCurrentObsoleteClaims(content: string): void {
  for (const line of content.split(/\r?\n/u)) {
    if (isHistoricalLine(line)) {
      continue;
    }
    expect(line).not.toContain(`\`${OBSOLETE_SHORT_MIGRATION}\``);
    expect(line).not.toMatch(/MEDIA_STORAGE_ROOT \+ protected byte delivery/u);
    expect(line).not.toMatch(/opaque key under MEDIA_STORAGE_ROOT/u);
    expect(line).not.toMatch(/uses local filesystem profile-image storage/u);
    expect(line).not.toMatch(/public unsigned delivery/u);
  }
}

describe("R1-P04 DEC-033 normative documentation alignment (T110/T116)", () => {
  it.each(NORMATIVE_SURFACES)("guards current DEC-033 delivery in %s", (relativePath) => {
    const content = readPhaseFile(relativePath);
    assertNoCurrentObsoleteClaims(content);
    if (MIGRATION_NAME_SURFACES.has(relativePath)) {
      expect(content).toContain(CLOUDINARY_MIGRATION);
    }
  });

  it("allows clearly labelled historical references outside current normative claims", () => {
    const dataModel = readPhaseFile("data-model.md");
    expect(dataModel).toMatch(/MEDIA_STORAGE_ROOT.*superseded/iu);
    const research = readFileSync(join(PHASE_ROOT, "research.md"), "utf8");
    expect(research).toMatch(/Historical planning evidence only/iu);
  });
});
