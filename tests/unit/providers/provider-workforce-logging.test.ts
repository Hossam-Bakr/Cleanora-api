import type { NextFunction, Request, Response } from "express";

import { createHttpLogger, sanitizeHttpLogUrl } from "../../../src/middlewares/http-logger.js";
import { createApplicationLogger, sanitizeLogContext } from "../../../src/shared/logger.js";

describe("R1-P07 sensitive logging boundaries", () => {
  it("normalizes absent, malformed, encoded-control, secret-path, and oversized access-log URLs", () => {
    expect(sanitizeHttpLogUrl(undefined)).toBe("/");
    expect(sanitizeHttpLogUrl("token/private-value?phone=+201000000000#proof"))
      .toBe("/");
    expect(sanitizeHttpLogUrl("/api/token/private-value/next?proof=private"))
      .toBe("/api/token/[REDACTED]/next");
    expect(sanitizeHttpLogUrl("/api/%0d%0Aevil\u0000path"))
      .toBe("/api/[REDACTED][REDACTED]evilpath");
    expect(sanitizeHttpLogUrl(`/${"a".repeat(3_000)}`)).toHaveLength(2_048);
  });

  it("uses a no-op test middleware and builds both non-test logger formats", () => {
    const next = vi.fn();
    createHttpLogger("test")({} as Request, {} as Response, next as NextFunction);
    expect(next).toHaveBeenCalledTimes(1);
    expect(createHttpLogger("development", { write: vi.fn() })).toBeTypeOf("function");
    expect(createHttpLogger("production")).toBeTypeOf("function");
  });

  it("redacts nested collections, dates, errors, circular values, proof/storage keys, and respects levels", () => {
    const circular: Record<string, unknown> = {};
    circular["self"] = circular;
    const sanitized = sanitizeLogContext({
      at: new Date("2026-08-23T00:00:00.000Z"),
      error: new TypeError("safe synthetic failure"),
      list: [{ invitationProof: "private-proof" }, circular],
      storageKey: "private-storage-key",
      ordinary: true,
    });
    expect(sanitized).toEqual({
      at: "2026-08-23T00:00:00.000Z",
      error: { name: "TypeError", message: "safe synthetic failure" },
      list: [{ invitationProof: "[REDACTED]" }, { self: "[Circular]" }],
      storageKey: "[REDACTED]",
      ordinary: true,
    });

    const lines: string[] = [];
    const logger = createApplicationLogger("warn", { component: "workforce" }, { write: (line) => lines.push(line) });
    logger.debug("suppressed debug");
    logger.info("suppressed info");
    logger.warn("visible warning");
    logger.error("visible error");
    expect(lines).toHaveLength(2);
    expect(lines.join("\n")).toContain("visible warning");
    expect(lines.join("\n")).not.toContain("suppressed");
  });
});
