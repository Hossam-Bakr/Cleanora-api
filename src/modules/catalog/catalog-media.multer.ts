import type { ErrorRequestHandler, RequestHandler } from "express";
import multer from "multer";

import {
  CATALOG_SERVICE_IMAGE_ALLOWED_CONTENT_TYPES,
  CATALOG_SERVICE_IMAGE_MAX_BYTES,
} from "#modules/media/media.public";
import { AppError } from "#shared/errors/app-error";

const acceptedContentTypes = new Set<string>([
  ...CATALOG_SERVICE_IMAGE_ALLOWED_CONTENT_TYPES,
]);

/**
 * Strict multipart parser for protected Catalog service-image upload.
 * MIME and byte ceilings mirror the Media-owned Catalog limits.
 */
export const catalogServiceImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: CATALOG_SERVICE_IMAGE_MAX_BYTES,
    files: 1,
    fields: 8,
    parts: 10,
    headerPairs: 32,
  },
  fileFilter: (_request, file, callback) => {
    if (!acceptedContentTypes.has(file.mimetype)) {
      callback(
        new AppError({
          code: "CATALOG_MEDIA_INVALID",
          message: "Catalog service image content type is unsupported",
          statusCode: 400,
          expose: true,
        }),
      );
      return;
    }
    callback(null, true);
  },
}).single("file");

/**
 * @desc Require the uploaded file and coerce multipart scalar fields.
 */
export const requireCatalogServiceImageFields: RequestHandler = (
  request,
  _response,
  next,
) => {
  if (request.file === undefined) {
    next(
      new AppError({
        code: "CATALOG_MEDIA_INVALID",
        message: "Catalog service image file is required",
        statusCode: 400,
        expose: true,
      }),
    );
    return;
  }
  const expectedVersion =
    typeof request.body?.expectedVersion === "string"
      ? Number(request.body.expectedVersion)
      : request.body?.expectedVersion;
  request.body = {
    ...request.body,
    expectedVersion,
  };
  next();
};

/**
 * @desc Map Multer limit/parse failures to safe Catalog media envelopes.
 */
export const catalogServiceImageMulterErrorHandler: ErrorRequestHandler = (
  error,
  _request,
  _response,
  next,
) => {
  if (error instanceof AppError) {
    next(error);
    return;
  }
  if (error instanceof multer.MulterError) {
    next(
      new AppError({
        code: "CATALOG_MEDIA_INVALID",
        message:
          error.code === "LIMIT_FILE_SIZE"
            ? "Catalog service image exceeds 5 MiB"
            : "Catalog service image multipart input is invalid",
        statusCode: error.code === "LIMIT_FILE_SIZE" ? 413 : 400,
        expose: true,
      }),
    );
    return;
  }
  next(error);
};
