
import {
  createFailureResponse,
  sendSuccess
} from "../../../src/core/http/api-response.js";

describe("API response helpers", () => {
  it("creates a standard success envelope with optional metadata", () => {
    const request = { requestId: "request-123" } as never;
    const json = vi.fn();
    const response = { status: vi.fn().mockReturnValue({ json }) };

    sendSuccess(request, response as never, 201, { id: "country-eg" }, {
      page: 1
    });

    expect(response.status).toHaveBeenCalledWith(201);
    expect(json).toHaveBeenCalledWith({
      success: true,
      data: { id: "country-eg" },
      requestId: "request-123",
      meta: { page: 1 }
    });
  });

  it("creates a standard failure envelope without unapproved fields", () => {
    const request = { requestId: "request-456" } as never;

    expect(
      createFailureResponse(request, {
        code: "REQUEST_VALIDATION_FAILED",
        statusCode: 400,
        message: "Request validation failed",
        details: { issues: [] }
      })
    ).toEqual({
      success: false,
      error: {
        code: "REQUEST_VALIDATION_FAILED",
        statusCode: 400,
        message: "Request validation failed",
        details: { issues: [] }
      },
      requestId: "request-456"
    });
  });
});
