import multer from "multer";
import type { RequestHandler } from "express";

import { AppError } from "#shared/errors/app-error";
import { PROFILE_IMAGE_MAX_BYTES } from "#modules/media/media.public";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * Route-scoped Multer for PUT /customers/profile-image only (DEC-033).
 * Never register globally. DiskStorage is forbidden.
 */
export const profileImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: PROFILE_IMAGE_MAX_BYTES,
    files: 1,
    fields: 8,
    parts: 12,
    headerPairs: 32,
  },
  fileFilter: (_request, file, callback) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      callback(
        new AppError({
          code: "CUSTOMER_PROFILE_IMAGE_INVALID",
          message: "Profile image is invalid",
          statusCode: 400,
          expose: true,
        }),
      );
      return;
    }
    callback(null, true);
  },
}).single("file");

export function mapMulterError(error: unknown): AppError | null {
  if (error instanceof AppError) {
    return error;
  }
  if (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string"
  ) {
    const code = (error as { code: string }).code;
    if (code === "LIMIT_FILE_SIZE") {
      return new AppError({
        code: "CUSTOMER_PROFILE_IMAGE_INVALID",
        message: "Profile image is invalid",
        statusCode: 400,
        expose: true,
      });
    }
    if (
      code === "LIMIT_FILE_COUNT" ||
      code === "LIMIT_UNEXPECTED_FILE" ||
      code === "LIMIT_PART_COUNT" ||
      code === "LIMIT_FIELD_COUNT"
    ) {
      return new AppError({
        code: "CUSTOMER_PROFILE_IMAGE_INVALID",
        message: "Profile image is invalid",
        statusCode: 400,
        expose: true,
      });
    }
  }
  return null;
}

/** Parses multipart expectedAssociationVersion after Multer runs. */
export const requireProfileImageMultipartFields: RequestHandler = (
  request,
  _response,
  next,
) => {
  if (request.file === undefined) {
    next(
      new AppError({
        code: "CUSTOMER_PROFILE_IMAGE_INVALID",
        message: "Profile image is invalid",
        statusCode: 400,
        expose: true,
      }),
    );
    return;
  }
  const raw = request.body?.expectedAssociationVersion;
  let parsed = Number.NaN;
  if (typeof raw === "string") {
    parsed = Number.parseInt(raw, 10);
  } else if (typeof raw === "number") {
    parsed = raw;
  }
  if (!Number.isInteger(parsed) || parsed < 1) {
    next(
      new AppError({
        code: "CUSTOMER_PROFILE_IMAGE_INVALID",
        message: "Profile image is invalid",
        statusCode: 400,
        expose: true,
      }),
    );
    return;
  }
  request.body = {
    ...request.body,
    expectedAssociationVersion: parsed,
  };
  next();
};
