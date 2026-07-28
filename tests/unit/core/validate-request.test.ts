import { validateRequest } from "../../../src/core/http/validate-request.js";
import { z } from "zod";

describe("validateRequest", () => {
  it("aggregates body, params, and query failures into one REQUEST_VALIDATION_FAILED", () => {
    const middleware = validateRequest({
      body: z.object({ phone: z.string().min(1) }),
      params: z.object({ id: z.string().uuid() }),
      query: z.object({ page: z.coerce.number().int().positive() }),
    });
    const next = vi.fn();

    middleware(
      {
        body: {},
        params: { id: "not-a-uuid" },
        query: { page: "0" },
      } as never,
      {} as never,
      next,
    );

    expect(next.mock.calls[0]?.[0]).toMatchObject({
      code: "REQUEST_VALIDATION_FAILED",
      statusCode: 400,
      expose: true,
    });
    const issues = next.mock.calls[0]?.[0].details.issues as Array<{
      path: string;
    }>;
    expect(issues.map((issue) => issue.path).sort()).toEqual(
      ["id", "page", "phone"].sort(),
    );
  });

  it("continues when every supplied schema succeeds", () => {
    const middleware = validateRequest({
      body: z.object({ phone: z.string().min(1) }),
    });
    const next = vi.fn();

    middleware(
      { body: { phone: "+201012345678" }, params: {}, query: {} } as never,
      {} as never,
      next,
    );

    expect(next).toHaveBeenCalledWith();
  });
});
