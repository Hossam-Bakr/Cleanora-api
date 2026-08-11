import {
  assertContactChannelsValid,
  normalizeContactChannels,
  normalizeOperationalEmail,
  normalizeOperationalPhone,
  normalizeProfileText,
  profileFieldsSatisfyCompletion,
} from "../../../../src/modules/providers/domain/provider-profile.policy.js";
import { AppError } from "../../../../src/shared/errors/app-error.js";

describe("provider profile/contact policy branch coverage (T156)", () => {
  it("normalizes and rejects profile text / operational contact fields", () => {
    expect(normalizeProfileText(undefined)).toBeNull();
    expect(normalizeProfileText(null)).toBeNull();
    expect(normalizeProfileText("  ")).toBeNull();
    expect(normalizeProfileText("  Name  ")).toBe("Name");

    expect(
      profileFieldsSatisfyCompletion({
        displayNameAr: "اسم",
        descriptionAr: "وصف",
        countryId: "eg",
      }),
    ).toBe(true);
    expect(
      profileFieldsSatisfyCompletion({
        displayNameAr: " ",
        descriptionAr: "وصف",
        countryId: "eg",
      }),
    ).toBe(false);

    expect(normalizeOperationalEmail("  Ops@Example.COM ")).toBe(
      "ops@example.com",
    );
    expect(() => normalizeOperationalEmail("")).toThrow(AppError);
    expect(() => normalizeOperationalEmail("not-an-email")).toThrow(AppError);
    expect(() =>
      normalizeOperationalEmail(`${"a".repeat(320)}@example.com`),
    ).toThrow(AppError);

    expect(normalizeOperationalPhone("+20 (101) 234-5678")).toBe(
      "+201012345678",
    );
    expect(() => normalizeOperationalPhone("01012345678")).toThrow(AppError);
  });

  it("normalizes HTTPS channels and rejects insecure or credentialed URLs", () => {
    expect(
      normalizeContactChannels([
        { type: "WEBSITE", value: "https://Example.com/path/" },
        { type: "SOCIAL", value: "https://social.example/u/1" },
        { type: "EXTERNAL_BOOKING", value: "https://book.example/" },
        { type: "WHATSAPP", value: "+201012345678" },
      ]),
    ).toEqual([
      { type: "WEBSITE", value: "https://example.com/path" },
      { type: "SOCIAL", value: "https://social.example/u/1" },
      { type: "EXTERNAL_BOOKING", value: "https://book.example" },
      { type: "WHATSAPP", value: "+201012345678" },
    ]);

    expect(() =>
      normalizeContactChannels([{ type: "WEBSITE", value: "http://insecure" }]),
    ).toThrow(AppError);
    expect(() =>
      normalizeContactChannels([
        { type: "WEBSITE", value: "https://user:pass@example.com" },
      ]),
    ).toThrow(AppError);
    expect(() =>
      normalizeContactChannels([{ type: "WEBSITE", value: "not-a-url" }]),
    ).toThrow(AppError);
  });

  it("enforces channel cardinality and uniqueness rules", () => {
    expect(() =>
      normalizeContactChannels(
        Array.from({ length: 21 }, (_, i) => ({
          type: "SOCIAL" as const,
          value: `https://social.example/${i}`,
        })),
      ),
    ).toThrow(AppError);

    expect(() =>
      assertContactChannelsValid([
        { type: "WHATSAPP", value: "+201011111111" },
        { type: "WHATSAPP", value: "+201022222222" },
      ]),
    ).toThrow(AppError);
    expect(() =>
      assertContactChannelsValid([
        { type: "WHATSAPP", value: "not-e164" },
      ]),
    ).toThrow(AppError);
    expect(() =>
      assertContactChannelsValid([
        { type: "WEBSITE", value: "https://a.example" },
        { type: "WEBSITE", value: "https://b.example" },
      ]),
    ).toThrow(AppError);
    expect(() =>
      assertContactChannelsValid([
        { type: "EXTERNAL_BOOKING", value: "https://a.example" },
        { type: "EXTERNAL_BOOKING", value: "https://b.example" },
      ]),
    ).toThrow(AppError);
    expect(() =>
      assertContactChannelsValid([
        { type: "SOCIAL", value: "https://social.example/a" },
        { type: "SOCIAL", value: "https://social.example/a" },
      ]),
    ).toThrow(AppError);
  });
});
