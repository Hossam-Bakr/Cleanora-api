import { readFileSync } from "node:fs";
import { join } from "node:path";


import {
  CATALOG_SERVICE_IMAGE,
  MEDIA_OWNER_TYPES,
} from "../../../src/modules/media/media.public.js";
import * as catalogPublic from "../../../src/modules/catalog/catalog.public.js";
import type {
  CatalogDefinitionReader,
  CatalogFieldDefinition,
  CatalogMediaReference,
  CatalogPriceUnitDefinition,
  SelectableCatalogServiceSummary,
  SnapshotReadyCatalogServiceDefinition,
} from "../../../src/modules/catalog/catalog.public.js";

const catalogPublicSource = readFileSync(
  join(process.cwd(), "src", "modules", "catalog", "catalog.public.ts"),
  "utf8",
);

/**
 * T119 — compile/shape/hygiene assertions for the module-public
 * CatalogDefinitionReader and snapshot-ready DTOs (FR-042–FR-045).
 */
describe("R1-P08 public contracts", () => {
  it("exposes CATALOG_SERVICE_IMAGE on the Media owner-type catalog", () => {
    expect(MEDIA_OWNER_TYPES).toContain("CATALOG_SERVICE_IMAGE");
    expect(CATALOG_SERVICE_IMAGE).toBe("CATALOG_SERVICE_IMAGE");
  });

  it("defines CatalogDefinitionReader without HTTP Browse surface", () => {
    const reader: CatalogDefinitionReader = {
      async listSelectable() {
        return { items: [], nextCursor: null };
      },
      async getSnapshotReadyDefinition() {
        return null;
      },
    };
    expect(typeof reader.listSelectable).toBe("function");
    expect(typeof reader.getSnapshotReadyDefinition).toBe("function");
  });

  it("exports a narrow createCatalogDefinitionReader factory for composition", () => {
    expect("createCatalogDefinitionReader" in catalogPublic).toBe(true);
    expect(
      typeof (catalogPublic as Record<string, unknown>)[
        "createCatalogDefinitionReader"
      ],
    ).toBe("function");
  });

  it("keeps snapshot DTOs free of signed URLs and customer answers", () => {
    const sample: SnapshotReadyCatalogServiceDefinition = {
      serviceId: "svc",
      serviceCode: "STANDARD_HOME_CLEANING",
      serviceVersion: 1,
      category: {
        id: "cat",
        code: "HOME_CLEANING",
        name: "Home Cleaning",
        description: "Cleaning services for homes.",
      },
      locale: "EN",
      countryCode: "EG",
      name: "Standard Home Cleaning",
      description: "Routine cleaning for a home.",
      priceUnits: [
        {
          id: "unit_1",
          code: "PER_VISIT",
          label: "Per visit",
          displayOrder: 0,
        },
      ],
      fields: [],
      media: [],
    };
    expect(JSON.stringify(sample)).not.toMatch(/signed|answer|storageKey/iu);
  });

  it("shapes SnapshotReadyCatalogServiceDefinition with fields, options, decimal-string rules, and Media refs", () => {
    const numberField: CatalogFieldDefinition = {
      id: "field_rooms",
      code: "BEDROOM_COUNT",
      kind: "NUMBER",
      label: "Number of bedrooms",
      helpText: null,
      required: false,
      textBounds: null,
      numberRules: {
        mode: "DECIMAL",
        min: "0.00",
        max: "99.50",
      },
      selectionBounds: null,
      options: [],
      displayOrder: 1,
    };
    const selectField: CatalogFieldDefinition = {
      id: "field_pets",
      code: "HAS_PETS",
      kind: "SINGLE_SELECT",
      label: "Pets present?",
      helpText: "Tell us if pets will be home.",
      required: true,
      textBounds: null,
      numberRules: null,
      selectionBounds: { min: 1, max: 1 },
      options: [
        {
          id: "opt_yes",
          value: "YES",
          label: "Yes",
          displayOrder: 0,
        },
        {
          id: "opt_no",
          value: "NO",
          label: "No",
          displayOrder: 1,
        },
      ],
      displayOrder: 2,
    };
    const priceUnit: CatalogPriceUnitDefinition = {
      id: "unit_1",
      code: "PER_VISIT",
      label: "Per visit",
      displayOrder: 0,
    };
    const media: CatalogMediaReference = {
      associationId: "assoc_1",
      mediaId: "media_1",
      contentType: "image/webp",
      width: 640,
      height: 480,
      displayOrder: 0,
    };
    const summary: SelectableCatalogServiceSummary = {
      serviceId: "svc",
      serviceCode: "STANDARD_HOME_CLEANING",
      serviceVersion: 3,
      categoryId: "cat",
      categoryCode: "HOME_CLEANING",
      name: "Standard Home Cleaning",
      description: "Routine cleaning for a home.",
      categoryName: "Home Cleaning",
      displayOrder: 0,
    };
    const definition: SnapshotReadyCatalogServiceDefinition = {
      serviceId: summary.serviceId,
      serviceCode: summary.serviceCode,
      serviceVersion: summary.serviceVersion,
      category: {
        id: summary.categoryId,
        code: summary.categoryCode,
        name: summary.categoryName,
        description: "Home cleaning and housekeeping services.",
      },
      locale: "EN",
      countryCode: "EG",
      name: summary.name,
      description: summary.description,
      priceUnits: [priceUnit],
      fields: [numberField, selectField],
      media: [media],
    };

    expect(definition.fields).toHaveLength(2);
    expect(definition.fields[0]?.numberRules?.min).toBe("0.00");
    expect(definition.fields[0]?.numberRules?.max).toBe("99.50");
    expect(typeof definition.fields[0]?.numberRules?.min).toBe("string");
    expect(typeof definition.fields[0]?.numberRules?.max).toBe("string");
    expect(definition.fields[1]?.options.map((option) => option.value)).toEqual([
      "YES",
      "NO",
    ]);
    expect(definition.media[0]).toEqual(media);
    expect(JSON.stringify(definition)).not.toMatch(
      /storageKey|uploader|deliveryUrl|signedUrl|Prisma|Request|Response/iu,
    );
  });

  it("keeps catalog.public free of Prisma, repository, HTTP, and Media delivery types", () => {
    expect(catalogPublicSource).not.toMatch(
      /(?:from|import)\s+.*(?:@prisma\/client|#generated\/prisma|#database\/prisma)/u,
    );
    expect(catalogPublicSource).not.toMatch(
      /\b(?:PrismaClient|Prisma\.|Express|Request|Response|Router)\b/u,
    );
    expect(catalogPublicSource).not.toMatch(
      /catalog\.repository|catalog\.controller|catalog\.routes|catalog\.service/u,
    );
    expect(catalogPublicSource).not.toMatch(
      /issueDelivery|storageKey|signedUrl|deliveryUrl/u,
    );
    expect(catalogPublicSource).toContain("CatalogDefinitionReader");
    expect(catalogPublicSource).toContain("SnapshotReadyCatalogServiceDefinition");
  });
});
