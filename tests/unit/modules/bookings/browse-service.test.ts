import { BookingsBrowseService } from "#modules/bookings/bookings.service";
import { browseError } from "#modules/bookings/bookings.errors";
import { CatalogError } from "#modules/catalog/catalog.errors";
import { EligibilityError } from "#modules/eligibility/eligibility.errors";

function sortingFacts(price: string) {
  return {
    priceAmount: price,
    minimumChargeAmount: "0",
    currencyCode: "EGP",
    priceUnitId: "u1",
    estimatedDurationMinutes: 60,
    matchingCapacityUnits: 1,
  };
}

describe("BookingsBrowseService", () => {
  it("lists only eligible candidates and asserts no booking/payment side effects", async () => {
    const getStandardBrowseCandidates = vi.fn().mockResolvedValue({
      candidates: [
        {
          providerId: "p1",
          teamId: "t1",
          sortingFacts: sortingFacts("80.00"),
        },
        {
          providerId: "p2",
          teamId: "t2",
          sortingFacts: sortingFacts("120.00"),
        },
      ],
      metadata: {
        resultHash: "hash-1",
        ruleVersionId: "r1-v1",
        evaluatedAt: "2026-09-10T00:00:00.000Z",
      },
    });
    const service = new BookingsBrowseService({
      eligibility: { getStandardBrowseCandidates },
      catalog: {
        listSelectable: vi.fn(),
        getSnapshotReadyDefinitionById: vi.fn(),
        getSnapshotReadyDefinition: vi.fn(),
        resolveSelectableProviderOffering: vi.fn(),
        getProviderOfferingReference: vi.fn(),
      },
      locality: {
        listActiveCitiesForCountry: vi.fn(),
        listActiveDistrictsForCity: vi.fn(),
      },
      providers: {
        getContactFreePreview: vi.fn(async (providerId: string) => ({
          providerId,
          providerKind: "INDIVIDUAL_TEAM" as const,
          displayNameAr: providerId === "p1" ? "واحد" : "اتنين",
          displayNameEn: providerId === "p1" ? "One" : "Two",
          descriptionAr: null,
          descriptionEn: null,
          countryCode: "EG",
          logo: null,
          cover: null,
          gallery: [],
        })),
        getBookingSafeTeamFacts: vi.fn(),
      },
      activeCountries: {
        resolveActiveCountry: vi.fn(),
        getActiveCountryById: vi.fn(),
      },
      cursorSecret: "unit-test-browse-cursor-secret-32chars!!",
    });

    const page = await service.listEligibleProviders({
      serviceId: "s1",
      countryId: "c1",
      cityId: "city1",
      startsAt: "2026-09-10T08:00:00.000Z",
      endsAt: "2026-09-10T12:00:00.000Z",
      crewPreference: "any",
      requiredTeamUnits: 1,
      locale: "EN",
      maxPriceAmount: "100.00",
      q: "one",
      limit: 20,
    });

    expect(getStandardBrowseCandidates).toHaveBeenCalledTimes(1);
    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.providerId).toBe("p1");
    expect(page.sideEffects).toEqual({
      bookingCreated: false,
      paymentInitiated: false,
    });
    await expect(
      service.getProviderPreview("p1"),
    ).resolves.toMatchObject({ providerId: "p1" });
  });

  it("fails closed for ineligible detail targets", async () => {
    const service = new BookingsBrowseService({
      eligibility: {
        getStandardBrowseCandidates: vi.fn().mockResolvedValue({
          candidates: [
            {
              providerId: "p1",
              teamId: "t1",
              sortingFacts: sortingFacts("80.00"),
            },
          ],
          metadata: {
            resultHash: "hash-1",
            ruleVersionId: "r1-v1",
            evaluatedAt: "2026-09-10T00:00:00.000Z",
          },
        }),
      },
      catalog: {
        listSelectable: vi.fn(),
        getSnapshotReadyDefinitionById: vi.fn(),
        getSnapshotReadyDefinition: vi.fn(),
        resolveSelectableProviderOffering: vi.fn(),
        getProviderOfferingReference: vi.fn(),
      },
      locality: {
        listActiveCitiesForCountry: vi.fn(),
        listActiveDistrictsForCity: vi.fn(),
      },
      providers: {
        getContactFreePreview: vi.fn(),
        getBookingSafeTeamFacts: vi.fn(),
      },
      activeCountries: {
        resolveActiveCountry: vi.fn(),
        getActiveCountryById: vi.fn(),
      },
      cursorSecret: "unit-test-browse-cursor-secret-32chars!!",
    });

    await expect(
      service.getEligibleProviderDetail({
        providerId: "missing",
        teamId: "missing",
        query: {
          serviceId: "s1",
          countryId: "c1",
          cityId: "city1",
          startsAt: "2026-09-10T08:00:00.000Z",
          endsAt: "2026-09-10T12:00:00.000Z",
          crewPreference: "any",
          requiredTeamUnits: 1,
          locale: "EN",
        },
      }),
    ).rejects.toMatchObject(browseError("BROWSE_PROVIDER_NOT_FOUND"));
  });

  it("returns detail for an eligible candidate without booking side effects", async () => {
    const service = new BookingsBrowseService({
      eligibility: {
        getStandardBrowseCandidates: vi.fn().mockResolvedValue({
          candidates: [
            {
              providerId: "p1",
              teamId: "t1",
              sortingFacts: sortingFacts("80.00"),
            },
          ],
          metadata: {
            resultHash: "hash-1",
            ruleVersionId: "r1-v1",
            evaluatedAt: "2026-09-10T00:00:00.000Z",
          },
        }),
      },
      catalog: {
        listSelectable: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
        getSnapshotReadyDefinitionById: vi.fn().mockResolvedValue({
          serviceId: "s1",
          serviceCode: "SVC",
        }),
        getSnapshotReadyDefinition: vi.fn(),
        resolveSelectableProviderOffering: vi.fn(),
        getProviderOfferingReference: vi.fn(),
      },
      locality: {
        listActiveCitiesForCountry: vi.fn().mockResolvedValue([
          { cityId: "city1", code: "CAI", nameAr: "ق", nameEn: "Cairo" },
        ]),
        listActiveDistrictsForCity: vi.fn().mockResolvedValue([]),
      },
      providers: {
        getContactFreePreview: vi.fn(async () => ({
          providerId: "p1",
          providerKind: "INDIVIDUAL_TEAM" as const,
          displayNameAr: "واحد",
          displayNameEn: "One",
          descriptionAr: null,
          descriptionEn: null,
          countryCode: "EG",
          logo: null,
          cover: null,
          gallery: [],
        })),
        getBookingSafeTeamFacts: vi.fn(async () => ({
          providerId: "p1",
          teamId: "t1",
          teamVersion: 1,
          active: true,
          members: [
            {
              workerId: "w-should-not-leak",
              gender: "female" as const,
              workerType: "CLEANING_STAFF" as const,
              cleans: true,
            },
          ],
        })),
      },
      activeCountries: {
        resolveActiveCountry: vi.fn().mockResolvedValue({ id: "c1", code: "EG" }),
        getActiveCountryById: vi.fn().mockResolvedValue({ id: "c1", code: "EG" }),
      },
      cursorSecret: "unit-test-browse-cursor-secret-32chars!!",
    });

    const cities = await service.listCities("EG");
    expect(cities).toHaveLength(1);
    const detail = await service.getEligibleProviderDetail({
      providerId: "p1",
      teamId: "t1",
      query: {
        serviceId: "s1",
        countryId: "c1",
        cityId: "city1",
        startsAt: "2026-09-10T08:00:00.000Z",
        endsAt: "2026-09-10T12:00:00.000Z",
        crewPreference: "any",
        requiredTeamUnits: 1,
        locale: "EN",
      },
    });
    expect(detail.sideEffects).toEqual({
      bookingCreated: false,
      paymentInitiated: false,
    });
    expect(detail.crewSummary.cleanerCount).toBe(1);
    expect(JSON.stringify(detail)).not.toContain("w-should-not-leak");
  });

  it("paginates with a fingerprint-bound cursor and lists catalog/locality helpers", async () => {
    const candidates = Array.from({ length: 3 }, (_, index) => ({
      providerId: `p${index}`,
      teamId: `t${index}`,
      sortingFacts: sortingFacts(`${70 + index}.00`),
    }));
    const getStandardBrowseCandidates = vi
      .fn()
      .mockResolvedValueOnce({
        candidates,
        metadata: {
          resultHash: "hash-page",
          ruleVersionId: "r1-v1",
          evaluatedAt: "2026-09-10T00:00:00.000Z",
        },
      })
      .mockResolvedValue({
        candidates,
        metadata: {
          resultHash: "hash-page-changed-with-evaluated-at",
          ruleVersionId: "r1-v1",
          evaluatedAt: "2026-09-10T00:00:00.001Z",
        },
      });
    const service = new BookingsBrowseService({
      eligibility: {
        getStandardBrowseCandidates,
      },
      catalog: {
        listSelectable: vi.fn().mockResolvedValue({
          items: [{ serviceId: "s1" }],
          nextCursor: null,
        }),
        getSnapshotReadyDefinitionById: vi.fn().mockResolvedValue({
          serviceId: "s1",
          serviceCode: "SVC",
        }),
        getSnapshotReadyDefinition: vi.fn(),
        resolveSelectableProviderOffering: vi.fn(),
        getProviderOfferingReference: vi.fn(),
      },
      locality: {
        listActiveCitiesForCountry: vi.fn().mockResolvedValue([]),
        listActiveDistrictsForCity: vi.fn().mockResolvedValue([
          {
            districtId: "d1",
            cityId: "city1",
            code: "D1",
            nameAr: "د",
            nameEn: "D",
          },
        ]),
      },
      providers: {
        getContactFreePreview: vi.fn(async (providerId: string) => ({
          providerId,
          providerKind: "INDIVIDUAL_TEAM" as const,
          displayNameAr: providerId,
          displayNameEn: providerId,
          descriptionAr: null,
          descriptionEn: null,
          countryCode: "EG",
          logo: null,
          cover: null,
          gallery: [],
        })),
        getBookingSafeTeamFacts: vi.fn(),
      },
      activeCountries: {
        resolveActiveCountry: vi.fn().mockResolvedValue({ id: "c1", code: "EG" }),
        getActiveCountryById: vi.fn(),
      },
      cursorSecret: "unit-test-browse-cursor-secret-32chars!!",
    });

    expect(
      (
        await service.listServices({
          countryCode: "EG",
          locale: "AR",
          limit: 20,
        })
      ).items,
    ).toHaveLength(1);
    expect(
      await service.getService({
        serviceId: "s1",
        countryCode: "EG",
        locale: "AR",
      }),
    ).toMatchObject({ serviceCode: "SVC" });
    expect(
      await service.listDistricts({ countryCode: "EG", cityId: "city1" }),
    ).toHaveLength(1);

    const page1 = await service.listEligibleProviders({
      serviceId: "s1",
      countryId: "c1",
      cityId: "city1",
      startsAt: "2026-09-10T08:00:00.000Z",
      endsAt: "2026-09-10T12:00:00.000Z",
      crewPreference: "any",
      requiredTeamUnits: 1,
      locale: "EN",
      limit: 2,
    });
    expect(page1.items).toHaveLength(2);
    expect(page1.nextCursor).not.toBeNull();
    await expect(
      service.listEligibleProviders({
        serviceId: "s1",
        countryId: "c1",
        cityId: "city1",
        startsAt: "2026-09-10T08:00:00.000Z",
        endsAt: "2026-09-10T12:00:00.000Z",
        crewPreference: "any",
        requiredTeamUnits: 1,
        locale: "EN",
        q: "changed-filter",
        limit: 2,
        cursor: page1.nextCursor!,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    const page2 = await service.listEligibleProviders({
      serviceId: "s1",
      countryId: "c1",
      cityId: "city1",
      startsAt: "2026-09-10T08:00:00.000Z",
      endsAt: "2026-09-10T12:00:00.000Z",
      crewPreference: "any",
      requiredTeamUnits: 1,
      locale: "EN",
      limit: 2,
      cursor: page1.nextCursor!,
    });
    expect(page2.items).toHaveLength(1);
    expect(page2.nextCursor).toBeNull();
    expect(getStandardBrowseCandidates).toHaveBeenCalledTimes(1);
    const replayedPage2 = await service.listEligibleProviders({
      serviceId: "s1",
      countryId: "c1",
      cityId: "city1",
      startsAt: "2026-09-10T08:00:00.000Z",
      endsAt: "2026-09-10T12:00:00.000Z",
      crewPreference: "any",
      requiredTeamUnits: 1,
      locale: "EN",
      limit: 2,
      cursor: page1.nextCursor!,
    });
    expect(replayedPage2.items).toEqual(page2.items);
    expect(replayedPage2.nextCursor).toBeNull();
    expect(getStandardBrowseCandidates).toHaveBeenCalledTimes(1);
  });

  it("maps eligibility failures and missing services safely", async () => {
    const failing = new BookingsBrowseService({
      eligibility: {
        getStandardBrowseCandidates: vi
          .fn()
          .mockRejectedValueOnce(new EligibilityError("VALIDATION_FAILED"))
          .mockRejectedValueOnce(new EligibilityError("UNSUPPORTED_GEO_INPUT"))
          .mockRejectedValueOnce(new Error("dependency detail must stay private")),
      },
      catalog: {
        listSelectable: vi.fn(),
        getSnapshotReadyDefinitionById: vi.fn().mockResolvedValue(null),
        getSnapshotReadyDefinition: vi.fn(),
        resolveSelectableProviderOffering: vi.fn(),
        getProviderOfferingReference: vi.fn(),
      },
      locality: {
        listActiveCitiesForCountry: vi.fn(),
        listActiveDistrictsForCity: vi.fn(),
      },
      providers: {
        getContactFreePreview: vi.fn(),
        getBookingSafeTeamFacts: vi.fn(),
      },
      activeCountries: {
        resolveActiveCountry: vi.fn(),
        getActiveCountryById: vi.fn(),
      },
      cursorSecret: "unit-test-browse-cursor-secret-32chars!!",
    });

    await expect(
      failing.listEligibleProviders({
        serviceId: "s1",
        countryId: "c1",
        cityId: "city1",
        startsAt: "2026-09-10T08:00:00.000Z",
        endsAt: "2026-09-10T12:00:00.000Z",
        crewPreference: "any",
        requiredTeamUnits: 1,
        locale: "EN",
        limit: 20,
      }),
    ).rejects.toMatchObject(browseError("VALIDATION_FAILED"));

    const commonQuery = {
      serviceId: "s1",
      countryId: "c1",
      cityId: "city1",
      startsAt: "2026-09-10T08:00:00.000Z",
      endsAt: "2026-09-10T12:00:00.000Z",
      crewPreference: "any" as const,
      requiredTeamUnits: 1,
      locale: "EN" as const,
      limit: 20,
    };
    await expect(failing.listEligibleProviders(commonQuery)).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
    });
    await expect(failing.listEligibleProviders(commonQuery)).rejects.toMatchObject({
      code: "BROWSE_EVALUATION_FAILED",
    });

    await expect(
      failing.getService({
        serviceId: "missing",
        countryCode: "EG",
        locale: "AR",
      }),
    ).rejects.toMatchObject(browseError("BROWSE_SERVICE_NOT_FOUND"));
  });

  it("uses Provider service snapshots and fails closed when current price facts disappear", async () => {
    const getSnapshotReadyFacts = vi
      .fn()
      .mockResolvedValueOnce({
        status: "AVAILABLE",
        value: {
          price: "81.00",
          minimumCharge: "40.00",
          currencyCode: "EGP",
          priceUnit: { id: "unit-hour" },
          estimatedDurationMinutes: 75,
        },
      })
      .mockResolvedValueOnce({ status: "UNAVAILABLE" });
    const catalogDefinition = vi.fn().mockResolvedValue({
      serviceId: "s1",
      serviceCode: "HOME_CLEANING",
    });
    const getActiveCountryById = vi
      .fn()
      .mockResolvedValueOnce({ id: "c1", code: "EG" })
      .mockResolvedValueOnce({ id: "c1", code: "EG" })
      .mockResolvedValueOnce(null);
    const service = new BookingsBrowseService({
      eligibility: {
        getStandardBrowseCandidates: vi.fn().mockResolvedValue({
          candidates: [
            { providerId: "p1", teamId: "t1", sortingFacts: sortingFacts("80.00") },
          ],
          metadata: {
            resultHash: "detail-hash",
            ruleVersionId: "r1-v1",
            evaluatedAt: "2026-09-10T00:00:00.000Z",
          },
        }),
      },
      catalog: {
        listSelectable: vi.fn(),
        getSnapshotReadyDefinitionById: catalogDefinition,
      } as never,
      locality: {
        listActiveCitiesForCountry: vi.fn(),
        listActiveDistrictsForCity: vi.fn(),
      },
      providers: {
        getContactFreePreview: vi.fn().mockResolvedValue({
          providerId: "p1",
          providerKind: "INDIVIDUAL_TEAM",
          displayNameAr: "واحد",
          displayNameEn: "One",
          descriptionAr: null,
          descriptionEn: null,
          countryCode: "EG",
          logo: null,
          cover: null,
          gallery: [],
        }),
        getBookingSafeTeamFacts: vi.fn().mockResolvedValue({
          providerId: "p1",
          teamId: "t1",
          teamVersion: 1,
          active: true,
          members: [],
        }),
      },
      serviceSnapshots: { getSnapshotReadyFacts } as never,
      activeCountries: {
        resolveActiveCountry: vi.fn(),
        getActiveCountryById,
      },
      cursorSecret: "unit-test-browse-cursor-secret-32chars!!",
    });
    const input = {
      providerId: "p1",
      teamId: "t1",
      query: {
        serviceId: "s1",
        countryId: "c1",
        cityId: "city1",
        startsAt: "2026-09-10T08:00:00.000Z",
        endsAt: "2026-09-10T12:00:00.000Z",
        crewPreference: "any" as const,
        requiredTeamUnits: 1,
        locale: "EN" as const,
      },
    };
    await expect(service.getEligibleProviderDetail(input)).resolves.toMatchObject({
      servicePrice: { status: "AVAILABLE", priceAmount: "81.00" },
    });
    await expect(service.getEligibleProviderDetail(input)).resolves.toMatchObject({
      servicePrice: { status: "UNAVAILABLE" },
    });
    await expect(service.getEligibleProviderDetail(input)).rejects.toMatchObject(
      browseError("COUNTRY_UNAVAILABLE"),
    );
  });

  it("maps Catalog and Configuration boundary failures to stable Browse errors", async () => {
    const service = new BookingsBrowseService({
      eligibility: { getStandardBrowseCandidates: vi.fn() },
      catalog: {
        listSelectable: vi
          .fn()
          .mockRejectedValue(
            new CatalogError(
              "CATALOG_COUNTRY_UNAVAILABLE",
              "Catalog country unavailable",
            ),
          ),
        getSnapshotReadyDefinitionById: vi
          .fn()
          .mockRejectedValue(
            new CatalogError("CATALOG_VALIDATION_FAILED", "Bad cursor"),
          ),
      } as never,
      locality: {
        listActiveCitiesForCountry: vi.fn(),
        listActiveDistrictsForCity: vi.fn(),
      },
      providers: {
        getContactFreePreview: vi.fn(),
        getBookingSafeTeamFacts: vi.fn(),
      },
      activeCountries: {
        resolveActiveCountry: vi.fn().mockRejectedValue(
          Object.assign(new Error("Configuration detail"), {
            code: "COUNTRY_UNAVAILABLE",
          }),
        ),
        getActiveCountryById: vi.fn(),
      },
      cursorSecret: "unit-test-browse-cursor-secret-32chars!!",
    });

    await expect(
      service.listServices({ countryCode: "ZZ", locale: "EN", limit: 20 }),
    ).rejects.toMatchObject({ code: "COUNTRY_UNAVAILABLE", statusCode: 404 });
    await expect(
      service.getService({ serviceId: "s1", countryCode: "EG", locale: "EN" }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED", statusCode: 400 });
    await expect(service.listCities("ZZ")).rejects.toMatchObject({
      code: "COUNTRY_UNAVAILABLE",
      statusCode: 404,
    });
  });
});
