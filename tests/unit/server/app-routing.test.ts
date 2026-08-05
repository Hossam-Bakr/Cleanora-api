import { createApp } from "../../../src/app.js";
import { createTestEnvironment } from "../../helpers/test-environment.js";
import { TestLogger } from "../../helpers/test-logger.js";

const request = require("supertest") as typeof import("supertest");

interface ExpressLayer {
  readonly name: string;
}

describe("application middleware and route placement", () => {
  it("keeps the frozen global order and terminal handlers last", async () => {
    const environment = createTestEnvironment();
    const logger = new TestLogger();
    const app = createApp(
      {
        environment,
        logger,
        rateLimiter: {
          consume: async () => ({ allowed: true, remaining: 119 }),
        },
      },
      {
        mountTestRoutes(expressApp) {
          expressApp.get("/api/v1/test-probe", (_request, response) => {
            response.status(204).end();
          });
        },
      },
    );

    const stack = (
      app as unknown as { router: { stack: readonly ExpressLayer[] } }
    ).router.stack;
    expect(stack.map((layer) => layer.name)).toEqual([
      "requestIdMiddleware",
      "<anonymous>",
      "helmetMiddleware",
      "corsMiddleware",
      "jsonParser",
      "cookieParser",
      "router",
      "router",
      "handle",
      "notFoundMiddleware",
      "<anonymous>",
    ]);

    const live = await request(app)
      .get("/api/v1/system/health/live")
      .expect(200);
    expect(live.body.requestId).toEqual(expect.any(String));
    await request(app).get("/api/v1/test-probe").expect(204);
    await request(app).get("/api/v1/missing").expect(404);
  });
});
