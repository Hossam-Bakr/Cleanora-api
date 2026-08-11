import { providersError } from "./providers.errors.js";
import type {
  ProviderContactChannel,
  ProviderContactChannelType,
} from "./providers.types.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const E164_PATTERN = /^\+[1-9][0-9]{7,14}$/u;
const MAX_CHANNELS = 20;

function hasTrimmedText(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/** Trim presentation text; blank becomes null (never satisfies completion). */
export function normalizeProfileText(
  value: string | null | undefined,
): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export function profileFieldsSatisfyCompletion(input: {
  readonly displayNameAr: string | null | undefined;
  readonly descriptionAr: string | null | undefined;
  readonly countryId: string | null | undefined;
}): boolean {
  return (
    hasTrimmedText(input.displayNameAr) &&
    hasTrimmedText(input.descriptionAr) &&
    hasTrimmedText(input.countryId)
  );
}

export function normalizeOperationalEmail(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (normalized.length === 0 || normalized.length > 320 || !EMAIL_PATTERN.test(normalized)) {
    throw providersError("VALIDATION_ERROR", { field: "operationalEmail" });
  }
  return normalized;
}

export function normalizeOperationalPhone(value: string): string {
  const normalized = value.replace(/[\s()-]/gu, "");
  if (!E164_PATTERN.test(normalized)) {
    throw providersError("VALIDATION_ERROR", { field: "operationalPhone" });
  }
  return normalized;
}

function normalizeHttpsUrl(value: string, field: string): string {
  const trimmed = value.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw providersError("VALIDATION_ERROR", { field });
  }
  if (parsed.protocol !== "https:") {
    throw providersError("VALIDATION_ERROR", { field, reason: "HTTPS_REQUIRED" });
  }
  if (parsed.username !== "" || parsed.password !== "") {
    throw providersError("VALIDATION_ERROR", { field, reason: "CREDENTIALS_FORBIDDEN" });
  }
  parsed.hash = "";
  const path =
    parsed.pathname.length > 1 && parsed.pathname.endsWith("/")
      ? parsed.pathname.slice(0, -1)
      : parsed.pathname;
  const search = parsed.search;
  return `https://${parsed.host.toLowerCase()}${path === "/" ? "" : path}${search}`;
}

function normalizeChannelValue(
  type: ProviderContactChannelType,
  value: string,
): string {
  switch (type) {
    case "WHATSAPP":
      return normalizeOperationalPhone(value);
    case "WEBSITE":
      return normalizeHttpsUrl(value, "channels.WEBSITE");
    case "EXTERNAL_BOOKING":
      return normalizeHttpsUrl(value, "channels.EXTERNAL_BOOKING");
    case "SOCIAL":
      return normalizeHttpsUrl(value, "channels.SOCIAL");
    default: {
      throw providersError("VALIDATION_ERROR", { field: "channels.type" });
    }
  }
}

/**
 * Full-replace channel normalization with closed typed set and cardinality.
 * Throws VALIDATION_ERROR with field codes only (no raw contact values).
 */
export function normalizeContactChannels(
  channels: readonly { readonly type: ProviderContactChannelType; readonly value: string }[],
): ProviderContactChannel[] {
  if (channels.length > MAX_CHANNELS) {
    throw providersError("VALIDATION_ERROR", {
      field: "channels",
      reason: "MAX_CHANNELS_EXCEEDED",
    });
  }

  const normalized: ProviderContactChannel[] = channels.map((channel) => ({
    type: channel.type,
    value: normalizeChannelValue(channel.type, channel.value),
  }));

  assertContactChannelsValid(normalized);
  return normalized;
}

export function assertContactChannelsValid(
  channels: readonly ProviderContactChannel[],
): void {
  if (channels.length > MAX_CHANNELS) {
    throw providersError("VALIDATION_ERROR", {
      field: "channels",
      reason: "MAX_CHANNELS_EXCEEDED",
    });
  }

  let whatsapp = 0;
  let website = 0;
  let externalBooking = 0;
  const social = new Set<string>();

  for (const channel of channels) {
    switch (channel.type) {
      case "WHATSAPP":
        whatsapp += 1;
        if (whatsapp > 1) {
          throw providersError("VALIDATION_ERROR", {
            field: "channels",
            reason: "WHATSAPP_AT_MOST_ONE",
          });
        }
        if (!E164_PATTERN.test(channel.value)) {
          throw providersError("VALIDATION_ERROR", {
            field: "channels.WHATSAPP",
          });
        }
        break;
      case "WEBSITE":
        website += 1;
        if (website > 1) {
          throw providersError("VALIDATION_ERROR", {
            field: "channels",
            reason: "WEBSITE_AT_MOST_ONE",
          });
        }
        break;
      case "EXTERNAL_BOOKING":
        externalBooking += 1;
        if (externalBooking > 1) {
          throw providersError("VALIDATION_ERROR", {
            field: "channels",
            reason: "EXTERNAL_BOOKING_AT_MOST_ONE",
          });
        }
        break;
      case "SOCIAL": {
        const key = channel.value;
        if (social.has(key)) {
          throw providersError("VALIDATION_ERROR", {
            field: "channels",
            reason: "SOCIAL_NOT_UNIQUE",
          });
        }
        social.add(key);
        break;
      }
      default: {
        throw providersError("VALIDATION_ERROR", { field: "channels.type" });
      }
    }
  }
}
