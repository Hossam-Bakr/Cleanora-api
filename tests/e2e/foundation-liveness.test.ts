import type { AddressInfo } from "node:net";


import { createApp } from "../../src/app.js";
import { createTestEnvironment } from "../helpers/test-environment.js";
import { TestLogger } from "../helpers/test-logger.js";

const request = require("supertest") as typeof import("supertest");

const servers: Array<ReturnType<ReturnType<typeof createApp>["listen"]>> = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => {
            if (error !== undefined) {
              reject(error);
              return;
            }

            resolve();
          });
        })
    )
  );
});

describe("foundation liveness journey", () => {
  it("serves distinct live, ready, and database health signals", async () => {
    const app = createApp({
      environment: createTestEnvironment(),
      logger: new TestLogger(),
      databaseProbe: { check: async () => Promise.resolve() },
      readinessProbes: [
        { name: "postgresql", check: async () => Promise.resolve() }
      ]
    });
    const server = app.listen(0);
    servers.push(server);

    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const live = await request(baseUrl)
      .get("/api/v1/system/health/live")
      .expect(200);
    const ready = await request(baseUrl)
      .get("/api/v1/system/health/ready")
      .expect(200);
    const database = await request(baseUrl)
      .get("/api/v1/system/health/database")
      .expect(200);

    expect(live.body.data.status).toBe("ok");
    expect(ready.body.data.status).toBe("ready");
    expect(database.body.data.status).toBe("up");
  });
});
