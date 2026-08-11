import type { ErrorRequestHandler, Request, Response } from "express";

import {
  mapProviderMediaMulterError,
  providerMediaMulterErrorHandler,
  requireProviderMediaMultipartFields,
} from "../../../../src/modules/providers/provider-media.multer.js";
import { AppError } from "../../../../src/shared/errors/app-error.js";

describe("provider-media Multer helpers (T156 branch coverage)", () => {
  it("passes through AppError instances", () => {
    const original = new AppError({
      code: "PROVIDER_MEDIA_INVALID",
      message: "invalid",
      statusCode: 400,
      expose: true,
    });
    expect(mapProviderMediaMulterError(original)).toBe(original);
  });

  it("maps LIMIT_FILE_SIZE to TOO_LARGE", () => {
    const mapped = mapProviderMediaMulterError({ code: "LIMIT_FILE_SIZE" });
    expect(mapped).toMatchObject({
      code: "PROVIDER_MEDIA_INVALID",
      details: expect.objectContaining({ reason: "TOO_LARGE" }),
    });
  });

  it.each([
    "LIMIT_FILE_COUNT",
    "LIMIT_UNEXPECTED_FILE",
    "LIMIT_PART_COUNT",
    "LIMIT_FIELD_COUNT",
  ] as const)("maps %s to MULTIPART", (code) => {
    expect(mapProviderMediaMulterError({ code })).toMatchObject({
      code: "PROVIDER_MEDIA_INVALID",
      details: expect.objectContaining({ reason: "MULTIPART" }),
    });
  });

  it("returns null for unmapped errors", () => {
    expect(mapProviderMediaMulterError(null)).toBeNull();
    expect(mapProviderMediaMulterError("boom")).toBeNull();
    expect(mapProviderMediaMulterError({ code: 12 })).toBeNull();
    expect(mapProviderMediaMulterError({ code: "LIMIT_FIELD_KEY" })).toBeNull();
  });

  it("forwards mapped or original errors through the Express handler", () => {
    const nextMapped = vi.fn();
    (providerMediaMulterErrorHandler as ErrorRequestHandler)(
      { code: "LIMIT_FILE_SIZE" },
      {} as Request,
      {} as Response,
      nextMapped,
    );
    expect(nextMapped).toHaveBeenCalledWith(
      expect.objectContaining({ code: "PROVIDER_MEDIA_INVALID" }),
    );

    const original = new Error("unmapped");
    const nextOriginal = vi.fn();
    (providerMediaMulterErrorHandler as ErrorRequestHandler)(
      original,
      {} as Request,
      {} as Response,
      nextOriginal,
    );
    expect(nextOriginal).toHaveBeenCalledWith(original);
  });

  it("requires a file and a positive integer expectedVersion", () => {
    const missing: unknown[] = [];
    requireProviderMediaMultipartFields(
      { file: undefined, body: {} } as unknown as Request,
      {} as Response,
      (error) => missing.push(error),
    );
    expect(missing[0]).toMatchObject({
      code: "PROVIDER_MEDIA_INVALID",
      details: expect.objectContaining({ reason: "REQUIRED" }),
    });

    for (const expectedVersion of ["abc", "0", -1, undefined, 1.5]) {
      const errors: unknown[] = [];
      requireProviderMediaMultipartFields(
        {
          file: { buffer: Buffer.from("x") },
          body: { expectedVersion },
        } as unknown as Request,
        {} as Response,
        (error) => errors.push(error),
      );
      expect(errors[0]).toMatchObject({
        code: "VALIDATION_ERROR",
        details: expect.objectContaining({ field: "expectedVersion" }),
      });
    }
  });

  it("coerces string and number expectedVersion on success", () => {
    for (const expectedVersion of ["3", 4] as const) {
      const request = {
        file: { buffer: Buffer.from("x") },
        body: { expectedVersion, note: "keep" },
      } as unknown as Request;
      let ok = false;
      requireProviderMediaMultipartFields(request, {} as Response, (error) => {
        expect(error).toBeUndefined();
        ok = true;
      });
      expect(ok).toBe(true);
      expect(
        (request.body as { expectedVersion: number; note: string })
          .expectedVersion,
      ).toBe(typeof expectedVersion === "string" ? 3 : 4);
      expect((request.body as { note: string }).note).toBe("keep");
    }
  });
});
