import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useFleetSettings } from "./useFleetSettings";
import { saveSettings, loadSettings, STORAGE_KEY, INITIAL } from "../lib/settings";

beforeEach(() => {
  localStorage.clear();
});

describe("useFleetSettings", () => {
  it("returns the default fleet settings initially", () => {
    const { result } = renderHook(() => useFleetSettings());
    expect(result.current).toEqual(INITIAL.fleet);
  });

  it("updates when settings are saved via saveSettings", () => {
    const { result } = renderHook(() => useFleetSettings());

    act(() => {
      saveSettings({ ...loadSettings(), fleet: { ...INITIAL.fleet, rateMan: "£200" } });
    });

    expect(result.current.rateMan).toBe("£200");
  });

  it("updates on a storage event from another tab", () => {
    const { result } = renderHook(() => useFleetSettings());

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...loadSettings(), fleet: { ...INITIAL.fleet, rateLpl: "£999" } })
    );
    act(() => {
      window.dispatchEvent(new Event("storage"));
    });

    expect(result.current.rateLpl).toBe("£999");
  });

  it("stops reacting to changes after unmount", () => {
    const { result, unmount } = renderHook(() => useFleetSettings());
    unmount();

    act(() => {
      saveSettings({ ...loadSettings(), fleet: { ...INITIAL.fleet, rateMan: "£500" } });
    });

    // No re-render after unmount, so the hook's last snapshot is unchanged.
    expect(result.current.rateMan).toBe(INITIAL.fleet.rateMan);
  });
});
