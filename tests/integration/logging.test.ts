import { Writable } from "node:stream";

import type { DestinationStream } from "pino";
import { describe, expect, it } from "vitest";

import { createApp } from "../../src/app.js";
import { createPinoLogging } from "../../src/integrations/logging/pino-logger.js";
import { createTestEnvironment } from "../helpers/test-environment.js";

const request = require("supertest") as typeof import("supertest");

async function flushLogs(): Promise<void> {
  await new Promise<void>((resolve) => {
    setImmediate(resolve);
  });
}

describe("Pino logging", () => {
  it("writes application levels, child context, and redacts secrets", async () => {
    let output = "";
    const destination = new Writable({
      write(chunk, _encoding, callback) {
        output += chunk.toString();
        callback();
      }
    }) as DestinationStream;
    const { logger } = createPinoLogging(
      "debug",
      { application: "cleanora-test" },
      destination
    );

    logger.debug("debug event");
    logger.info("login event", {
      password: "do-not-log",
      token: "do-not-log",
      secret: "do-not-log",
      cookie: "do-not-log",
      email: "private@example.test",
      phone: "+201000000000",
      profile: {
        credential: "do-not-log",
        apiKey: "do-not-log"
      }
    });
    logger.warn("warning event");
    logger.error("error event");
    logger.child({ component: "auth" }).info("child event");
    await flushLogs();

    expect(output).toContain("login event");
    expect(output).toContain("[REDACTED]");
    expect(output).not.toContain("do-not-log");
    expect(output).not.toContain("private@example.test");
    expect(output).not.toContain("+201000000000");
    expect(output).toContain("child event");
  });

  it("logs safe request data without authorization or cookie values", async () => {
    let output = "";
    const destination = new Writable({
      write(chunk, _encoding, callback) {
        output += chunk.toString();
        callback();
      }
    }) as DestinationStream;
    const logging = createPinoLogging(
      "info",
      { application: "cleanora-test" },
      destination
    );
    const app = createApp({
      environment: createTestEnvironment(),
      logger: logging.logger,
      requestLogger: logging.requestLogger
    });

    await request(app)
      .get("/api/v1/system/health/live?token=private-query-token")
      .set("authorization", "Bearer private-access-token")
      .set("cookie", "cleanora_refresh=private-refresh-token")
      .expect(200);
    await request(app).get("/missing").expect(404);
    await flushLogs();

    expect(output).toContain("request completed");
    expect(output).toContain("requestId");
    expect(output).not.toContain("private-access-token");
    expect(output).not.toContain("private-refresh-token");
    expect(output).not.toContain("private-query-token");
  });
});
