import { useEffect, useRef } from "react";
import { supabase, isConfigured } from "../lib/supabase";

function useRealtimeTable(table, onUpdate) {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    if (!isConfigured || !supabase) return;

    const channelName = `${table}-realtime-${Math.random().toString(36).slice(2, 7)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => onUpdateRef.current()
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [table]);
}

export function useRealtimeBookings(onUpdate) {
  useRealtimeTable("bookings", onUpdate);
}

export function useRealtimeDrivers(onUpdate) {
  useRealtimeTable("drivers", onUpdate);
}
