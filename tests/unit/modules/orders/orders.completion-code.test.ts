import {
  hashCompletionCode,
  issueCompletionCode,
  isSixDigitCode,
  verifyCompletionCode,
} from "#modules/orders/domain/completion-code";

describe("R1-P18 completion code domain", () => {
  it("issues six-digit codes and verifies with constant-time hash", () => {
    const issued = issueCompletionCode({
      now: new Date("2026-09-14T12:00:00.000Z"),
      pepper: "test-pepper",
    });
    expect(isSixDigitCode(issued.plaintext)).toBe(true);
    expect(issued.codeHash).not.toContain(issued.plaintext);
    expect(
      verifyCompletionCode({
        plaintext: issued.plaintext,
        codeHash: issued.codeHash,
        codeSalt: issued.codeSalt,
        pepper: "test-pepper",
      }),
    ).toBe(true);
    expect(
      verifyCompletionCode({
        plaintext: "000000",
        codeHash: issued.codeHash,
        codeSalt: issued.codeSalt,
        pepper: "test-pepper",
      }),
    ).toBe(false);
  });

  it("defaults TTL and maxAttempts", () => {
    const now = new Date("2026-09-14T12:00:00.000Z");
    const issued = issueCompletionCode({ now });
    expect(issued.expiresAt.getTime() - now.getTime()).toBe(1800_000);
    expect(issued.maxAttempts).toBe(5);
    expect(hashCompletionCode("123456", "salt")).toHaveLength(64);
  });
});
