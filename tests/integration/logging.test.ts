import { createApp } from "../../src/app.js";
import { createApplicationLogger } from "../../src/shared/logger.js";
import { createTestEnvironment } from "../helpers/test-environment.js";

const request = require("supertest") as typeof import("supertest");

describe("application and Morgan logging", () => {
  it("writes application levels, child context, and redacts secrets", () => {
    const lines: string[] = [];
    const logger = createApplicationLogger(
      "debug",
      { application: "cleanora-test" },
      { write: (line) => lines.push(line) },
    );

    logger.debug("debug event");
    logger.info("login event", {
      password: "do-not-log",
      token: "do-not-log",
      email: "private@example.test",
      nested: {
        otp: "nested-otp-must-not-log",
        refreshToken: "nested-refresh-token-must-not-log",
      },
    });
    logger.child({ component: "auth" }).info("child event");

    const output = lines.join("\n");
    expect(output).toContain("login event");
    expect(output).toContain("[REDACTED]");
    expect(output).toContain("child event");
    expect(output).not.toContain("do-not-log");
    expect(output).not.toContain("private@example.test");
    expect(output).not.toContain("nested-otp-must-not-log");
    expect(output).not.toContain("nested-refresh-token-must-not-log");
  });

  it("uses Morgan without logging query, authorization, or cookie values", async () => {
    const lines: string[] = [];
    const logger = createApplicationLogger("info");
    const app = createApp({
      environment: createTestEnvironment({ NODE_ENV: "production" }),
      logger,
      httpLogStream: { write: (line) => lines.push(line) },
    });

    await request(app)
      .get("/api/v1/system/health/live?token=private-query-token")
      .set("authorization", "Bearer private-access-token")
      .set("cookie", "cleanora_refresh=private-refresh-token")
      .expect(200);

    const output = lines.join("\n");
    expect(output).toContain("GET /api/v1/system/health/live");
    expect(output).not.toContain("private-query-token");
    expect(output).not.toContain("private-access-token");
    expect(output).not.toContain("private-refresh-token");
  });
});
