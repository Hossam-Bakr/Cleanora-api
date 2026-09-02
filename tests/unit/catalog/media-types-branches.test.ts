
import { providerOwnerTypeForImagePurpose } from "../../../src/modules/media/domain/media.types.js";

/**
 * T134 — cover providerOwnerTypeForImagePurpose switch branches included in
 * R1-P08 coverage (media.types.ts).
 */
describe("media.types providerOwnerTypeForImagePurpose", () => {
  it.each([
    ["LOGO", "PROVIDER_LOGO"],
    ["COVER", "PROVIDER_COVER"],
    ["GALLERY_IMAGE", "PROVIDER_GALLERY_IMAGE"],
  ] as const)("maps %s to %s", (purpose, ownerType) => {
    expect(providerOwnerTypeForImagePurpose(purpose)).toBe(ownerType);
  });
});
