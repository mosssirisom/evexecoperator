import { describe, expect, it } from "vitest";
import { AIRPORT_PRICES, fixedLegPrice, fixedOneWayPrice } from "./prices";

describe("fixedOneWayPrice", () => {
  it("matches the website's one-way prices", () => {
    expect(fixedOneWayPrice("Manchester Airport (MAN)")).toBe(90);
    expect(fixedOneWayPrice("Liverpool Airport (LPL)")).toBe(95);
    expect(fixedOneWayPrice("Leeds Bradford Airport (LBA)")).toBe(135);
    expect(fixedOneWayPrice("Birmingham Airport (BHX)")).toBe(215);
    expect(fixedOneWayPrice("Newcastle Airport (NCL)")).toBe(250);
  });

  it("matches free-typed names and codes", () => {
    expect(fixedOneWayPrice("manchester airport T2")).toBe(90);
    expect(fixedOneWayPrice("LPL")).toBe(95);
  });

  it("has no fixed price for other airports or places", () => {
    expect(fixedOneWayPrice("London Heathrow (LHR)")).toBeNull();
    expect(fixedOneWayPrice("Blackpool Airport (BLK)")).toBeNull();
    expect(fixedOneWayPrice("Lytham St Annes")).toBeNull();
    expect(fixedOneWayPrice("")).toBeNull();
    expect(fixedOneWayPrice(null)).toBeNull();
  });

  it("keeps return prices above one-way", () => {
    for (const a of AIRPORT_PRICES) expect(a.ret).toBeGreaterThan(a.oneWay);
  });
});

describe("fixedLegPrice", () => {
  it("charges the one-way fare for a single journey", () => {
    expect(fixedLegPrice("Manchester Airport (MAN)", false)).toBe(90);
  });

  it("splits the return fare across the two legs", () => {
    expect(fixedLegPrice("Manchester Airport (MAN)", true)).toBe(80);
    for (const a of AIRPORT_PRICES) {
      const leg = fixedLegPrice(a.name, true)!;
      expect(leg * 2).toBe(a.ret);
      expect(Number.isInteger(leg)).toBe(true);
    }
  });

  it("has no fixed price off the price list", () => {
    expect(fixedLegPrice("London Heathrow (LHR)", true)).toBeNull();
  });
});
