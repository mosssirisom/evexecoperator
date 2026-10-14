// Fixed airport prices, per journey, in GBP. A copy of the website's own price
// list (evexec lib/format.js PRICES, the booking form's BW_AIRPORTS and
// scripts/site/data.js); keep all of them in sync until prices move into the
// database per operator.
export type AirportPrice = { name: string; code: string; oneWay: number; ret: number };

export const AIRPORT_PRICES: AirportPrice[] = [
  { name: "Manchester Airport", code: "MAN", oneWay: 90, ret: 160 },
  { name: "Liverpool Airport", code: "LPL", oneWay: 95, ret: 170 },
  { name: "Leeds Bradford Airport", code: "LBA", oneWay: 135, ret: 250 },
  { name: "Birmingham Airport", code: "BHX", oneWay: 215, ret: 410 },
  { name: "Newcastle Airport", code: "NCL", oneWay: 250, ret: 480 },
];

/** Extra charge per additional stop, as the website booking form adds it. */
export const EXTRA_STOP_PRICE = 5;

function findAirport(location: string | null | undefined): AirportPrice | null {
  const s = String(location || "").toLowerCase();
  if (!s) return null;
  return (
    AIRPORT_PRICES.find(
      (a) => s.includes(a.name.toLowerCase().replace(" airport", "")) || new RegExp(`\\b${a.code.toLowerCase()}\\b`).test(s),
    ) ?? null
  );
}

/** The fixed one-way price for a location naming one of the airports above, else null. */
export function fixedOneWayPrice(location: string | null | undefined): number | null {
  return findAirport(location)?.oneWay ?? null;
}

/**
 * The fixed price for ONE booking leg. The Operator app books a return as two
 * bookings, each invoiced and paid on its own, so each leg carries half the
 * return fare (Manchester return £160 → £80 + £80), matching the website.
 */
export function fixedLegPrice(location: string | null | undefined, isReturn: boolean): number | null {
  const a = findAirport(location);
  if (!a) return null;
  return isReturn ? a.ret / 2 : a.oneWay;
}
