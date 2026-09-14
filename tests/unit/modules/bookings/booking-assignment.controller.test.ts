import type { Request, Response } from "express";
import { createBookingAssignmentController } from "#modules/bookings/bookings.assignment.controller";

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
  userId: "owner-1",
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
  readonly requestId?: string;
}): Request {
  return {
    params: input.params ?? { providerId: "prov-1", bookingId: "bk-1" },
    body: input.body ?? {},
    get: (name: string) => {
      const key = name.toLowerCase();
      if (key === "idempotency-key") {
        return input.idempotencyKey;
      }
      if (key === "x-request-id") {
        return input.requestId;
      }
      return undefined;
    },
    requestId: "11111111-1111-4111-8111-111111111111",
  } as unknown as Request;
}

describe("R1-P17 booking assignment HTTP adapters", () => {
  it("requires authentication principal", async () => {
    const next = vi.fn();
    const controller = createBookingAssignmentController({
      service: { getCurrent: vi.fn() } as never,
    });
    await controller.getCurrent(requestWith({}), mockResponse(), next);
    expect(next.mock.calls[0]?.[0]).toMatchObject({ code: "AUTHENTICATION_REQUIRED" });
  });

  it("requires Idempotency-Key on assign-team", async () => {
    const next = vi.fn();
    const controller = createBookingAssignmentController({
      service: { assignTeam: vi.fn() } as never,
    });
    await controller.assignTeam(
      requestWith({
        body: { expectedBookingVersion: 5, teamId: "team-1" },
      }),
      mockResponse(principal),
      next,
    );
    expect(next.mock.calls[0]?.[0]).toMatchObject({ code: "VALIDATION_FAILED" });
  });

  it("assigns team with version and idempotency key", async () => {
    const assignTeam = vi.fn().mockResolvedValue({
      bookingId: "bk-1",
      status: "ASSIGNED",
      version: 6,
      assignmentId: "asg-1",
    });
    const controller = createBookingAssignmentController({
      service: { assignTeam } as never,
    });
    const response = mockResponse(principal);
    await controller.assignTeam(
      requestWith({
        body: { expectedBookingVersion: 5, teamId: "team-1" },
        idempotencyKey: "idem-1",
        requestId: "req-1",
      }),
      response,
      vi.fn(),
    );
    expect(response.statusCode).toBe(200);
    expect(assignTeam).toHaveBeenCalledWith({
      actorUserId: "owner-1",
      providerId: "prov-1",
      bookingId: "bk-1",
      teamId: "team-1",
      expectedBookingVersion: 5,
      idempotencyKey: "idem-1",
      requestId: "req-1",
    });
  });

  it("assigns workers", async () => {
    const assignWorkers = vi.fn().mockResolvedValue({
      bookingId: "bk-1",
      status: "ASSIGNED",
      version: 6,
      assignmentId: "asg-2",
    });
    const controller = createBookingAssignmentController({
      service: { assignWorkers } as never,
    });
    const response = mockResponse(principal);
    await controller.assignWorkers(
      requestWith({
        body: { expectedBookingVersion: 5, workerIds: ["w1", "w2"] },
        idempotencyKey: "idem-w",
      }),
      response,
      vi.fn(),
    );
    expect(response.statusCode).toBe(200);
    expect(assignWorkers).toHaveBeenCalledWith(
      expect.objectContaining({
        workerIds: ["w1", "w2"],
        idempotencyKey: "idem-w",
      }),
    );
  });

  it("replaces team and workers", async () => {
    const replaceTeam = vi.fn().mockResolvedValue({ bookingId: "bk-1", status: "ASSIGNED" });
    const replaceWorkers = vi.fn().mockResolvedValue({ bookingId: "bk-1", status: "ASSIGNED" });
    const controller = createBookingAssignmentController({
      service: { replaceTeam, replaceWorkers } as never,
    });
    const response = mockResponse(principal);
    await controller.replaceTeam(
      requestWith({
        body: { expectedBookingVersion: 6, teamId: "team-1" },
        idempotencyKey: "idem-rt",
      }),
      response,
      vi.fn(),
    );
    await controller.replaceWorkers(
      requestWith({
        body: { expectedBookingVersion: 7, workerIds: ["w9"] },
        idempotencyKey: "idem-rw",
      }),
      response,
      vi.fn(),
    );
    expect(replaceTeam).toHaveBeenCalled();
    expect(replaceWorkers).toHaveBeenCalled();
  });

  it("reads current and history", async () => {
    const getCurrent = vi.fn().mockResolvedValue({ assignmentId: "asg-1" });
    const getHistory = vi.fn().mockResolvedValue({ items: [] });
    const controller = createBookingAssignmentController({
      service: { getCurrent, getHistory } as never,
    });
    const response = mockResponse(principal);
    await controller.getCurrent(requestWith({}), response, vi.fn());
    await controller.getHistory(requestWith({}), response, vi.fn());
    expect(getCurrent).toHaveBeenCalledWith({
      actorUserId: "owner-1",
      providerId: "prov-1",
      bookingId: "bk-1",
    });
    expect(getHistory).toHaveBeenCalled();
  });

  it("lists my assignments for the authenticated worker", async () => {
    const listWorkerAssignments = vi.fn().mockResolvedValue({ items: [] });
    const controller = createBookingAssignmentController({
      service: { listWorkerAssignments } as never,
    });
    const response = mockResponse(principal);
    await controller.listMyAssignments(requestWith({ params: {} }), response, vi.fn());
    expect(listWorkerAssignments).toHaveBeenCalledWith({ workerUserId: "owner-1" });
    expect(response.statusCode).toBe(200);
  });

  it("maps zod failures on invalid body", async () => {
    const next = vi.fn();
    const controller = createBookingAssignmentController({
      service: { assignTeam: vi.fn() } as never,
    });
    await controller.assignTeam(
      requestWith({
        body: { expectedBookingVersion: 5 },
        idempotencyKey: "idem-bad",
      }),
      mockResponse(principal),
      next,
    );
    expect(next.mock.calls[0]?.[0]).toMatchObject({ code: "VALIDATION_FAILED" });
  });
});
