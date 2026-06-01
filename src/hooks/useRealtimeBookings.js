import { useEffect, useCallback } from "react";
import { supabase, isConfigured } from "../lib/supabase";

export function useRealtimeBookings(onUpdate) {
  const subscribe = useCallback(() => {
    if (!isConfigured || !supabase) return () => {};

    const channel = supabase
      .channel("bookings-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings" },
        () => onUpdate()
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [onUpdate]);

  useEffect(() => {
    const unsub = subscribe();
    return unsub;
  }, [subscribe]);
}

export function useRealtimeDrivers(onUpdate) {
  const subscribe = useCallback(() => {
    if (!isConfigured || !supabase) return () => {};

    const channel = supabase
      .channel("drivers-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "drivers" },
        () => onUpdate()
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [onUpdate]);

  useEffect(() => {
    const unsub = subscribe();
    return unsub;
  }, [subscribe]);
}
