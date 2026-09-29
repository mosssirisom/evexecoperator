"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchLatestVerification,
  runFlightVerification,
  type FlightVerification,
  type VerifyOptions,
} from "@/lib/operator/flightVerification";

/** Shared by both the Dispatch drawer and the Calendar edit modal -- one
 * verification record per booking, fetched/refreshed the same way from
 * either surface. */
export function useFlightVerification(bookingId: string | null | undefined) {
  const [verification, setVerification] = useState<FlightVerification | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!bookingId) return;
    setLoading(true);
    try {
      const latest = await fetchLatestVerification(bookingId);
      setVerification(latest);
    } catch {
      // Non-fatal -- the panel just shows "not yet verified".
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    setVerification(null);
    reload();
  }, [reload]);

  const verify = useCallback(
    async (opts: VerifyOptions = {}) => {
      if (!bookingId) return null;
      setBusy(true);
      setError(null);
      try {
        const result = await runFlightVerification(bookingId, opts);
        setVerification(result);
        return result;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Verification failed");
        throw err;
      } finally {
        setBusy(false);
      }
    },
    [bookingId]
  );

  return { verification, loading, busy, error, verify, reload };
}
