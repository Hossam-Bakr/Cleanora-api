
import { AppError } from "../../../src/shared/errors/app-error.js";
import {
  CatalogError,
  catalogErrorToAppError,
  rethrowAsAppError,
} from "../../../src/modules/catalog/catalog.errors.js";

describe("catalog.errors defaultHttpStatus + rethrowAsAppError", () => {
  it("maps NOT_FOUND to 404", () => {
    const error = new CatalogError("CATALOG_NOT_FOUND", "missing");
    expect(error.httpStatus).toBe(404);
    expect(catalogErrorToAppError(error)).toMatchObject({
      code: "CATALOG_NOT_FOUND",
      statusCode: 404,
      expose: true,
    });
  });

  it("maps FORBIDDEN to 403", () => {
    const error = new CatalogError("CATALOG_FORBIDDEN", "denied");
    expect(error.httpStatus).toBe(403);
    expect(catalogErrorToAppError(error).statusCode).toBe(403);
  });

  it("maps DEPENDENCY_FAILED to 502", () => {
    const error = new CatalogError("CATALOG_DEPENDENCY_FAILED", "dependency");
    expect(error.httpStatus).toBe(502);
    expect(catalogErrorToAppError(error).statusCode).toBe(502);
  });

  it("rethrows CatalogError as AppError", () => {
    const domain = new CatalogError("CATALOG_NOT_FOUND", "gone", {
      details: { id: "x" },
    });
    expect(() => rethrowAsAppError(domain)).toThrow(AppError);
    try {
      rethrowAsAppError(domain);
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect(error).toMatchObject({
        code: "CATALOG_NOT_FOUND",
        statusCode: 404,
        details: { id: "x" },
      });
    }
  });

  it("rethrows non-CatalogError unchanged", () => {
    const boom = new TypeError("not catalog");
    expect(() => rethrowAsAppError(boom)).toThrow(boom);
  });
});
