import type { ErrorRequestHandler, RequestHandler } from "express";
import multer from "multer";

import { PROFILE_IMAGE_MAX_BYTES } from "../media/media.public.js";
import { AppError } from "../../shared/errors/app-error.js";

const acceptedContentTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export const providerWorkerAvatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: PROFILE_IMAGE_MAX_BYTES, files: 1, fields: 4, parts: 6, headerPairs: 32 },
  fileFilter: (_request, file, callback) => {
    if (!acceptedContentTypes.has(file.mimetype)) {
      callback(new AppError({
        code: "WORKER_AVATAR_INVALID",
        message: "Worker avatar content type is unsupported",
        statusCode: 415,
        expose: true,
      }));
      return;
    }
    callback(null, true);
  },
}).single("file");

export const requireProviderWorkerAvatarFields: RequestHandler = (request, _response, next) => {
  if (request.file === undefined) {
    next(new AppError({ code: "WORKER_AVATAR_INVALID", message: "Worker avatar file is required", statusCode: 400, expose: true }));
    return;
  }
  const expectedVersion = typeof request.body?.expectedVersion === "string"
    ? Number(request.body.expectedVersion)
    : request.body?.expectedVersion;
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1) {
    next(new AppError({ code: "WORKFORCE_VALIDATION_FAILED", message: "Worker avatar version is invalid", statusCode: 400, expose: true }));
    return;
  }
  request.body = { ...request.body, expectedVersion };
  next();
};

export const providerWorkerAvatarMulterErrorHandler: ErrorRequestHandler = (error, _request, _response, next) => {
  if (error instanceof AppError) {
    next(error);
    return;
  }
  if (error instanceof multer.MulterError) {
    next(new AppError({
      code: "WORKER_AVATAR_INVALID",
      message: error.code === "LIMIT_FILE_SIZE" ? "Worker avatar exceeds 5 MiB" : "Worker avatar multipart input is invalid",
      statusCode: error.code === "LIMIT_FILE_SIZE" ? 413 : 400,
      expose: true,
    }));
    return;
  }
  next(error);
};
