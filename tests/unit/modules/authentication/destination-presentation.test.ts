import {
  formatDeliveryExpiry,
  maskEmailDestination,
  maskPhoneDestination,
} from "../../../../src/modules/authentication/domain/auth.policy.js";

describe("destination presentation", () => {
  it("masks phones and emails without revealing full destinations", () => {
    expect(maskPhoneDestination("+201012345678")).toBe("+20******5678");
    expect(maskEmailDestination("person@example.test")).toBe("pe***@***.test");
    expect(formatDeliveryExpiry(new Date("2026-07-26T12:00:00.000Z"))).toBe(
      "2026-07-26T12:00:00.000Z (UTC)",
    );
  });

  it("masks short phones and degenerate emails without leaking the full value", () => {
    expect(maskPhoneDestination("+2012")).toBe("***12");
    expect(maskPhoneDestination("+20123")).toBe("***23");
    expect(maskPhoneDestination("+2012345")).toBe("+20****2345");
    expect(maskEmailDestination("a@b")).toBe("a*@***");
    expect(maskEmailDestination("ab@nodot")).toBe("a*@***");
    expect(maskEmailDestination("@missing-local.test")).toBe("***");
    expect(maskEmailDestination("x@example.test")).toBe("x*@***.test");
    expect(maskEmailDestination("longlocal@example.test")).toBe(
      "lo***@***.test",
    );
  });
});
