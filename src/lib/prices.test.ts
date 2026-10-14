import { describe, expect, it } from "vitest";
import { AIRPORT_PRICES, fixedOneWayPrice } from "./prices";

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
