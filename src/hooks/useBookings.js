import { useEffect, useRef, useState, useCallback } from "react";
import { supabase, isConfigured } from "../lib/supabase";
import { useRealtimeBookings } from "./useRealtimeBookings";
import { dispatchJobToDriverApp, updateJobStatus } from "../lib/driverApp";
import {
  validateBookingPayload,
  validateStatusTransition,
  BOOKING_STATUSES,
  ValidationError,
  generateBookingRef,
  sanitizeText,
} from "../lib/validation";

// ─── Row mapper ───────────────────────────────────────────────────────────────

export function shapedBooking(row) {
  return {
    id: row.ref,
    customer: row.customer_name,
    phone: row.customer_phone ?? null,
    email: row.customer_email ?? null,
    flight: row.flight ?? "—",
    route:
      [row.airport, row.destination].filter(Boolean).join(" → ") ||
      row.destination ||
      "—",
    airport: row.airport ?? null,
    destination: row.destination ?? null,
    direction: row.direction ?? null,
    time: row.pickup_time
      ? new Date(row.pickup_time).toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—",
    pickupTime: row.pickup_time ?? null,
    driver: row.drivers?.name ?? "Unassigned",
    driverId: row.driver_id ?? null,
    price: row.price ? `£${Number(row.price).toFixed(0)}` : "TBC",
    status: row.status,
    priority: row.priority ?? false,
    notes: row.notes ?? "",
    updatedAt: row.updated_at ?? null,
    createdAt: row.created_at ?? null,
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 100;

export function useBookings() {
  const [bookings, setBookings] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  // Stable ref to current bookings — avoids stale closures in callbacks
  // without adding `bookings` to useCallback dependency arrays.
  const bookingsRef = useRef(bookings);
  useEffect(() => {
    bookingsRef.current = bookings;
  }, [bookings]);

  // Counter guard: only the last in-flight fetch applies its result to state,
  // preventing a slow earlier response from overwriting a faster later one.
  const fetchIdRef = useRef(0);

  const fetchBookings = useCallback(async () => {
    if (!isConfigured) return;
    const myId = ++fetchIdRef.current;
    setLoading(true);
    try {
      const { data, count, error: err } = await supabase
        .from("bookings")
        .select("*, drivers(name)", { count: "exact" })
        .order("pickup_time", { ascending: true })
        .range(0, PAGE_SIZE - 1);
      if (fetchIdRef.current !== myId) return; // stale — a newer fetch is in flight
      if (err) { setError(err.message); return; }
      setBookings(data.map(shapedBooking));
      setTotalCount(count ?? 0);
      setError(null);
    } finally {
      if (fetchIdRef.current === myId) setLoading(false);
    }
  }, []);

  // Append next page without resetting the list; deduplicates by id in case
  // a realtime event inserted a record between the initial fetch and load-more.
  const loadMore = useCallback(async () => {
    if (!isConfigured || loadingMore) return;
    const from = bookingsRef.current.length;
    setLoadingMore(true);
    try {
      const { data, error: err } = await supabase
        .from("bookings")
        .select("*, drivers(name)")
        .order("pickup_time", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (err) throw new Error(err.message);
      setBookings((prev) => {
        const existingIds = new Set(prev.map((b) => b.id));
        return [...prev, ...data.map(shapedBooking).filter((b) => !existingIds.has(b.id))];
      });
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore]);

  // Initial load
  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  // Realtime subscription (with reconnect logic in useRealtimeBookings)
  useRealtimeBookings(fetchBookings);

  // Auto-refresh when tab regains focus — catches changes missed while away
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchBookings();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [fetchBookings]);

  // 60-second polling fallback: keeps data fresh if realtime silently dies
  useEffect(() => {
    if (!isConfigured) return;
    const id = setInterval(fetchBookings, 60_000);
    return () => clearInterval(id);
  }, [fetchBookings]);

  // ─── updateStatus ──────────────────────────────────────────────────────────

  const updateStatus = useCallback(async (id, status) => {
    if (!BOOKING_STATUSES.includes(status)) {
      throw new ValidationError(`"${status}" is not a valid booking status`);
    }

    const current = bookingsRef.current.find((b) => b.id === id);
    if (current) {
      validateStatusTransition(current.status, status);
    }

    // Optimistic update — snapshot for rollback
    const snapshot = bookingsRef.current;
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status } : b)));

    if (!isConfigured) {
      updateJobStatus(id, status).catch((err) => {
        console.warn("[DriverApp] Status sync failed (mock):", err.message);
      });
      return;
    }

    try {
      const { error: err } = await supabase
        .from("bookings")
        .update({ status })
        .eq("ref", id);
      if (err) throw new Error(err.message);

      updateJobStatus(id, status).catch((err) => {
        console.warn("[DriverApp] Status sync failed:", err.message);
      });
    } catch (err) {
      setBookings(snapshot); // roll back on failure
      throw err;
    }
  }, []);

  // ─── createBooking ─────────────────────────────────────────────────────────

  const createBooking = useCallback(
    async (form) => {
      validateBookingPayload(form);

      const dest =
        form.destination === "Custom address…"
          ? form.customAddress.trim()
          : form.destination;

      const pickup =
        form.date && form.time
          ? new Date(`${form.date}T${form.time}`).toISOString()
          : null;

      if (!isConfigured) throw new Error("Database not configured. Please add Supabase credentials.");

      const { data: driverRow } = form.driver
        ? await supabase
            .from("drivers")
            .select("id, name")
            .eq("id", form.driver)
            .single()
        : { data: null };

      // Retry up to 3 times on unique-key collision
      let ref;
      let succeeded = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        ref = generateBookingRef();
        const { error: insertErr } = await supabase.from("bookings").insert({
          ref,
          customer_name:  sanitizeText(form.customer, 120),
          customer_phone: sanitizeText(form.phone, 30),
          customer_email: form.email?.trim() || null,
          flight:         form.flight?.trim() || null,
          direction:      form.direction,
          airport:        form.airport,
          destination:    dest,
          pickup_time:    pickup,
          driver_id:      driverRow?.id ?? null,
          price:          form.price ?? null,
          status:         "Dispatched",
          notes:          form.notes?.trim() || null,
        });

        if (!insertErr) { succeeded = true; break; }
        if (insertErr.code !== "23505") throw new Error(insertErr.message);
      }
      if (!succeeded) {
        throw new Error(
          "Failed to generate a unique booking reference after 3 attempts. Please try again."
        );
      }

      dispatchJobToDriverApp({
        bookingRef: ref,
        customer: form.customer,
        route: `${form.airport} → ${dest}`,
        flight: form.flight,
        pickupTime: pickup,
        price: form.price ? `£${form.price}` : "TBC",
        driver: driverRow?.name ?? null,
      }).catch(() => {});

      // Fetch after create so the new booking appears with its server-assigned fields
      await fetchBookings();
      return { ref };
    },
    [fetchBookings]
  );

  // ─── assignDriver ──────────────────────────────────────────────────────────

  const assignDriver = useCallback(async (id, driverId) => {
    const snapshot = bookingsRef.current;
    setBookings((prev) =>
      prev.map((b) => (b.id === id ? { ...b, driverId: driverId || null } : b))
    );

    if (!isConfigured) return;

    try {
      const { error: err } = await supabase
        .from("bookings")
        .update({ driver_id: driverId || null })
        .eq("ref", id);
      if (err) throw new Error(err.message);
    } catch (err) {
      setBookings(snapshot);
      throw err;
    }
  }, []);

  // ─── updateNotes ───────────────────────────────────────────────────────────

  const updateNotes = useCallback(async (id, notes) => {
    const snapshot = bookingsRef.current;
    setBookings((prev) =>
      prev.map((b) => (b.id === id ? { ...b, notes: notes ?? "" } : b))
    );

    if (!isConfigured) return;

    try {
      const { error: err } = await supabase
        .from("bookings")
        .update({ notes: notes?.trim() || null })
        .eq("ref", id);
      if (err) throw new Error(err.message);
    } catch (err) {
      setBookings(snapshot);
      throw err;
    }
  }, []);

  // ─── togglePriority ────────────────────────────────────────────────────────

  const togglePriority = useCallback(async (id) => {
    const current = bookingsRef.current.find((b) => b.id === id);
    const newPriority = !current?.priority;

    const snapshot = bookingsRef.current;
    setBookings((prev) =>
      prev.map((b) => (b.id === id ? { ...b, priority: newPriority } : b))
    );

    if (!isConfigured) return;

    try {
      const { error: err } = await supabase
        .from("bookings")
        .update({ priority: newPriority })
        .eq("ref", id);
      if (err) throw new Error(err.message);
    } catch (err) {
      setBookings(snapshot);
      throw err;
    }
  }, []);

  return { bookings, totalCount, loading, loadingMore, loadMore, error, createBooking, updateStatus, assignDriver, updateNotes, togglePriority, refetch: fetchBookings };
}
