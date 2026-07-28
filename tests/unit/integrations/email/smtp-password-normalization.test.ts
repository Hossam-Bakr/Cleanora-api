import { normalizeSmtpPassword } from "../../../../src/integrations/email/nodemailer.adapter.js";

describe("SMTP password normalization", () => {
  it("removes Gmail app-password display spaces only for a 16-character value", () => {
    expect(
      normalizeSmtpPassword("smtp.gmail.com", "abcd efgh ijkl mnop"),
    ).toBe("abcdefghijklmnop");
  });

  it("does not rewrite arbitrary SMTP credentials", () => {
    expect(
      normalizeSmtpPassword("smtp.example.test", "abcd efgh ijkl mnop"),
    ).toBe("abcd efgh ijkl mnop");
    expect(normalizeSmtpPassword("smtp.gmail.com", "short value")).toBe(
      "short value",
    );
  });
});
