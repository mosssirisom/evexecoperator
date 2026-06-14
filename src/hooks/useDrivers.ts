"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { DbDriver } from "@/lib/database.types";

export function useDrivers() {
  const [drivers, setDrivers] = useState<DbDriver[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    const { data } = await supabase
      .from("drivers")
      .select("*")
      .order("name", { ascending: true });
    setDrivers((data as DbDriver[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetch();

    // Real-time — driver status/availability changes reflect instantly
    const channel = supabase
      .channel("drivers-calendar")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "drivers" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setDrivers((prev) => [...prev, payload.new as DbDriver]);
          } else if (payload.eventType === "UPDATE") {
            setDrivers((prev) =>
              prev.map((d) =>
                d.id === (payload.new as DbDriver).id
                  ? (payload.new as DbDriver)
                  : d
              )
            );
          } else if (payload.eventType === "DELETE") {
            setDrivers((prev) =>
              prev.filter((d) => d.id !== (payload.old as DbDriver).id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetch]);

  return { drivers, loading };
}