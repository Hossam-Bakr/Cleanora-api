import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { MEDIA_PUBLIC_CONTRACT } from "../../../../src/modules/media/media.public.js";

const mediaPublicPath = join(
  process.cwd(),
  "src/modules/media/media.public.ts",
);
const mediaTypesPath = join(
  process.cwd(),
  "src/modules/media/domain/media.types.ts",
);
const prismaSchemaPath = join(process.cwd(), "prisma/schema.prisma");

const providerOwnerTypes = [
  "PROVIDER_LOGO",
  "PROVIDER_COVER",
  "PROVIDER_GALLERY_IMAGE",
  "PROVIDER_GALLERY_VIDEO",
] as const;

describe("R1-P05 Media public contract for Provider media", () => {
  it("keeps the approved public contract marker", () => {
    expect(MEDIA_PUBLIC_CONTRACT).toBe("media.public");
  });

  it("exposes Provider owner types on the Media public surface", async () => {
    const publicSource = await readFile(mediaPublicPath, "utf8");
    for (const ownerType of providerOwnerTypes) {
      expect(publicSource).toContain(ownerType);
    }
  });

  it("exposes PROCESSING and FAILED lifecycle statuses publicly", async () => {
    const [publicSource, typesSource] = await Promise.all([
      readFile(mediaPublicPath, "utf8"),
      readFile(mediaTypesPath, "utf8"),
    ]);
    expect(publicSource).toMatch(/PROCESSING/);
    expect(publicSource).toMatch(/FAILED/);
    expect(typesSource).toMatch(/PROCESSING/);
    expect(typesSource).toMatch(/FAILED/);
  });

  it("extends Prisma MediaOwnerType and MediaStatus for Provider media", async () => {
    const schema = await readFile(prismaSchemaPath, "utf8");
    for (const ownerType of providerOwnerTypes) {
      expect(schema).toContain(ownerType);
    }
    expect(schema).toMatch(/enum MediaStatus[\s\S]*PROCESSING/u);
    expect(schema).toMatch(/enum MediaStatus[\s\S]*FAILED/u);
  });
});
