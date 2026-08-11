import {
  assertContactChannelsValid,
  normalizeContactChannels,
  normalizeOperationalEmail,
  normalizeOperationalPhone,
  normalizeProfileText,
  profileFieldsSatisfyCompletion,
} from "../../../../src/modules/providers/domain/provider-profile.policy.js";
import {
  canEditProviderProfileOrContacts,
  canReadPrivateContacts,
} from "../../../../src/modules/providers/domain/provider-authorization.policy.js";

describe("US3 provider profile/contact policy (T041)", () => {
  it("trims profile text and treats blank Arabic as incomplete for submission", () => {
    expect(normalizeProfileText("  فريق نظافة  ")).toBe("فريق نظافة");
    expect(normalizeProfileText("   ")).toBe(null);
    expect(normalizeProfileText(null)).toBe(null);

    expect(
      profileFieldsSatisfyCompletion({
        displayNameAr: "  ",
        descriptionAr: "وصف",
        countryId: "country-1",
      }),
    ).toBe(false);

    expect(
      profileFieldsSatisfyCompletion({
        displayNameAr: "اسم",
        descriptionAr: "وصف",
        countryId: "country-1",
      }),
    ).toBe(true);

    expect(
      profileFieldsSatisfyCompletion({
        displayNameAr: "اسم",
        descriptionAr: "وصف",
        countryId: null,
      }),
    ).toBe(false);
  });

  it("normalizes operational email/phone without leaking raw values in errors", () => {
    expect(normalizeOperationalEmail("  Ops@Example.COM ")).toBe(
      "ops@example.com",
    );
    expect(normalizeOperationalPhone("+20 100 000 0000")).toBe("+201000000000");

    try {
      normalizeOperationalEmail("not-an-email");
      expect.unreachable("expected validation failure");
    } catch (error) {
      expect(error).toMatchObject({ code: "VALIDATION_ERROR" });
      expect(JSON.stringify(error)).not.toMatch(/not-an-email/i);
    }

    try {
      normalizeOperationalPhone("01000000000");
      expect.unreachable("expected validation failure");
    } catch (error) {
      expect(error).toMatchObject({ code: "VALIDATION_ERROR" });
      expect(JSON.stringify(error)).not.toMatch(/01000000000/);
    }
  });

  it("enforces closed channel set, max 20, and uniqueness cardinality", () => {
    const normalized = normalizeContactChannels([
      { type: "WHATSAPP", value: "+20 100 000 0001" },
      { type: "WEBSITE", value: "https://Example.COM/Path/" },
      { type: "EXTERNAL_BOOKING", value: "https://book.example.com" },
      { type: "SOCIAL", value: "https://instagram.com/a" },
      { type: "SOCIAL", value: "https://facebook.com/b" },
    ]);

    expect(normalized).toEqual([
      { type: "WHATSAPP", value: "+201000000001" },
      { type: "WEBSITE", value: "https://example.com/Path" },
      { type: "EXTERNAL_BOOKING", value: "https://book.example.com" },
      { type: "SOCIAL", value: "https://instagram.com/a" },
      { type: "SOCIAL", value: "https://facebook.com/b" },
    ]);

    expect(() =>
      assertContactChannelsValid([
        { type: "WHATSAPP", value: "+201000000001" },
        { type: "WHATSAPP", value: "+201000000002" },
      ]),
    ).toThrow();

    expect(() =>
      normalizeContactChannels([
        { type: "SOCIAL", value: "https://instagram.com/a" },
        { type: "SOCIAL", value: "https://instagram.com/a/" },
      ]),
    ).toThrow();

    expect(() =>
      normalizeContactChannels([
        { type: "WEBSITE", value: "http://insecure.example.com" },
      ]),
    ).toThrow();

    expect(() =>
      assertContactChannelsValid(
        Array.from({ length: 21 }, (_, index) => ({
          type: "SOCIAL" as const,
          value: `https://social.example.com/u${index}`,
        })),
      ),
    ).toThrow();
  });

  it("allows Application Owner edits only while DRAFT/CHANGES_REQUESTED and locks PENDING_REVIEW", () => {
    const ownerDraft = {
      actorUserId: "user-1",
      actorActive: true,
      applicationOwnerUserId: "user-1",
      membership: null,
      staffAdmin: false,
      providerAdminEnabled: false,
      applicationStatus: "DRAFT" as const,
      operationalStatus: "INACTIVE" as const,
    };
    expect(canEditProviderProfileOrContacts(ownerDraft)).toBe(true);
    expect(canReadPrivateContacts(ownerDraft)).toBe(true);

    expect(
      canEditProviderProfileOrContacts({
        ...ownerDraft,
        applicationStatus: "CHANGES_REQUESTED",
      }),
    ).toBe(true);

    expect(
      canEditProviderProfileOrContacts({
        ...ownerDraft,
        applicationStatus: "PENDING_REVIEW",
      }),
    ).toBe(false);

    expect(
      canEditProviderProfileOrContacts({
        ...ownerDraft,
        applicationStatus: "APPROVED",
      }),
    ).toBe(false);

    const approvedOwner = {
      actorUserId: "user-1",
      actorActive: true,
      applicationOwnerUserId: "user-1",
      membership: { level: "OWNER" as const, status: "ACTIVE" as const },
      staffAdmin: false,
      providerAdminEnabled: true,
      applicationStatus: "APPROVED" as const,
      operationalStatus: "INACTIVE" as const,
    };
    expect(canEditProviderProfileOrContacts(approvedOwner)).toBe(true);
    expect(canReadPrivateContacts(approvedOwner)).toBe(true);

    const stranger = {
      ...approvedOwner,
      actorUserId: "other",
      membership: null,
      providerAdminEnabled: false,
    };
    expect(canEditProviderProfileOrContacts(stranger)).toBe(false);
    expect(canReadPrivateContacts(stranger)).toBe(false);
  });
});
