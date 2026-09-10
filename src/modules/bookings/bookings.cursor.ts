import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { browseError } from "./bookings.errors.js";

export interface BrowseCursorPayload {
  readonly resultHash: string;
  readonly filterDigest: string;
  readonly offset: number;
}

/**
 * @desc Sign an opaque Browse pagination cursor.
 * @access Bookings module
 */
export function encodeBrowseCursor(
  payload: BrowseCursorPayload,
  secret: string,
): string {
  const body = Buffer.from(
    JSON.stringify({
      resultHash: payload.resultHash,
      filterDigest: payload.filterDigest,
      offset: payload.offset,
    }),
    "utf8",
  ).toString("base64url");
  const signature = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${signature}`;
}

/**
 * @desc Decode and verify a Browse pagination cursor.
 * @access Bookings module
 */
export function decodeBrowseCursor(
  cursor: string,
  secret: string,
): BrowseCursorPayload {
  const parts = cursor.split(".");
  const [body, signature] = parts;
  if (
    parts.length !== 2 ||
    body === undefined ||
    signature === undefined ||
    body.length === 0 ||
    signature.length === 0
  ) {
    throw browseError("VALIDATION_FAILED", { field: "cursor" });
  }
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    throw browseError("VALIDATION_FAILED", { field: "cursor" });
  }
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as {
      readonly resultHash?: unknown;
      readonly filterDigest?: unknown;
      readonly offset?: unknown;
    };
    if (
      typeof parsed.resultHash !== "string" ||
      typeof parsed.filterDigest !== "string" ||
      typeof parsed.offset !== "number" ||
      !Number.isInteger(parsed.offset) ||
      parsed.offset < 0
    ) {
      throw browseError("VALIDATION_FAILED", { field: "cursor" });
    }
    return {
      resultHash: parsed.resultHash,
      filterDigest: parsed.filterDigest,
      offset: parsed.offset,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AppError") {
      throw error;
    }
    throw browseError("VALIDATION_FAILED", { field: "cursor" });
  }
}

/**
 * @desc Stable digest for filter/sort binding inside a cursor fingerprint.
 * @access Bookings module
 */
export function browseFilterDigest(input: {
  readonly serviceId: string;
  readonly countryId: string;
  readonly cityId: string;
  readonly districtId?: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly crewPreference: "all_male" | "all_female" | "any";
  readonly requiredTeamUnits: number;
  readonly maxPriceAmount?: string;
  readonly q?: string;
  readonly locale: string;
}): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        serviceId: input.serviceId,
        countryId: input.countryId,
        cityId: input.cityId,
        districtId: input.districtId ?? null,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        crewPreference: input.crewPreference,
        requiredTeamUnits: input.requiredTeamUnits,
        maxPriceAmount: input.maxPriceAmount ?? null,
        q: input.q?.trim().toLowerCase() ?? null,
        locale: input.locale,
      }),
      "utf8",
    )
    .digest("base64url");
}
