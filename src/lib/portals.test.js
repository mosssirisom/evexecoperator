import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PORTALS, openPortal, driverJobUrl } from "./portals";

describe("openPortal", () => {
  let openSpy;

  beforeEach(() => {
    openSpy = vi.spyOn(window, "open").mockImplementation(() => {});
  });

  afterEach(() => {
    openSpy.mockRestore();
  });

  it("opens the URL for a known portal in a new tab", () => {
    openPortal("website");
    expect(openSpy).toHaveBeenCalledWith(PORTALS.website.url, "_blank", "noopener,noreferrer");
  });

  it("does nothing for an unknown portal key", () => {
    openPortal("doesNotExist");
    expect(openSpy).not.toHaveBeenCalled();
  });
});

describe("driverJobUrl", () => {
  it("builds a job URL from the driver app base URL", () => {
    const base = PORTALS.driverApp.url.replace(/\/$/, "");
    expect(driverJobUrl("EVX-1234")).toBe(`${base}/jobs/EVX-1234`);
  });

  it("URL-encodes special characters in the booking ref", () => {
    const url = driverJobUrl("EVX-TEST/01");
    expect(url).toContain("EVX-TEST%2F01");
    expect(url).not.toContain("/01\"");
  });
});
