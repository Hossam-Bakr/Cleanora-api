
import { R1_P07_SENTINELS } from "./r1-p07-workforce-fixtures.js";

const forbiddenKeys = /(?:operationalPhoneE164|invitationProof|password|otp|cookie|token|storageKey|credential)/iu;

export function stringifySafe(value: unknown): string {
  return JSON.stringify(value, (_key, candidate: unknown) =>
    typeof candidate === "bigint" ? candidate.toString() : candidate,
  );
}

export function expectNoR1P07SensitiveValues(value: unknown): void {
  const output = stringifySafe(value);
  for (const sentinel of Object.values(R1_P07_SENTINELS)) {
    expect(output).not.toContain(sentinel);
  }
}

export function expectNoR1P07SensitiveKeys(value: unknown): void {
  const visit = (candidate: unknown): void => {
    if (Array.isArray(candidate)) {
      candidate.forEach(visit);
      return;
    }
    if (candidate === null || typeof candidate !== "object") return;
    for (const [key, nested] of Object.entries(candidate as Record<string, unknown>)) {
      expect(key).not.toMatch(forbiddenKeys);
      visit(nested);
    }
  };
  visit(value);
}

export function captureSafeLogger() {
  const entries: unknown[] = [];
  return {
    entries,
    logger: {
      info: (value: unknown) => entries.push(value),
      warn: (value: unknown) => entries.push(value),
      error: (value: unknown) => entries.push(value),
    },
    assertSafe: () => {
      expectNoR1P07SensitiveValues(entries);
      expectNoR1P07SensitiveKeys(entries);
    },
  };
}
