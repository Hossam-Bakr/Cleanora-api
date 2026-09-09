/**
 * Configuration-owned IANA time-zone validation.
 *
 * Shape-only validation accepts plausible but unknown identifiers such as
 * `Mars/Olympus`. `Intl.DateTimeFormat` consults the runtime's IANA database
 * and throws for unrecognized zones, without importing Providers calendar
 * policy across the module boundary.
 */
export function isRecognizedIanaTimeZone(candidate: string): boolean {
  if (candidate.length === 0) {
    return false;
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: candidate }).format(
      new Date(0),
    );
    return true;
  } catch {
    return false;
  }
}
