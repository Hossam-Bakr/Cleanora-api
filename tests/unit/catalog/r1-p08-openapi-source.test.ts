
import { loadR1P08OpenApiSource } from "../../../src/swagger/r1-p08-openapi.paths.js";

describe("R1-P08 OpenAPI source loader", () => {
  it("returns paths and components without anonymous Browse operations", () => {
    const source = loadR1P08OpenApiSource();
    const pathKeys = Object.keys(source.paths);
    expect(pathKeys.length).toBeGreaterThan(0);
    expect(source.components.schemas).toBeTypeOf("object");
    expect(
      pathKeys.some((path) => /\/staff\/catalog\//u.test(path)),
    ).toBe(true);
    expect(
      pathKeys.some(
        (path) =>
          /\/catalog\/services/u.test(path) &&
          !/\/staff\/catalog\//u.test(path),
      ),
    ).toBe(false);
  });
});
