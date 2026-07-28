import { readFileSync } from "node:fs";
import { join } from "node:path";

import { isSessionActive } from "../../../../src/modules/authentication/domain/session.policy.js";

describe("authentication session policy", () => {
  const now = new Date("2026-07-25T12:00:00.000Z");

  it("accepts only an unrevoked session whose expiry is still in the future", () => {
    expect(
      isSessionActive(
        { revokedAt: null, expiresAt: new Date(now.getTime() + 1) },
        now
      )
    ).toBe(true);
    expect(
      isSessionActive(
        { revokedAt: now, expiresAt: new Date(now.getTime() + 1) },
        now
      )
    ).toBe(false);
    expect(
      isSessionActive(
        { revokedAt: null, expiresAt: new Date(now.getTime() - 1) },
        now
      )
    ).toBe(false);
    expect(
      isSessionActive({ revokedAt: null, expiresAt: now }, now)
    ).toBe(false);
  });

  it("uses the current time when no clock is supplied", () => {
    expect(
      isSessionActive({
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60_000)
      })
    ).toBe(true);
  });

  it("matches the previous inline access/refresh eligibility predicate", () => {
    const samples = [
      { revokedAt: null, expiresAt: new Date(now.getTime() + 1) },
      { revokedAt: now, expiresAt: new Date(now.getTime() + 1) },
      { revokedAt: null, expiresAt: new Date(now.getTime() - 1) },
      { revokedAt: null, expiresAt: now }
    ] as const;

    for (const session of samples) {
      const previousInline =
        session.revokedAt === null && session.expiresAt > now;
      expect(isSessionActive(session, now)).toBe(previousInline);
    }
  });
});

describe("authentication service session eligibility wiring", () => {
  it("reuses isSessionActive for access, refresh, and password-change checks", () => {
    const source = readFileSync(
      join(
        process.cwd(),
        "src/modules/authentication/application/authentication.service.ts"
      ),
      "utf8"
    );

    expect(source).toMatch(
      /import \{ isSessionActive \} from ["']\.\.\/domain\/session\.policy\.js["'];/
    );
    expect(
      source.match(/!isSessionActive\(session\)/g)?.length ?? 0
    ).toBeGreaterThanOrEqual(3);
    expect(source).not.toContain(
      "session.revokedAt !== null || session.expiresAt <= new Date()"
    );
    expect(source).not.toMatch(
      /claims\.userId !== principal\.userId \|\| session\.revokedAt !== null\)/
    );
  });
});
