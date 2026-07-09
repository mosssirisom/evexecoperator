"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { DbJobProof } from "@/lib/database.types";

export type JobProofMap = Record<string, DbJobProof[]>;

/**
 * Loads job proofs and keys them by booking_id, updating in real time.
 * The driver app inserts proofs (pickup photo, signature, completion / no-show)
 * into `booking_photos`; the operator dashboard reads them from there.
 * Capped to recent rows to stay bounded.
 */
export function useJobProofs() {
  const [proofs, setProofs] = useState<JobProofMap>({});
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    const { data } = await supabase
      .from("booking_photos")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    const map: JobProofMap = {};
    for (const row of (data as DbJobProof[]) ?? []) {
      (map[row.booking_id] ??= []).push(row);
    }
    setProofs(map);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetch();

    const channel = supabase
      .channel("job-proofs")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "booking_photos" },
        () => fetch()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetch]);

  return { proofs, loading };
}
