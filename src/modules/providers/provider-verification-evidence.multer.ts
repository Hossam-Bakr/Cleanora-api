import multer from "multer";
import type { ErrorRequestHandler, RequestHandler } from "express";

import { AppError } from "#shared/errors/app-error";

// The multipart ceiling permits the larger PDF contract. The Media policy
// applies the stricter 5 MiB image limit after trusted content detection.
const MAX_EVIDENCE_BYTES = 15 * 1024 * 1024;
const ALLOWED = new Set(["application/pdf", "image/jpeg", "image/png"]);

export const providerVerificationEvidenceUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_EVIDENCE_BYTES, files: 1, fields: 4, parts: 6, headerPairs: 32 },
  fileFilter: (_request, file, callback) => {
    if (!ALLOWED.has(file.mimetype)) {
      callback(new AppError({
        code: "DOCUMENT_EVIDENCE_INVALID",
        message: "Verification evidence format is not supported",
        statusCode: 415,
        expose: true,
      }));
      return;
    }
    callback(null, true);
  },
}).single("file");

export const requireVerificationEvidenceFields: RequestHandler = (request, _response, next) => {
  const expectedVersion = Number(request.body?.expectedVersion);
  const position = Number(request.body?.position);
  const commandId = request.body?.commandId;
  if (
    request.file === undefined ||
    !Number.isInteger(expectedVersion) || expectedVersion < 1 ||
    !Number.isInteger(position) || position < 0 ||
    typeof commandId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(commandId)
  ) {
    next(new AppError({
      code: "REQUEST_VALIDATION_FAILED",
      message: "Verification evidence multipart fields are invalid",
      statusCode: 400,
      expose: true,
    }));
    return;
  }
  request.body = { expectedVersion, position, commandId };
  next();
};

export const providerVerificationEvidenceMulterErrorHandler: ErrorRequestHandler = (
  error, _request, _response, next,
) => {
  if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
    next(new AppError({
      code: "DOCUMENT_EVIDENCE_TOO_LARGE",
      message: "Verification evidence exceeds the accepted size",
      statusCode: 413,
      expose: true,
    }));
    return;
  }
  next(error);
};
