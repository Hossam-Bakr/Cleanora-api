import { canonicalizeBookingAnswer } from "#modules/bookings/bookings.answers";
import type { CatalogFieldDefinition } from "#modules/catalog/catalog.public";

function field(
  overrides: Partial<CatalogFieldDefinition> &
    Pick<CatalogFieldDefinition, "id" | "code" | "kind">,
): CatalogFieldDefinition {
  return {
    label: overrides.code,
    helpText: null,
    required: false,
    textBounds: null,
    numberRules: null,
    selectionBounds: null,
    options: [],
    displayOrder: 1,
    ...overrides,
  };
}

describe("booking answer canonicalization", () => {
  it("validates text, integer, decimal, boolean, and selection fields", () => {
    expect(
      canonicalizeBookingAnswer(
        field({
          id: "t",
          code: "T",
          kind: "TEXT",
          textBounds: { min: 1, max: 8 },
        }),
        "  hello ",
      ),
    ).toBe("hello");
    expect(
      canonicalizeBookingAnswer(
        field({
          id: "n",
          code: "N",
          kind: "NUMBER",
          numberRules: { mode: "INTEGER", min: "1", max: "10" },
        }),
        "3",
      ),
    ).toBe(3);
    expect(
      canonicalizeBookingAnswer(
        field({
          id: "d2",
          code: "D2",
          kind: "NUMBER",
          numberRules: { mode: "DECIMAL", min: "-2.00", max: "0" },
        }),
        "-1.50",
      ),
    ).toBe("-1.5");
    expect(() =>
      canonicalizeBookingAnswer(
        field({
          id: "d3",
          code: "D3",
          kind: "NUMBER",
          numberRules: { mode: "DECIMAL", min: "10.00", max: "20.00" },
        }),
        "9.99",
      ),
    ).toThrow(/INVALID_BOOKING_ANSWER/u);
    expect(
      canonicalizeBookingAnswer(
        field({ id: "b", code: "B", kind: "BOOLEAN" }),
        true,
      ),
    ).toBe(true);
    expect(
      canonicalizeBookingAnswer(
        field({
          id: "s",
          code: "S",
          kind: "SINGLE_SELECT",
          selectionBounds: { min: 1, max: 1 },
          options: [{ id: "o1", value: "a", label: "A", displayOrder: 1 }],
        }),
        "a",
      ),
    ).toBe("a");
    expect(
      canonicalizeBookingAnswer(
        field({
          id: "m",
          code: "M",
          kind: "MULTI_SELECT",
          selectionBounds: { min: 1, max: 2 },
          options: [
            { id: "o1", value: "a", label: "A", displayOrder: 1 },
            { id: "o2", value: "b", label: "B", displayOrder: 2 },
          ],
        }),
        ["b", "a"],
      ),
    ).toEqual(["b", "a"]);
  });

  it("rejects out-of-range, unknown-option, and information answers", () => {
    expect(() =>
      canonicalizeBookingAnswer(
        field({ id: "i", code: "I", kind: "INFORMATION" }),
        "x",
      ),
    ).toThrow(/INVALID_BOOKING_ANSWER/u);
    expect(() =>
      canonicalizeBookingAnswer(
        field({
          id: "n",
          code: "N",
          kind: "NUMBER",
          numberRules: { mode: "INTEGER", min: "1", max: "2" },
        }),
        3,
      ),
    ).toThrow(/INVALID_BOOKING_ANSWER/u);
    expect(() =>
      canonicalizeBookingAnswer(
        field({
          id: "d",
          code: "D",
          kind: "NUMBER",
          numberRules: { mode: "DECIMAL", min: "1.00", max: "2.00" },
        }),
        1.5,
      ),
    ).toThrow(/INVALID_BOOKING_ANSWER/u);
    expect(() =>
      canonicalizeBookingAnswer(
        field({
          id: "m",
          code: "M",
          kind: "MULTI_SELECT",
          selectionBounds: { min: 1, max: 1 },
          options: [{ id: "o1", value: "a", label: "A", displayOrder: 1 }],
        }),
        ["a", "a"],
      ),
    ).toThrow(/INVALID_BOOKING_ANSWER/u);
  });
});
