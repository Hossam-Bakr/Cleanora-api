import type { EmailPort } from "../../../../src/core/email/index.js";
import { SmsToEmailFallbackAdapter } from "../../../../src/integrations/sms/sms-to-email-fallback.adapter.js";

describe("SmsToEmailFallbackAdapter guards", () => {
  const email: EmailPort = {
    async send() {
      return;
    },
  };

  it("rejects incomplete fallback delivery payloads without sending", async () => {
    const adapter = new SmsToEmailFallbackAdapter("hosted-preview", email);
    await expect(
      adapter.send({
        idempotencyKey: "challenge-1",
        destination: "+201012345678",
        value: "123456",
      }),
    ).rejects.toThrow(/SMS_EMAIL_FALLBACK_DELIVERY_INVALID/u);
  });
});
