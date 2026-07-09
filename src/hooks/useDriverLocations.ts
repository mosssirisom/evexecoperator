"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { DbDriverLocation } from "@/lib/database.types";

// A driver is considered "live" if we've had a position fix within this window.
export const LIVE_LOCATION_FRESH_MS = 60_000;

export type DriverLocationMap = Record<string, DbDriverLocation>;

interface DriverPositionRow {
  id: string;
  current_lat: number | null;
  current_lng: number | null;
  location_updated_at: string | null;
}

function toLocation(row: DriverPositionRow): DbDriverLocation | null {
  if (row.current_lat == null || row.current_lng == null) return null;
  return {
    driver_id: row.id,
    lat: row.current_lat,
    lng: row.current_lng,
    heading: null,
    speed: null,
    accuracy: null,
    booking_ref: null,
    updated_at: row.location_updated_at,
  };
}

/**
 * Subscribes to live driver positions.
 *
 * The driver app writes GPS fixes directly onto `drivers.current_lat` /
 * `current_lng` / `location_updated_at` — not a separate `driver_locations`
 * table (that table isn't written to by anything). This hook reads from
 * `drivers` directly and keeps an in-memory map keyed by driver id, updated
 * in real time via Supabase `postgres_changes`.
 */
export function useDriverLocations() {
  const [locations, setLocations] = useState<DriverLocationMap>({});
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    const { data } = await supabase
      .from("drivers")
      .select("id, current_lat, current_lng, location_updated_at");
    const map: DriverLocationMap = {};
    for (const row of (data as DriverPositionRow[]) ?? []) {
      const loc = toLocation(row);
      if (loc) map[row.id] = loc;
    }
    setLocations(map);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetch();

    const channel = supabase
      .channel("driver-locations")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "drivers" },
        (payload) => {
          const row = payload.new as DriverPositionRow;
          const loc = toLocation(row);
          setLocations((prev) => {
            if (!loc) {
              const next = { ...prev };
              delete next[row.id];
              return next;
            }
            return { ...prev, [row.id]: loc };
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetch]);

  return { locations, loading };
}

/** True when a location fix is recent enough to treat the driver as live. */
export function isLocationLive(
  location: DbDriverLocation | undefined,
  now: number = Date.now()
): boolean {
  if (!location?.updated_at) return false;
  return now - new Date(location.updated_at).getTime() < LIVE_LOCATION_FRESH_MS;
}
