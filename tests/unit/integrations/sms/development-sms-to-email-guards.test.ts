import type { EmailPort } from "../../../../src/core/email/index.js";
import { DevelopmentSmsToEmailAdapter } from "../../../../src/integrations/sms/development-sms-to-email.adapter.js";

describe("DevelopmentSmsToEmailAdapter guards", () => {
  const email: EmailPort = {
    async send() {
      return;
    },
  };

  it("forbids construction outside development", () => {
    expect(() => new DevelopmentSmsToEmailAdapter("test", email)).toThrow(
      /DEVELOPMENT_SMS_EMAIL_FALLBACK_FORBIDDEN/u,
    );
    expect(() => new DevelopmentSmsToEmailAdapter("production", email)).toThrow(
      /DEVELOPMENT_SMS_EMAIL_FALLBACK_FORBIDDEN/u,
    );
  });

  it("rejects incomplete development delivery payloads without sending", async () => {
    const adapter = new DevelopmentSmsToEmailAdapter("development", email);
    await expect(
      adapter.send({
        idempotencyKey: "challenge-1",
        destination: "+201012345678",
        value: "123456",
      }),
    ).rejects.toThrow(/DEVELOPMENT_SMS_EMAIL_DELIVERY_INVALID/u);
  });
});
