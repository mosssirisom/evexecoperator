import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  STORAGE_KEY,
  SETTINGS_CHANGED_EVENT,
  INITIAL,
  loadSettings,
  saveSettings,
  getFleetSettings,
  parseRate,
} from "./settings";

beforeEach(() => {
  localStorage.clear();
});

describe("loadSettings", () => {
  it("returns INITIAL when nothing is stored", () => {
    expect(loadSettings()).toEqual(INITIAL);
  });

  it("merges stored values over INITIAL, keeping defaults for omitted keys", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ fleet: { rateMan: "£200" } })
    );

    const settings = loadSettings();

    expect(settings.fleet.rateMan).toBe("£200");
    expect(settings.fleet.rateLpl).toBe(INITIAL.fleet.rateLpl);
    expect(settings.business).toEqual(INITIAL.business);
    expect(settings.notifications).toEqual(INITIAL.notifications);
  });

  it("falls back to INITIAL when stored JSON is malformed", () => {
    localStorage.setItem(STORAGE_KEY, "{not valid json");
    expect(loadSettings()).toEqual(INITIAL);
  });
});

describe("saveSettings", () => {
  it("persists settings to localStorage", () => {
    const settings = { ...INITIAL, fleet: { ...INITIAL.fleet, rateMan: "£175" } };
    saveSettings(settings);

    expect(JSON.parse(localStorage.getItem(STORAGE_KEY))).toEqual(settings);
  });

  it("dispatches SETTINGS_CHANGED_EVENT on the window", () => {
    const handler = vi.fn();
    window.addEventListener(SETTINGS_CHANGED_EVENT, handler);

    saveSettings(INITIAL);

    expect(handler).toHaveBeenCalledTimes(1);
    window.removeEventListener(SETTINGS_CHANGED_EVENT, handler);
  });
});

describe("getFleetSettings", () => {
  it("returns the fleet slice of the persisted settings", () => {
    saveSettings({ ...INITIAL, fleet: { ...INITIAL.fleet, rateMan: "£999" } });
    expect(getFleetSettings()).toEqual({ ...INITIAL.fleet, rateMan: "£999" });
  });

  it("returns the default fleet settings when nothing is stored", () => {
    expect(getFleetSettings()).toEqual(INITIAL.fleet);
  });
});

describe("parseRate", () => {
  it.each([
    ["£160", 160],
    ["160", 160],
    ["£1,000", 1000],
    ["£0", null],
    ["0", null],
    ["", null],
    [null, null],
    [undefined, null],
    ["abc", null],
    ["£15.50", 1550],
  ])("parseRate(%j) -> %j", (input, expected) => {
    expect(parseRate(input)).toBe(expected);
  });
});
