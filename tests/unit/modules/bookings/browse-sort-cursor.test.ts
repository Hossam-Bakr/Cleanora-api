import {
  browseFilterDigest,
  decodeBrowseCursor,
  encodeBrowseCursor,
} from "#modules/bookings/bookings.cursor";
import {
  compareCanonicalDecimalAsc,
  filterAndSortBrowseCandidates,
} from "#modules/bookings/bookings.sort-filter";

describe("browse cursor", () => {
  it("round-trips a signed cursor", () => {
    const secret = "unit-test-browse-cursor-secret-32chars!!";
    const encoded = encodeBrowseCursor(
      {
        resultHash: "rh",
        filterDigest: "fd",
        offset: 20,
      },
      secret,
    );
    expect(decodeBrowseCursor(encoded, secret)).toEqual({
      resultHash: "rh",
      filterDigest: "fd",
      offset: 20,
    });
  });

  it("rejects tampered cursors", () => {
    const secret = "unit-test-browse-cursor-secret-32chars!!";
    const encoded = encodeBrowseCursor(
      { resultHash: "rh", filterDigest: "fd", offset: 1 },
      secret,
    );
    expect(() => decodeBrowseCursor(`${encoded}x`, secret)).toThrow();
    expect(() => decodeBrowseCursor("not-a-cursor", secret)).toThrow();
    expect(() => decodeBrowseCursor("aaa.bbb", secret)).toThrow();
  });

  it("binds the digest to the complete browse context and filters", () => {
    const base = {
      serviceId: "s1",
      countryId: "c1",
      cityId: "city1",
      startsAt: "2026-09-10T08:00:00.000Z",
      endsAt: "2026-09-10T12:00:00.000Z",
      crewPreference: "any" as const,
      requiredTeamUnits: 1,
      locale: "EN",
    };
    expect(browseFilterDigest(base)).not.toBe(
      browseFilterDigest({ ...base, cityId: "city2" }),
    );
    expect(browseFilterDigest({ ...base, q: " Alpha " })).toBe(
      browseFilterDigest({ ...base, q: "alpha" }),
    );
  });
});

describe("browse sort/filter", () => {
  const baseFacts = {
    priceAmount: "100.00",
    minimumChargeAmount: "50.00",
    currencyCode: "EGP",
    priceUnitId: "u1",
    estimatedDurationMinutes: 60,
    matchingCapacityUnits: 1,
  };

  it("sorts by price then ids", () => {
    const sorted = filterAndSortBrowseCandidates({
      candidates: [
        {
          providerId: "p2",
          teamId: "t1",
          sortingFacts: { ...baseFacts, priceAmount: "90.00" },
          displayName: "B",
          thumb: null,
        },
        {
          providerId: "p1",
          teamId: "t2",
          sortingFacts: { ...baseFacts, priceAmount: "90.00" },
          displayName: "A",
          thumb: null,
        },
        {
          providerId: "p0",
          teamId: "t0",
          sortingFacts: { ...baseFacts, priceAmount: "120.00" },
          displayName: "C",
          thumb: null,
        },
      ],
    });
    expect(sorted.map((row) => `${row.providerId}:${row.teamId}`)).toEqual([
      "p1:t2",
      "p2:t1",
      "p0:t0",
    ]);
  });

  it("applies maxPrice and q after eligibility", () => {
    const sorted = filterAndSortBrowseCandidates({
      candidates: [
        {
          providerId: "p1",
          teamId: "t1",
          sortingFacts: { ...baseFacts, priceAmount: "80.00" },
          displayName: "Alpha Clean",
          thumb: null,
        },
        {
          providerId: "p2",
          teamId: "t1",
          sortingFacts: { ...baseFacts, priceAmount: "150.00" },
          displayName: "Alpha Clean",
          thumb: null,
        },
        {
          providerId: "p3",
          teamId: "t1",
          sortingFacts: { ...baseFacts, priceAmount: "70.00" },
          displayName: "Beta",
          thumb: null,
        },
      ],
      maxPriceAmount: "100.00",
      q: "alpha",
    });
    expect(sorted).toHaveLength(1);
    expect(sorted[0]?.providerId).toBe("p1");
  });

  it("compares canonical decimals without floating drift", () => {
    expect(compareCanonicalDecimalAsc("99.9", "100.0")).toBeLessThan(0);
    expect(compareCanonicalDecimalAsc("100.00", "100.0")).toBe(0);
    expect(compareCanonicalDecimalAsc("-1", "1")).toBeLessThan(0);
    expect(compareCanonicalDecimalAsc("not-a-number", "1")).not.toBe(0);
  });

  it("picks locale display names", async () => {
    const { pickDisplayName } = await import(
      "#modules/bookings/bookings.sort-filter"
    );
    expect(
      pickDisplayName(
        {
          providerId: "p1",
          providerKind: "INDIVIDUAL_TEAM",
          displayNameAr: "عربي",
          displayNameEn: "English",
          descriptionAr: null,
          descriptionEn: null,
          countryCode: "EG",
          logo: null,
          cover: null,
          gallery: [],
        },
        "AR",
      ),
    ).toBe("عربي");
    expect(pickDisplayName(null, "EN")).toBeNull();
  });
});
