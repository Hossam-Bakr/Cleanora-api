import { readFileSync } from "node:fs";
import path from "node:path";

const bookingsRoot = path.resolve("src/modules/bookings");

describe("R1-P12 bookings module boundaries", () => {
  it("does not import foreign repositories or Prisma clients", () => {
    const files = [
      "bookings.service.ts",
      "bookings.controller.ts",
      "bookings.routes.ts",
      "bookings.public.ts",
      "bookings.schema.ts",
      "bookings.cursor.ts",
      "bookings.sort-filter.ts",
      "bookings.errors.ts",
    ];
    const forbidden = [
      /prisma/i,
      /repository/i,
      /#modules\/providers\/infrastructure/,
      /#modules\/catalog\/infrastructure/,
      /#modules\/eligibility\/infrastructure/,
      /#modules\/configuration\/infrastructure/,
      /#modules\/media\/infrastructure/,
    ];
    for (const file of files) {
      const source = readFileSync(path.join(bookingsRoot, file), "utf8");
      for (const pattern of forbidden) {
        expect(source, `${file} matched ${pattern}`).not.toMatch(pattern);
      }
    }
  });
});
