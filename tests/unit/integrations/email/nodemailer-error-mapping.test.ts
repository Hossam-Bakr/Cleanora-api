import {
  EmailDeliveryError,
  NodemailerEmailAdapter,
  mapEmailDeliveryError,
} from "../../../../src/integrations/email/nodemailer.adapter.js";

describe("Nodemailer delivery error mapping", () => {
  it.each([
    [{ code: "EAUTH" }, "EMAIL_AUTHENTICATION_FAILED"],
    [{ code: "ETIMEDOUT" }, "EMAIL_TIMEOUT"],
    [{ code: "EENVELOPE" }, "EMAIL_RECIPIENT_REJECTED"],
    [{ responseCode: 550 }, "EMAIL_RECIPIENT_REJECTED"],
    [{ responseCode: 559 }, "EMAIL_RECIPIENT_REJECTED"],
    [{ responseCode: 560 }, "EMAIL_PROVIDER_UNAVAILABLE"],
    [{ code: "ECONNECTION" }, "EMAIL_CONNECTION_FAILED"],
    [{ code: "ECONNREFUSED" }, "EMAIL_CONNECTION_FAILED"],
    [{ code: "ENOTFOUND" }, "EMAIL_CONNECTION_FAILED"],
    [{ code: "ETLS" }, "EMAIL_CONNECTION_FAILED"],
    [{ code: "ESOCKET" }, "EMAIL_CONNECTION_FAILED"],
    [{ code: "UNKNOWN" }, "EMAIL_PROVIDER_UNAVAILABLE"],
    ["not-an-object", "EMAIL_PROVIDER_UNAVAILABLE"],
  ] as const)("maps %j to %s", (error, expected) => {
    const mapped = mapEmailDeliveryError(error);
    expect(mapped).toBeInstanceOf(EmailDeliveryError);
    expect(mapped.name).toBe(expected);
  });

  it("accepts successful sends and empty rejected lists", async () => {
    const sendMail = vi.fn(async () => ({ rejected: [] }));
    const adapter = new NodemailerEmailAdapter({ sendMail });
    await expect(
      adapter.send({
        to: ["person@example.test"],
        subject: "subject",
        html: "<p>body</p>",
        text: "body",
        idempotencyKey: "email-ok",
      }),
    ).resolves.toBeUndefined();
    expect(sendMail).toHaveBeenCalledOnce();
  });

  it("rejects transport responses that list rejected recipients", async () => {
    const adapter = new NodemailerEmailAdapter({
      sendMail: vi.fn(async () => ({ rejected: ["bad@example.test"] })),
    });
    await expect(
      adapter.send({
        to: ["bad@example.test"],
        subject: "subject",
        html: "<p>body</p>",
        text: "body",
        idempotencyKey: "email-rejected",
      }),
    ).rejects.toMatchObject({ name: "EMAIL_RECIPIENT_REJECTED" });
  });

  it("maps provider send failures without retaining the raw payload", async () => {
    const adapter = new NodemailerEmailAdapter({
      sendMail: vi.fn(async () => {
        throw Object.assign(new Error("smtp blew up"), { code: "EAUTH" });
      }),
    });
    const withFrom = new NodemailerEmailAdapter(
      {
        sendMail: vi.fn(async () => {
          throw Object.assign(new Error("smtp blew up"), { code: "ETIMEDOUT" });
        }),
      },
      { name: "Cleanora", address: "noreply@cleanora.test" },
    );

    await expect(
      adapter.send({
        to: ["person@example.test"],
        subject: "subject",
        html: "<p>body</p>",
        text: "body",
        idempotencyKey: "email-auth",
      }),
    ).rejects.toMatchObject({ name: "EMAIL_AUTHENTICATION_FAILED" });

    await expect(
      withFrom.send({
        to: ["person@example.test"],
        subject: "subject",
        html: "<p>body</p>",
        text: "body",
        idempotencyKey: "email-timeout",
      }),
    ).rejects.toMatchObject({ name: "EMAIL_TIMEOUT" });
  });

  it("requires a verify capability and maps verify failures safely", async () => {
    const unavailable = new NodemailerEmailAdapter({
      sendMail: vi.fn(),
    });
    await expect(unavailable.verify()).rejects.toMatchObject({
      name: "EMAIL_PROVIDER_UNAVAILABLE",
    });

    const failing = new NodemailerEmailAdapter({
      sendMail: vi.fn(),
      verify: vi.fn(async () => {
        throw Object.assign(new Error("down"), { code: "ECONNECTION" });
      }),
    });
    await expect(failing.verify()).rejects.toMatchObject({
      name: "EMAIL_CONNECTION_FAILED",
    });

    const ok = new NodemailerEmailAdapter({
      sendMail: vi.fn(),
      verify: vi.fn(async () => undefined),
    });
    await expect(ok.verify()).resolves.toBeUndefined();
  });
});
