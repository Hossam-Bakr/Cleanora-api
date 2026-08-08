
import { preferencesPutBody } from "../../../../src/modules/customers/customers.schema.js";

const complete = {
  version: 1,
  language: null,
  reminders: { sms: false, push: true },
  promotional: { sms: true, push: false },
  mandatory: {
    security: { sms: true, push: true },
    activeService: { sms: true, push: true },
  },
};

describe("DEC-032 complete preference replacement body", () => {
  it("accepts AR, EN, and explicit null language with the full matrix", () => {
    expect(preferencesPutBody.parse(complete).language).toBeNull();
    expect(preferencesPutBody.parse({ ...complete, language: "AR" }).language).toBe("AR");
    expect(preferencesPutBody.parse({ ...complete, language: "EN" }).language).toBe("EN");
  });

  it("rejects omitted choices, unknown categories, and disabled mandatory notices", () => {
    expect(() => preferencesPutBody.parse({ ...complete, reminders: { sms: true } })).toThrow();
    expect(() => preferencesPutBody.parse({ ...complete, marketing: {} })).toThrow();
    expect(() => preferencesPutBody.parse({
      ...complete,
      mandatory: {
        ...complete.mandatory,
        security: { sms: false, push: true },
      },
    })).toThrow();
  });
});
