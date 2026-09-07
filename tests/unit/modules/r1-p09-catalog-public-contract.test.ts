
import {
  createCatalogDefinitionReader,
  createTransactionalCatalogDefinitionReaderFactory,
  type CatalogDefinitionReader,
  type TransactionalCatalogDefinitionReaderFactory,
} from "../../../src/modules/catalog/catalog.public.js";
import {
  buildSelectableCatalogSummary,
  createFakeCatalogDefinitionReader,
  R1_P09_IDS,
} from "../../helpers/r1-p09-provider-services-fixtures.js";

describe("R1-P09 Catalog public contract (T007)", () => {
  it("wraps CatalogDefinitionReader methods through createCatalogDefinitionReader", async () => {
    const summary = buildSelectableCatalogSummary();
    const source = createFakeCatalogDefinitionReader();
    const spies = {
      listSelectable: vi.spyOn(source, "listSelectable"),
      getSnapshotReadyDefinition: vi.spyOn(source, "getSnapshotReadyDefinition"),
      resolveSelectableProviderOffering: vi.spyOn(
        source,
        "resolveSelectableProviderOffering",
      ),
      getProviderOfferingReference: vi.spyOn(
        source,
        "getProviderOfferingReference",
      ),
      getSnapshotReadyDefinitionById: vi.spyOn(
        source,
        "getSnapshotReadyDefinitionById",
      ),
    };

    const reader: CatalogDefinitionReader = createCatalogDefinitionReader(source);

    expect(typeof reader.listSelectable).toBe("function");
    expect(typeof reader.getSnapshotReadyDefinition).toBe("function");
    expect(typeof reader.resolveSelectableProviderOffering).toBe("function");
    expect(typeof reader.getProviderOfferingReference).toBe("function");
    expect(typeof reader.getSnapshotReadyDefinitionById).toBe("function");

    await expect(
      reader.listSelectable({
        countryCode: R1_P09_IDS.countryCode,
        locale: "EN",
      }),
    ).resolves.toEqual({ items: [summary], nextCursor: null });

    await expect(
      reader.resolveSelectableProviderOffering({
        serviceCode: R1_P09_IDS.catalogServiceCode,
        countryCode: R1_P09_IDS.countryCode,
      }),
    ).resolves.toMatchObject({
      serviceId: R1_P09_IDS.catalogServiceId,
      serviceCode: R1_P09_IDS.catalogServiceCode,
      selectableForCountry: true,
    });

    await expect(
      reader.getProviderOfferingReference({
        serviceId: R1_P09_IDS.catalogServiceId,
        countryCode: R1_P09_IDS.countryCode,
      }),
    ).resolves.toMatchObject({
      serviceId: R1_P09_IDS.catalogServiceId,
      selectableForCountry: true,
    });

    await expect(
      reader.getSnapshotReadyDefinition({
        serviceCode: R1_P09_IDS.catalogServiceCode,
        countryCode: R1_P09_IDS.countryCode,
        locale: "AR",
      }),
    ).resolves.toMatchObject({
      serviceCode: R1_P09_IDS.catalogServiceCode,
      locale: "AR",
      countryCode: R1_P09_IDS.countryCode,
    });

    await expect(
      reader.getSnapshotReadyDefinitionById({
        serviceId: R1_P09_IDS.catalogServiceId,
        countryCode: R1_P09_IDS.countryCode,
        locale: "EN",
      }),
    ).resolves.toMatchObject({
      serviceId: R1_P09_IDS.catalogServiceId,
      locale: "EN",
    });

    expect(spies.listSelectable).toHaveBeenCalledOnce();
    expect(spies.resolveSelectableProviderOffering).toHaveBeenCalledOnce();
    expect(spies.getProviderOfferingReference).toHaveBeenCalledOnce();
    expect(spies.getSnapshotReadyDefinition).toHaveBeenCalledOnce();
    expect(spies.getSnapshotReadyDefinitionById).toHaveBeenCalledOnce();
  });

  it("exposes TransactionalCatalogDefinitionReaderFactory and composition helper", () => {
    const boundFactory: TransactionalCatalogDefinitionReaderFactory = (
      transactionContext,
    ) => {
      void transactionContext;
      return createFakeCatalogDefinitionReader();
    };

    expect(typeof boundFactory).toBe("function");

    const wrapped = createTransactionalCatalogDefinitionReaderFactory(boundFactory);
    const reader = wrapped({ opaque: true });
    expect(typeof reader.listSelectable).toBe("function");
    expect(typeof reader.resolveSelectableProviderOffering).toBe("function");
    expect(typeof reader.getProviderOfferingReference).toBe("function");
    expect(typeof reader.getSnapshotReadyDefinition).toBe("function");
    expect(typeof reader.getSnapshotReadyDefinitionById).toBe("function");
  });

  it("keeps Catalog ownership of selectability and does not invent Provider prices", async () => {
    const reader = createCatalogDefinitionReader(
      createFakeCatalogDefinitionReader({ selectable: false }),
    );
    const offering = await reader.resolveSelectableProviderOffering({
      serviceCode: R1_P09_IDS.catalogServiceCode,
      countryCode: R1_P09_IDS.countryCode,
    });
    expect(offering).toMatchObject({ selectableForCountry: false });
    expect(JSON.stringify(offering)).not.toMatch(
      /providerPrice|minimumCharge|ProviderServicePrice/iu,
    );
  });
});
