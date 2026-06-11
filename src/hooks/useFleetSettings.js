import { useEffect, useState } from "react";
import { loadSettings, SETTINGS_CHANGED_EVENT } from "../lib/settings";

/** Live-reads the operator's Fleet & Pricing settings, updating when Settings.jsx saves changes. */
export function useFleetSettings() {
  const [fleet, setFleet] = useState(() => loadSettings().fleet);

  useEffect(() => {
    const onChange = () => setFleet(loadSettings().fleet);
    window.addEventListener(SETTINGS_CHANGED_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(SETTINGS_CHANGED_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  return fleet;
}
