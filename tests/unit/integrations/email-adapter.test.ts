
import { NodemailerEmailAdapter } from "../../../src/integrations/email/nodemailer.adapter.js";

describe("NodemailerEmailAdapter", () => {
  it("maps the email port contract to the injected transport", async () => {
    const sendMail = vi.fn().mockResolvedValue({ accepted: true });
    const adapter = new NodemailerEmailAdapter({ sendMail });

    await adapter.send({
      to: ["first@example.test", "second@example.test"],
      subject: "Safe subject",
      html: "<p>Safe body</p>",
      text: "Safe body",
      idempotencyKey: "email-1"
    });

    expect(sendMail).toHaveBeenCalledWith({
      to: "first@example.test,second@example.test",
      subject: "Safe subject",
      html: "<p>Safe body</p>",
      text: "Safe body",
      headers: { "x-cleanora-idempotency-key": "email-1" }
    });
  });
});
