import { createTestApp } from "../../helpers/create-test-app.js";
import { validateRequest } from "../../../src/middlewares/validate-request.js";
import { signupSchema } from "../../../src/modules/authentication/auth.schema.js";
import { createTestEnvironment } from "../../helpers/test-environment.js";
import { TestLogger } from "../../helpers/test-logger.js";

const express = require("express") as typeof import("express");
const request = require("supertest") as typeof import("supertest");

describe("authentication request validation", () => {
  it("returns every independent invalid signup field in one response", async () => {
    const router = express.Router();
    router.post(
      "/auth/signup",
      validateRequest({ body: signupSchema.shape.body }),
      (_request, response) => response.status(204).end(),
    );
    const app = createTestApp({
      environment: createTestEnvironment(),
      logger: new TestLogger(),
      mountTestRoutes(expressApp) {
        expressApp.use("/api/v1", router);
      },
    });

    const response = await request(app)
      .post("/api/v1/auth/signup")
      .send({
        accountCategory: "INDIVIDUAL",
        fullName: "Invalid Fields Customer",
        phone: "123",
        email: "invalid",
        password: "1234567",
      })
      .expect(400);

    expect(response.body.error).toMatchObject({
      code: "REQUEST_VALIDATION_FAILED",
      statusCode: 400,
      message: "Request validation failed",
    });
    expect(response.body.error.details.issues).toEqual([
      expect.objectContaining({
        path: "phone",
        message: expect.stringContaining("international phone number"),
      }),
      expect.objectContaining({
        path: "email",
        message: "Enter a valid email address",
      }),
      expect.objectContaining({
        path: "password",
        message: "Password must not be common, repeated, or sequential",
      }),
    ]);
  });
});
