import { readFileSync } from "node:fs";
import { join } from "node:path";


import {
  createProviderServiceSnapshotReader,
  createProviderServicesReadyFactsReader,
  type ProviderServiceSnapshotReader,
  type ProviderServicesReadyFacts,
  type ProviderServicesReadyFactsReader,
} from "../../../src/modules/providers/providers.public.js";
import { R1_P09_IDS } from "../../helpers/r1-p09-provider-services-fixtures.js";

describe("R1-P09 Providers public contract (T059)", () => {
  it("exposes ProviderServicesReadyFacts through a narrowed factory", async () => {
    const facts: ProviderServicesReadyFacts = {
      providerId: R1_P09_IDS.providerId,
      servicesReady: true,
      qualifyingOfferingCount: 1,
      blockerCodes: [],
    };
    const source: ProviderServicesReadyFactsReader = {
      getServicesReady: vi.fn(async () => facts),
    };
    const reader = createProviderServicesReadyFactsReader(source);
    await expect(reader.getServicesReady(R1_P09_IDS.providerId)).resolves.toEqual(
      facts,
    );
    expect(Object.keys(reader)).toEqual(["getServicesReady"]);
  });

  it("exposes ProviderServiceSnapshotReader through a narrowed factory", async () => {
    const source: ProviderServiceSnapshotReader = {
      getSnapshotReadyFacts: vi.fn(
        async (): Promise<
          Awaited<
            ReturnType<ProviderServiceSnapshotReader["getSnapshotReadyFacts"]>
          >
        > => ({ status: "UNAVAILABLE" }),
      ),
    };
    const reader = createProviderServiceSnapshotReader(source);
    await expect(
      reader.getSnapshotReadyFacts({
        providerId: R1_P09_IDS.providerId,
        catalogServiceCode: R1_P09_IDS.catalogServiceCode,
        countryCode: R1_P09_IDS.countryCode,
        locale: "EN",
      }),
    ).resolves.toEqual({ status: "UNAVAILABLE" });
    expect(Object.keys(reader)).toEqual(["getSnapshotReadyFacts"]);
  });

  it("does not export HTTP adapters or raw repository symbols from providers.public", () => {
    const source = readFileSync(
      join(process.cwd(), "src/modules/providers/providers.public.ts"),
      "utf8",
    );
    expect(source).toContain("ProviderServicesReadyFacts");
    expect(source).toContain("ProviderServiceSnapshotReader");
    expect(source).toContain("createProviderServicesReadyFactsReader");
    expect(source).toContain("createProviderServiceSnapshotReader");
    expect(source).not.toMatch(/Router|controller|PrismaProviderServiceRepository/u);
    expect(source).not.toMatch(/export\s+\{[^}]*Repository/u);
  });

  it("keeps snapshot conflict and unavailable outcomes closed", async () => {
    const reader = createProviderServiceSnapshotReader({
      getSnapshotReadyFacts: async () => ({
        status: "CONFLICT",
        code: "PROVIDER_SERVICE_SNAPSHOT_CONFLICT",
      }),
    });
    await expect(
      reader.getSnapshotReadyFacts({
        providerId: R1_P09_IDS.providerId,
        catalogServiceCode: R1_P09_IDS.catalogServiceCode,
        countryCode: R1_P09_IDS.countryCode,
        locale: "AR",
      }),
    ).resolves.toEqual({
      status: "CONFLICT",
      code: "PROVIDER_SERVICE_SNAPSHOT_CONFLICT",
    });
  });
});
