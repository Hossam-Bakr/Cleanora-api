import type { Request, Response } from "express";

import {
  mapMulterError,
  requireProfileImageMultipartFields,
} from "../../../../src/modules/customers/profile-image.multer.js";
import { AppError } from "../../../../src/shared/errors/app-error.js";

describe("profile-image Multer helpers", () => {
  it("maps LIMIT_FILE_SIZE to a canonical invalid-image error", () => {
    const mapped = mapMulterError({ code: "LIMIT_FILE_SIZE" });
    expect(mapped).toBeInstanceOf(AppError);
    expect(mapped?.code).toBe("CUSTOMER_PROFILE_IMAGE_INVALID");
    expect(mapped?.statusCode).toBe(400);
  });

  it("maps unexpected extra files to invalid-image", () => {
    const mapped = mapMulterError({ code: "LIMIT_UNEXPECTED_FILE" });
    expect(mapped?.code).toBe("CUSTOMER_PROFILE_IMAGE_INVALID");
  });

  it("passes through AppError instances", () => {
    const original = new AppError({
      code: "CUSTOMER_PROFILE_IMAGE_INVALID",
      message: "Profile image is invalid",
      statusCode: 400,
      expose: true,
    });
    expect(mapMulterError(original)).toBe(original);
  });

  it("rejects missing file and invalid expectedAssociationVersion", () => {
    const missingFileErrors: unknown[] = [];
    requireProfileImageMultipartFields(
      { file: undefined, body: {} } as unknown as Request,
      {} as Response,
      (error) => missingFileErrors.push(error),
    );
    expect(missingFileErrors[0]).toMatchObject({
      code: "CUSTOMER_PROFILE_IMAGE_INVALID",
    });

    const versionErrors: unknown[] = [];
    requireProfileImageMultipartFields(
      {
        file: { buffer: Buffer.from("x") },
        body: { expectedAssociationVersion: "abc" },
      } as unknown as Request,
      {} as Response,
      (error) => versionErrors.push(error),
    );
    expect(versionErrors[0]).toMatchObject({
      code: "CUSTOMER_PROFILE_IMAGE_INVALID",
    });
  });

  it("parses a valid expectedAssociationVersion string", () => {
    const request = {
      file: { buffer: Buffer.from("x") },
      body: { expectedAssociationVersion: "3" },
    } as unknown as Request;
    let called = false;
    requireProfileImageMultipartFields(request, {} as Response, (error) => {
      expect(error).toBeUndefined();
      called = true;
    });
    expect(called).toBe(true);
    expect(
      (request.body as { expectedAssociationVersion: number })
        .expectedAssociationVersion,
    ).toBe(3);
  });
});
