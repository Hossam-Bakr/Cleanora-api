
import { requestIdMiddleware } from "../../../src/core/http/request-id.middleware.js";

function invokeRequestIdMiddleware(headerValue?: string): {
  readonly request: { requestId?: string; header(name: string): string | undefined };
  readonly setHeader: ReturnType<typeof vi.fn>;
} {
  const request = {
    header: vi.fn(() => headerValue)
  };
  const setHeader = vi.fn();

  requestIdMiddleware(
    request as never,
    { setHeader } as never,
    vi.fn() as never
  );

  return { request, setHeader };
}

describe("requestIdMiddleware", () => {
  it("accepts a valid client UUID for correlation", () => {
    const requestId = "4f4c48ef-8d26-47ec-98b0-385f21f15f2f";
    const { request, setHeader } = invokeRequestIdMiddleware(requestId);

    expect(request.requestId).toBe(requestId);
    expect(setHeader).toHaveBeenCalledWith("x-request-id", requestId);
  });

  it("mints a UUID when the request ID is missing", () => {
    const { request, setHeader } = invokeRequestIdMiddleware();

    expect(request.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    expect(setHeader).toHaveBeenCalledWith("x-request-id", request.requestId);
  });

  it("replaces a malformed client value", () => {
    const { request } = invokeRequestIdMiddleware("untrusted-client-value");

    expect(request.requestId).not.toBe("untrusted-client-value");
    expect(request.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });
});
