import multer from "multer";
import type { ErrorRequestHandler, RequestHandler } from "express";

import {
  PROVIDER_IMAGE_MAX_BYTES,
  PROVIDER_VIDEO_MAX_BYTES,
} from "#modules/media/media.public";

import { providersError } from "./domain/providers.errors.js";
import {
  PROVIDER_IMAGE_ALLOWED_MIME,
  PROVIDER_VIDEO_ALLOWED_MIME,
} from "./domain/provider-media.policy.js";
import { AppError } from "#shared/errors/app-error";

const IMAGE_MIME = new Set<string>(PROVIDER_IMAGE_ALLOWED_MIME);
const VIDEO_MIME = new Set<string>(PROVIDER_VIDEO_ALLOWED_MIME);

function createUpload(options: {
  readonly maxBytes: number;
  readonly allowed: ReadonlySet<string>;
}) {
  return multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: options.maxBytes,
      files: 1,
      fields: 8,
      parts: 12,
      headerPairs: 32,
    },
    fileFilter: (_request, file, callback) => {
      if (!options.allowed.has(file.mimetype)) {
        callback(
          providersError("PROVIDER_MEDIA_INVALID", {
            field: "file",
            reason: "MIME",
          }),
        );
        return;
      }
      callback(null, true);
    },
  }).single("file");
}

/** Route-scoped Multer for Provider image uploads (logo/cover/gallery images). */
export const providerImageUpload = createUpload({
  maxBytes: PROVIDER_IMAGE_MAX_BYTES,
  allowed: IMAGE_MIME,
});

/** Route-scoped Multer for Provider gallery videos. */
export const providerVideoUpload = createUpload({
  maxBytes: PROVIDER_VIDEO_MAX_BYTES,
  allowed: VIDEO_MIME,
});

export function mapProviderMediaMulterError(error: unknown): AppError | null {
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
      return providersError("PROVIDER_MEDIA_INVALID", {
        field: "file",
        reason: "TOO_LARGE",
      });
    }
    if (
      code === "LIMIT_FILE_COUNT" ||
      code === "LIMIT_UNEXPECTED_FILE" ||
      code === "LIMIT_PART_COUNT" ||
      code === "LIMIT_FIELD_COUNT"
    ) {
      return providersError("PROVIDER_MEDIA_INVALID", {
        field: "file",
        reason: "MULTIPART",
      });
    }
  }
  return null;
}

export const providerMediaMulterErrorHandler: ErrorRequestHandler = (
  error,
  _request,
  _response,
  next,
) => {
  const mapped = mapProviderMediaMulterError(error);
  next(mapped ?? error);
};

/** Parses multipart expectedVersion after Multer runs. */
export const requireProviderMediaMultipartFields: RequestHandler = (
  request,
  _response,
  next,
) => {
  if (request.file === undefined) {
    next(
      providersError("PROVIDER_MEDIA_INVALID", {
        field: "file",
        reason: "REQUIRED",
      }),
    );
    return;
  }
  const raw = request.body?.expectedVersion;
  let parsed = Number.NaN;
  if (typeof raw === "string") {
    parsed = Number.parseInt(raw, 10);
  } else if (typeof raw === "number") {
    parsed = raw;
  }
  if (!Number.isInteger(parsed) || parsed < 1) {
    next(
      providersError("VALIDATION_ERROR", {
        field: "expectedVersion",
      }),
    );
    return;
  }
  request.body = {
    ...request.body,
    expectedVersion: parsed,
  };
  next();
};
