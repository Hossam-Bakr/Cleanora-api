import {
  formatMinorUnitsToCanonicalDecimal,
  maxMinorUnits,
  parseCanonicalDecimalToMinorUnits,
  percentOfMinorUnits,
} from "./bookings.money.js";
import { BOOKING_FORMULA_VERSION } from "./bookings.matrix.js";

export interface BookingQuote {
  readonly currencyCode: string;
  readonly decimalPlaces: number;
  readonly grossMinorUnits: string;
  readonly depositMinorUnits: string;
  readonly remainderMinorUnits: string;
  readonly depositPercent: string;
  readonly formulaVersion: typeof BOOKING_FORMULA_VERSION;
  readonly gross: string;
  readonly deposit: string;
  readonly remainder: string;
}

/**
 * @desc Build a server-authoritative booking quote from offering amounts.
 * @access Bookings domain
 * @explanation Gross is max(price, minimumCharge). Deposit is configured
 * percent of gross with round-half-up. Client totals are never inputs.
 */
export function quoteBooking(input: {
  readonly currencyCode: string;
  readonly decimalPlaces: number;
  readonly priceAmount: string;
  readonly minimumChargeAmount: string;
  readonly depositPercent: string;
}): BookingQuote {
  const priceMinor = parseCanonicalDecimalToMinorUnits(
    input.priceAmount,
    input.decimalPlaces,
  );
  const minimumMinor = parseCanonicalDecimalToMinorUnits(
    input.minimumChargeAmount,
    input.decimalPlaces,
  );
  const grossMinorUnits = maxMinorUnits(priceMinor, minimumMinor);
  const split = percentOfMinorUnits(grossMinorUnits, input.depositPercent);
  const depositPercent = formatMinorUnitsToCanonicalDecimal(
    parseCanonicalDecimalToMinorUnits(input.depositPercent, 2),
    2,
  );
  return {
    currencyCode: input.currencyCode,
    decimalPlaces: input.decimalPlaces,
    grossMinorUnits,
    depositMinorUnits: split.depositMinorUnits,
    remainderMinorUnits: split.remainderMinorUnits,
    depositPercent,
    formulaVersion: BOOKING_FORMULA_VERSION,
    gross: formatMinorUnitsToCanonicalDecimal(
      grossMinorUnits,
      input.decimalPlaces,
    ),
    deposit: formatMinorUnitsToCanonicalDecimal(
      split.depositMinorUnits,
      input.decimalPlaces,
    ),
    remainder: formatMinorUnitsToCanonicalDecimal(
      split.remainderMinorUnits,
      input.decimalPlaces,
    ),
  };
}
