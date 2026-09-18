import type { Request, Response } from "express";

import { createOrdersController } from "#modules/orders/orders.controller";
import { AppError } from "#shared/errors/app-error";

function mockResponse(principal?: unknown) {
  const response = {
    locals: principal === undefined ? {} : { authenticationPrincipal: principal },
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return response as unknown as Response & {
    statusCode: number;
    body: unknown;
  };
}

const principal = {
  userId: "worker-1",
  sessionId: "s1",
  accountCategories: ["INDIVIDUAL"],
  verifiedCategories: ["INDIVIDUAL"],
  pendingCategories: [],
  status: "ACTIVE",
  verificationOnly: false,
};

function requestWith(input: {
  readonly params?: Record<string, string>;
  readonly body?: unknown;
  readonly idempotencyKey?: string;
}): Request {
  return {
    params: input.params ?? { orderId: "ord-1" },
    body: input.body ?? {},
    get: (name: string) => {
      if (name.toLowerCase() === "idempotency-key") {
        return input.idempotencyKey;
      }
      return undefined;
    },
  } as unknown as Request;
}

describe("R1-P18 orders controller", () => {
  it("maps authenticated get/transition/complete calls to the service", async () => {
    const service = {
      getOrder: vi.fn(async () => ({ orderId: "ord-1", status: "ASSIGNED" })),
      getOrEnsureByBooking: vi.fn(async () => ({ orderId: "ord-1" })),
      getTimeline: vi.fn(async () => [{ type: "CREATED" }]),
      transitionOnTheWay: vi.fn(async () => ({ status: "ON_THE_WAY" })),
      transitionInProgress: vi.fn(async () => ({ status: "IN_PROGRESS" })),
      transitionReadyToComplete: vi.fn(async () => ({
        status: "READY_TO_COMPLETE",
      })),
      complete: vi.fn(async () => ({ status: "COMPLETED" })),
      resendCompletionCode: vi.fn(async () => ({ status: "READY_TO_COMPLETE" })),
      attachMedia: vi.fn(async () => ({ mediaId: "m1" })),
      addNote: vi.fn(async () => ({ noteId: "n1" })),
      listMedia: vi.fn(async () => []),
    };
    const controller = createOrdersController({ service: service as never });
    const next = vi.fn();
    const response = mockResponse(principal);

    await controller.getOrder(requestWith({}), response, next);
    expect(service.getOrder).toHaveBeenCalled();
    await controller.getByBooking(
      requestWith({ params: { bookingId: "bk-1" } }),
      response,
      next,
    );
    expect(service.getOrEnsureByBooking).toHaveBeenCalled();
    await controller.getTimeline(requestWith({}), response, next);
    expect(service.getTimeline).toHaveBeenCalled();
    await controller.onTheWay(
      requestWith({ idempotencyKey: "k1" }),
      response,
      next,
    );
    expect(service.transitionOnTheWay).toHaveBeenCalled();
    await controller.inProgress(
      requestWith({ idempotencyKey: "k2" }),
      response,
      next,
    );
    expect(service.transitionInProgress).toHaveBeenCalled();
    await controller.readyToComplete(
      requestWith({ idempotencyKey: "k3" }),
      response,
      next,
    );
    expect(service.transitionReadyToComplete).toHaveBeenCalled();
    await controller.complete(
      requestWith({ body: { code: "123456" }, idempotencyKey: "k4" }),
      response,
      next,
    );
    expect(service.complete).toHaveBeenCalled();
    await controller.resendCode(
      requestWith({ idempotencyKey: "k5" }),
      response,
      next,
    );
    expect(service.resendCompletionCode).toHaveBeenCalled();
    await controller.attachMedia(
      requestWith({
        body: { mediaFileId: "mf-1", kind: "COMPLETION" },
        idempotencyKey: "k6",
      }),
      response,
      next,
    );
    expect(service.attachMedia).toHaveBeenCalled();
    await controller.addNote(
      requestWith({ body: { body: "done" }, idempotencyKey: "k7" }),
      response,
      next,
    );
    expect(service.addNote).toHaveBeenCalled();
    await controller.listMedia(requestWith({}), response, next);
    expect(service.listMedia).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("requires auth and idempotency key on mutations", async () => {
    const service = { transitionOnTheWay: vi.fn() };
    const controller = createOrdersController({ service: service as never });
    const next = vi.fn();
    await controller.onTheWay(requestWith({}), mockResponse(), next);
    expect(next.mock.calls[0]?.[0]).toBeInstanceOf(AppError);
    expect((next.mock.calls[0]?.[0] as AppError).code).toBe(
      "AUTHENTICATION_REQUIRED",
    );

    await controller.onTheWay(requestWith({}), mockResponse(principal), next);
    expect(next.mock.calls.at(-1)?.[0]).toMatchObject({
      code: "VALIDATION_FAILED",
    });
  });

  it("forwards service failures on late handlers through next", async () => {
    const boom = new AppError({
      code: "ORDER_FORBIDDEN",
      message: "forbidden",
      statusCode: 403,
    });
    const service = {
      resendCompletionCode: vi.fn(async () => {
        throw boom;
      }),
      attachMedia: vi.fn(async () => {
        throw boom;
      }),
      addNote: vi.fn(async () => {
        throw boom;
      }),
      listMedia: vi.fn(async () => {
        throw boom;
      }),
    };
    const controller = createOrdersController({ service: service as never });
    const next = vi.fn();
    const response = mockResponse(principal);

    await controller.resendCode(
      requestWith({ idempotencyKey: "e1" }),
      response,
      next,
    );
    await controller.attachMedia(
      requestWith({
        body: { mediaFileId: "mf-1", kind: "PROGRESS" },
        idempotencyKey: "e2",
      }),
      response,
      next,
    );
    await controller.addNote(
      requestWith({ body: { body: "n" }, idempotencyKey: "e3" }),
      response,
      next,
    );
    await controller.listMedia(requestWith({}), response, next);
    expect(next).toHaveBeenCalledTimes(4);
    expect(next.mock.calls.every((call) => call[0] === boom)).toBe(true);
  });
});
