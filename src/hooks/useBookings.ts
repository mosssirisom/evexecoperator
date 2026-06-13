"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import type { DbBooking, BookingStatus } from "@/lib/database.types";

// Matches the `EVX-[A-Z0-9]+` ref format used across the EV Exec ecosystem
// (timestamp + random suffix in base36, uppercased).
function generateBookingRef(): string {
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `EVX-${Date.now().toString(36).toUpperCase()}${random}`;
}

export function useBookings() {
  const [bookings, setBookings] = useState<DbBooking[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const prevRef                 = useRef<DbBooking[]>([]);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from("bookings")
      .select("*, drivers!driver_id(name)")
      .order("travel_date", { ascending: true })
      .order("travel_time", { ascending: true });

    if (err) {
      setError(err.message);
    } else {
      const rows = (data as DbBooking[]) ?? [];
      prevRef.current = rows;
      setBookings(rows);
      setError(null);
    }
    setLoading(false);
  }, []);

  // Keep the revert snapshot in sync with the latest known-good state,
  // so a failed update doesn't roll back past an earlier successful one.
  useEffect(() => {
    prevRef.current = bookings;
  }, [bookings]);

  useEffect(() => {
    fetch();

    // Real-time subscription — mirrors operator/driver apps
    const channel = supabase
      .channel("bookings-calendar")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setBookings((prev) => [...prev, payload.new as DbBooking]);
          } else if (payload.eventType === "UPDATE") {
            setBookings((prev) =>
              prev.map((b) =>
                b.ref === (payload.new as DbBooking).ref
                  ? (payload.new as DbBooking)
                  : b
              )
            );
          } else if (payload.eventType === "DELETE") {
            setBookings((prev) =>
              prev.filter((b) => b.ref !== (payload.old as DbBooking).ref)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetch]);

  const updateStatus = useCallback(
    async (ref: string, status: BookingStatus) => {
      // Optimistic update
      setBookings((prev) =>
        prev.map((b) => (b.ref === ref ? { ...b, status } : b))
      );
      const { error: err } = await supabase
        .from("bookings")
        .update({ status })
        .eq("ref", ref);
      if (err) {
        setError(err.message);
        // Revert on failure
        setBookings(prevRef.current);
        return false;
      }
      return true;
    },
    []
  );

  const assignDriver = useCallback(
    async (ref: string, driver_id: string | null) => {
      setBookings((prev) =>
        prev.map((b) =>
          b.ref === ref
            ? {
                ...b,
                driver_id,
                status:
                  driver_id && b.status === "Unassigned"
                    ? "Dispatched"
                    : b.status,
              }
            : b
        )
      );
      const { error: err } = await supabase
        .from("bookings")
        .update({
          driver_id,
          ...(driver_id ? { status: "Dispatched" as BookingStatus } : {}),
        })
        .eq("ref", ref);
      if (err) {
        setError(err.message);
        setBookings(prevRef.current);
        return false;
      }
      return true;
    },
    []
  );

  const createBooking = useCallback(
    async (data: Omit<DbBooking, "id" | "ref" | "created_at" | "updated_at" | "drivers">) => {
      const ref = generateBookingRef();
      const { error: err } = await supabase
        .from("bookings")
        .insert({ ...data, ref });
      if (err) throw new Error(err.message);
      return ref;
    },
    []
  );

  return { bookings, loading, error, updateStatus, assignDriver, createBooking, refetch: fetch };
}