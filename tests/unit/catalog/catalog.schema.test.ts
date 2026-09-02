
import {
  categoryLifecycleBodySchema,
  createCategoryBodySchema,
  createServiceBodySchema,
  replaceCategoryBodySchema,
} from "../../../src/modules/catalog/catalog.schema.js";

const commandBase = {
  idempotencyKey: "00000000-0000-4000-8000-000000000001",
  reasonCode: "catalog_management_change" as const,
};

const completeCategoryContent = {
  nameEn: "Home Cleaning",
  nameAr: "تنظيف المنازل",
  descriptionEn: "Home cleaning and housekeeping services.",
  descriptionAr: "خدمات تنظيف المنازل والتدبير المنزلي.",
};

describe("catalog management schema (US1)", () => {
  it("accepts a valid category create body without client displayOrder", () => {
    const parsed = createCategoryBodySchema.parse({
      ...commandBase,
      code: "HOME_CLEANING",
      ...completeCategoryContent,
    });
    expect(parsed.code).toBe("HOME_CLEANING");
    expect(parsed).not.toHaveProperty("displayOrder");
  });

  it("rejects lowercase category codes and missing reason/idempotency", () => {
    expect(() =>
      createCategoryBodySchema.parse({
        ...commandBase,
        code: "home_cleaning",
        ...completeCategoryContent,
      }),
    ).toThrow();
    expect(() =>
      createCategoryBodySchema.parse({
        idempotencyKey: commandBase.idempotencyKey,
        reasonCode: "wrong_reason",
        code: "HOME_CLEANING",
        ...completeCategoryContent,
      }),
    ).toThrow();
  });

  it("rejects client-supplied displayOrder on create because the schema is strict", () => {
    expect(() =>
      createCategoryBodySchema.parse({
        ...commandBase,
        code: "HOME_CLEANING",
        displayOrder: 0,
        ...completeCategoryContent,
      }),
    ).toThrow();
  });

  it("requires expectedVersion on category replace and lifecycle", () => {
    expect(() =>
      replaceCategoryBodySchema.parse({
        ...commandBase,
        ...completeCategoryContent,
      }),
    ).toThrow();
    const lifecycle = categoryLifecycleBodySchema.parse({
      ...commandBase,
      expectedVersion: 1,
      action: "ACTIVATE",
    });
    expect(lifecycle.action).toBe("ACTIVATE");
  });

  it("accepts a service create with draft translations and no displayOrder", () => {
    const parsed = createServiceBodySchema.parse({
      ...commandBase,
      categoryId: "ckl1u8k9p0000qzrmn831i7rn",
      code: "STANDARD_HOME_CLEANING",
      translations: [{ locale: "EN", name: "Draft", description: null }],
    });
    expect(parsed.translations).toHaveLength(1);
    expect(parsed).not.toHaveProperty("displayOrder");
  });

  it("rejects more than two translations or unknown locales", () => {
    expect(() =>
      createServiceBodySchema.parse({
        ...commandBase,
        categoryId: "ckl1u8k9p0000qzrmn831i7rn",
        code: "STANDARD_HOME_CLEANING",
        translations: [
          { locale: "EN", name: "A", description: "a" },
          { locale: "AR", name: "ب", description: "ب" },
          { locale: "EN", name: "dup", description: "d" },
        ],
      }),
    ).toThrow();
  });

  it("never accepts trusted actor fields from the client body", () => {
    expect(() =>
      createCategoryBodySchema.parse({
        ...commandBase,
        code: "HOME_CLEANING",
        ...completeCategoryContent,
        actorUserId: "attacker",
      }),
    ).toThrow();
  });
});
