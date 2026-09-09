import * as localityRepositoryModule from "../../../src/modules/configuration/infrastructure/prisma-locality.repository.js";
import {
  createCountryTimeZoneReader,
  createLocalityReader,
} from "../../../src/modules/configuration/configuration.public.js";
import type { LocalityRepository } from "../../../src/modules/configuration/infrastructure/prisma-locality.repository.js";

function fakeRepository(
  overrides: Partial<LocalityRepository> = {},
): LocalityRepository {
  return {
    async findCountryById() {
      return { id: "country-1", code: "EG", isActive: true };
    },
    async findCityById(cityId: string) {
      return {
        id: cityId,
        countryId: "country-1",
        code: "CAI",
        nameAr: "Cairo AR",
        nameEn: "Cairo",
        isActive: true,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    },
    async findDistrictById(districtId: string) {
      return {
        id: districtId,
        cityId: "city-1",
        code: "MAADI",
        nameAr: "Maadi AR",
        nameEn: "Maadi",
        isActive: true,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    },
    async listDistrictsByCity() {
      return [];
    },
    async findCountryTimeZone() {
      return null;
    },
    ...overrides,
  } as LocalityRepository;
}

describe("configuration public locality reader ancestry facts", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("adds country activity to city facts without renaming the id field", async () => {
    vi.spyOn(
      localityRepositoryModule,
      "createPrismaLocalityRepository",
    ).mockReturnValue(
      fakeRepository({
        async findCountryById() {
          return null;
        },
      }),
    );

    await expect(createLocalityReader().findCityById("city-1")).resolves.toEqual({
      id: "city-1",
      countryId: "country-1",
      isActive: true,
      countryActive: false,
    });
  });

  it("adds city and country activity to district facts", async () => {
    vi.spyOn(
      localityRepositoryModule,
      "createPrismaLocalityRepository",
    ).mockReturnValue(
      fakeRepository({
        async findCityById(cityId: string) {
          return {
            id: cityId,
            countryId: "country-1",
            code: "CAI",
            nameAr: "Cairo AR",
            nameEn: "Cairo",
            isActive: false,
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
        },
        async findCountryById() {
          return { id: "country-1", code: "EG", isActive: false };
        },
      }),
    );

    await expect(
      createLocalityReader().findDistrictById("district-1"),
    ).resolves.toEqual({
      id: "district-1",
      cityId: "city-1",
      countryId: "country-1",
      isActive: true,
      cityActive: false,
      countryActive: false,
    });
  });

  it("does not publish an unrecognized stored country time zone", async () => {
    vi.spyOn(
      localityRepositoryModule,
      "createPrismaLocalityRepository",
    ).mockReturnValue(
      fakeRepository({
        async findCountryTimeZone() {
          return {
            countryId: "country-1",
            timeZone: "Mars/Olympus",
            version: 1,
          };
        },
      }),
    );

    await expect(
      createCountryTimeZoneReader().getTimeZoneForCountry("country-1"),
    ).resolves.toBeNull();
  });
});
