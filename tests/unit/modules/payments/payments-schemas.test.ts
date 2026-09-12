import {
  browserReturnQuerySchema,
  idempotencyKeySchema,
  initiateDepositBodySchema,
  listMethodsQuerySchema,
  methodParamsSchema,
  paymentParamsSchema,
  setMethodEnabledBodySchema,
} from "#modules/payments/payments.schemas";

describe("R1-P15 payments Zod schemas", () => {
  it.each([
    ["idem-1", true],
    ["", false],
    ["x".repeat(129), false],
  ] as const)("idempotencyKeySchema(%s) → %s", (value, ok) => {
    expect(idempotencyKeySchema.safeParse(value).success).toBe(ok);
  });

  it.each([
    [{ countryId: "country-eg" }, true],
    [{ countryId: "" }, false],
    [{}, false],
  ] as const)("listMethodsQuerySchema %j → %s", (value, ok) => {
    expect(listMethodsQuerySchema.safeParse(value).success).toBe(ok);
  });

  it.each([
    [{ bookingId: "b1", paymentMethodId: "m1" }, true],
    [{ bookingId: "", paymentMethodId: "m1" }, false],
    [{ bookingId: "b1" }, false],
  ] as const)("initiateDepositBodySchema %j → %s", (value, ok) => {
    expect(initiateDepositBodySchema.safeParse(value).success).toBe(ok);
  });

  it("browserReturnQuerySchema accepts optional identifiers", () => {
    expect(browserReturnQuerySchema.safeParse({}).success).toBe(true);
    expect(
      browserReturnQuerySchema.safeParse({
        paymentId: "p1",
        attemptId: "a1",
        returnToken: "tok",
        success: "true",
      }).success,
    ).toBe(true);
    expect(browserReturnQuerySchema.safeParse({ paymentId: "" }).success).toBe(
      false,
    );
  });

  it.each([
    [paymentParamsSchema, { paymentId: "pay-1" }, true],
    [paymentParamsSchema, { paymentId: "" }, false],
    [methodParamsSchema, { methodId: "method-1" }, true],
    [methodParamsSchema, {}, false],
  ] as const)("params schema %j → %s", (schema, value, ok) => {
    expect(schema.safeParse(value).success).toBe(ok);
  });

  it.each([
    [{ enabled: true }, true],
    [{ enabled: false }, true],
    [{ enabled: "yes" }, false],
    [{}, false],
  ] as const)("setMethodEnabledBodySchema %j → %s", (value, ok) => {
    expect(setMethodEnabledBodySchema.safeParse(value).success).toBe(ok);
  });
});
