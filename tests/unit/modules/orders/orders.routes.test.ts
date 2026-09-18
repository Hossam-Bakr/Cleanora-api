import type { NextFunction, Request, RequestHandler, Response } from "express";
import { createOrdersRouter } from "#modules/orders/orders.routes";

describe("R1-P18 orders routes", () => {
  it("mounts dossier, transition, complete, media, and notes paths", () => {
    const authenticateAccess: RequestHandler = (
      _req: Request,
      _res: Response,
      next: NextFunction,
    ) => {
      next();
    };
    const router = createOrdersRouter({
      authenticateAccess,
      rateLimiter: {
        consume: async () => ({ allowed: true, retryAfterSeconds: 0 }),
      } as never,
      privacyHashSecret: "secret",
      service: {
        getOrder: async () => ({}),
        getOrEnsureByBooking: async () => ({}),
        getTimeline: async () => [],
        transitionOnTheWay: async () => ({}),
        transitionInProgress: async () => ({}),
        transitionReadyToComplete: async () => ({}),
        complete: async () => ({}),
        resendCompletionCode: async () => ({}),
        attachMedia: async () => ({}),
        addNote: async () => ({}),
        listMedia: async () => [],
      } as never,
    });
    const layered = (router as unknown as { stack: { route?: { path: string; methods: Record<string, boolean> } }[] }).stack
      .filter((layer) => layer.route !== undefined)
      .map((layer) => {
        const methods = Object.keys(layer.route!.methods).filter(
          (method) => layer.route!.methods[method],
        );
        return `${methods.join(",").toUpperCase()} ${layer.route!.path}`;
      })
      .sort();
    expect(layered).toEqual([
      "GET /:orderId",
      "GET /:orderId/media",
      "GET /:orderId/timeline",
      "GET /by-booking/:bookingId",
      "POST /:orderId/complete",
      "POST /:orderId/completion-code/resend",
      "POST /:orderId/media",
      "POST /:orderId/notes",
      "POST /:orderId/transitions/in-progress",
      "POST /:orderId/transitions/on-the-way",
      "POST /:orderId/transitions/ready-to-complete",
    ]);
  });
});
