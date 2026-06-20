import { useEffect, useRef, useState, useCallback } from "react";
import { supabase, isConfigured } from "../lib/supabase";
import { useRealtimeBookings } from "./useRealtimeBookings";
import { dispatchJobToDriverApp, updateJobStatus } from "../lib/driverApp";
import { getFleetSettings } from "../lib/settings";
import { logActivity } from "../lib/auditLog";
import {
  validateBookingPayload,
  validateStatusTransition,
  BOOKING_STATUSES,
  ValidationError,
  generateBookingRef,
  sanitizeText,
} from "../lib/validation";

// ─── Row mapper ───────────────────────────────────────────────────────────────

function combineDateTime(date, time) {
  if (!date) return null;
  if (!time) return date;
  return `${date}T${time}`;
}

function routeFromRow(row) {
  const pickup = row.pickup_location || row.pickup_address || row.pickup || null;
  const dropoff = row.dropoff_address || row.destination || null;

  if (pickup && row.airport) return `${pickup} → ${row.airport}`;
  if (row.airport && dropoff) return `${row.airport} → ${dropoff}`;
  if (row.airport || dropoff || pickup) return [row.airport, dropoff, pickup].filter(Boolean).join(" → ");
  return "—";
}

const DIRECTION_AIRPORT_TO_DEST = "Airport → Destination";
const DIRECTION_DEST_TO_AIRPORT = "Destination → Airport";

// The booking website writes a static "Airport to Destination" string into
// `direction` regardless of the actual journey, with the real direction
// only reflected in `journey_type` ("To Airport" / "From Airport"). Use
// `journey_type` as the source of truth when present, otherwise normalise
// whatever `direction` value we have to one of the two canonical strings.
export function normalizeDirection(direction, journeyType) {
  const jt = (journeyType || "").trim().toLowerCase();
  if (jt === "to airport") return DIRECTION_DEST_TO_AIRPORT;
  if (jt === "from airport") return DIRECTION_AIRPORT_TO_DEST;

  const dir = (direction || "").trim().toLowerCase();
  if (dir.startsWith("airport")) return DIRECTION_AIRPORT_TO_DEST;
  if (dir.startsWith("destination")) return DIRECTION_DEST_TO_AIRPORT;

  return direction || null;
}

export function shapedBooking(row) {
  const pickupTime = row.pickup_time || combineDateTime(row.travel_date, row.travel_time);
  const price = row.price ?? row.quoted_price ?? null;
  const flight = row.flight || row.flight_number || "—";
  const direction = normalizeDirection(row.direction, row.journey_type);
  const destination = row.destination || row.dropoff_address || row.pickup_location || null;

  return {
    id: row.ref || row.id,
    dbId: row.id,
    customer: row.customer_name,
    phone: row.customer_phone ?? null,
    email: row.customer_email ?? null,
    flight,
    route: routeFromRow(row),
    airport: row.airport ?? null,
    destination,
    direction,
    time: pickupTime
      ? new Date(pickupTime).toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—",
    pickupTime,
    driver: row.drivers?.name ?? "Unassigned",
    driverId: row.driver_id ?? row.assigned_driver_id ?? null,
    price: price ? `£${Number(price).toFixed(0)}` : "TBC",
    status: row.status,
    paymentStatus: row.payment_status ?? "Unpaid",
    priority: row.priority ?? false,
    notes: row.notes ?? "",
    updatedAt: row.updated_at ?? null,
    createdAt: row.created_at ?? null,
  };
}

// Keep the assigned driver's status roughly in sync with their active job so
// the fleet board doesn't show two independent states that can drift apart.
const DRIVER_STATUS_FOR_BOOKING_STATUS = {
  Dispatched: "En route",
  "En Route": "En route",
  "Passenger On Board": "Passenger onboard",
};

async function syncDriverStatusForBooking(driverId, bookingStatus, bookingRef) {
  const mapped = DRIVER_STATUS_FOR_BOOKING_STATUS[bookingStatus];
  if (mapped) {
    const { error } = await supabase.from("drivers").update({ status: mapped }).eq("id", driverId);
    if (error) throw new Error(error.message);
    return;
  }

  if (bookingStatus === "Completed" || bookingStatus === "Cancelled") {
    const { data, error } = await supabase
      .from("bookings")
      .select("ref")
      .eq("driver_id", driverId)
      .in("status", ["Dispatched", "En Route", "Passenger On Board"])
      .neq("ref", bookingRef);
    if (error) throw new Error(error.message);

    if (!data || data.length === 0) {
      const { error: updErr } = await supabase.from("drivers").update({ status: "Available" }).eq("id", driverId);
      if (updErr) throw new Error(updErr.message);
    }
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 100;

export function useBookings() {
  const [bookings, setBookings] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  const bookingsRef = useRef(bookings);
  useEffect(() => {
    bookingsRef.current = bookings;
  }, [bookings]);

  const fetchIdRef = useRef(0);

  const fetchBookings = useCallback(async () => {
    if (!isConfigured) return;
    const myId = ++fetchIdRef.current;
    setLoading(true);
    try {
      const { data, count, error: err } = await supabase
        .from("bookings")
        .select("*, drivers!driver_id(name)", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(0, PAGE_SIZE - 1);
      if (fetchIdRef.current !== myId) return;
      if (err) { setError(err.message); return; }
      setBookings((data || []).map(shapedBooking));
      setTotalCount(count ?? 0);
      setError(null);
    } finally {
      if (fetchIdRef.current === myId) setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!isConfigured || loadingMore) return;
    const from = bookingsRef.current.length;
    setLoadingMore(true);
    try {
      const { data, error: err } = await supabase
        .from("bookings")
        .select("*, drivers!driver_id(name)")
        .order("created_at", { ascending: false })
        .range(from, from + PAGE_SIZE - 1);
      if (err) throw new Error(err.message);
      setBookings((prev) => {
        const existingIds = new Set(prev.map((b) => b.id));
        return [...prev, ...(data || []).map(shapedBooking).filter((b) => !existingIds.has(b.id))];
      });
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  useRealtimeBookings(fetchBookings);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchBookings();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [fetchBookings]);

  useEffect(() => {
    if (!isConfigured) return;
    const id = setInterval(fetchBookings, 60_000);
    return () => clearInterval(id);
  }, [fetchBookings]);

  const updateStatus = useCallback(async (id, status) => {
    if (!BOOKING_STATUSES.includes(status)) {
      throw new ValidationError(`"${status}" is not a valid booking status`);
    }

    const current = bookingsRef.current.find((b) => b.id === id);
    if (current) {
      validateStatusTransition(current.status, status);
    }

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

      if (current?.driverId) {
        syncDriverStatusForBooking(current.driverId, status, id).catch((err) => {
          console.warn("[Driver] Status sync failed:", err.message);
        });
      }

      logActivity({
        action: "booking.status_changed",
        entityType: "booking",
        entityId: id,
        details: { from: current?.status ?? null, to: status },
      });
    } catch (err) {
      setBookings(snapshot);
      throw err;
    }
  }, []);

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

      let driverRow = null;
      if (form.driver) {
        const { data } = await supabase
          .from("drivers")
          .select("id, name")
          .eq("id", form.driver)
          .single();
        driverRow = data;
      } else if (getFleetSettings().autoAssign) {
        const { data } = await supabase
          .from("drivers")
          .select("id, name")
          .eq("status", "Available")
          .order("rating", { ascending: false });
        driverRow = data?.[0] ?? null;
      }

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
          status:         driverRow ? "Dispatched" : "Unassigned",
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

      const createdStatus = driverRow ? "Dispatched" : "Unassigned";
      dispatchJobToDriverApp({
        bookingRef: ref,
        customer: form.customer,
        route: `${form.airport} → ${dest}`,
        flight: form.flight,
        pickupTime: pickup,
        price: form.price ? `£${form.price}` : "TBC",
        driver: driverRow?.name ?? null,
        status: createdStatus,
      }).catch(() => {});

      logActivity({
        action: "booking.created",
        entityType: "booking",
        entityId: ref,
        details: { customer: form.customer, status: createdStatus, driver: driverRow?.name ?? null },
      });

      await fetchBookings();
      return { ref };
    },
    [fetchBookings]
  );

  const assignDriver = useCallback(async (id, driverId, driverName) => {
    const current = bookingsRef.current.find((b) => b.id === id);
    const currentStatus = current?.status ?? "";

    let newStatus = null;
    if (driverId) {
      if (currentStatus === "Unassigned" || currentStatus === "Unassigned / Missed Call Recovery") {
        newStatus = "Dispatched";
      }
    } else {
      if (currentStatus === "Dispatched" || currentStatus === "Unassigned / Missed Call Recovery") {
        newStatus = "Unassigned";
      }
    }

    const snapshot = bookingsRef.current;
    setBookings((prev) =>
      prev.map((b) =>
        b.id === id
          ? {
              ...b,
              driverId: driverId || null,
              driver: driverName ?? (driverId ? b.driver : "Unassigned"),
              ...(newStatus ? { status: newStatus } : {}),
            }
          : b
      )
    );

    if (!isConfigured) return;

    try {
      const update = { driver_id: driverId || null, assigned_driver_id: driverId || null };
      if (newStatus) update.status = newStatus;

      const { error: err } = await supabase
        .from("bookings")
        .update(update)
        .eq("ref", id);
      if (err) throw new Error(err.message);

      logActivity({
        action: driverId ? "booking.driver_assigned" : "booking.driver_unassigned",
        entityType: "booking",
        entityId: id,
        details: { from: current?.driver ?? null, to: driverName ?? null },
      });
    } catch (err) {
      setBookings(snapshot);
      throw err;
    }
  }, []);

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

  const updatePaymentStatus = useCallback(async (id, paymentStatus) => {
    const snapshot = bookingsRef.current;
    setBookings((prev) =>
      prev.map((b) => (b.id === id ? { ...b, paymentStatus } : b))
    );

    if (!isConfigured) return;

    try {
      const { error: err } = await supabase
        .from("bookings")
        .update({ payment_status: paymentStatus })
        .eq("ref", id);
      if (err) throw new Error(err.message);

      logActivity({
        action: "booking.payment_status_changed",
        entityType: "booking",
        entityId: id,
        details: { to: paymentStatus },
      });
    } catch (err) {
      setBookings(snapshot);
      throw err;
    }
  }, []);

  const deleteBooking = useCallback(async (id) => {
    const snapshot = bookingsRef.current;
    const current = snapshot.find((b) => b.id === id);

    // Optimistically drop the booking from the list.
    setBookings((prev) => prev.filter((b) => b.id !== id));
    setTotalCount((c) => Math.max(0, c - 1));

    if (!isConfigured) return;

    try {
      const { error: err } = await supabase
        .from("bookings")
        .delete()
        .eq("ref", id);
      if (err) throw new Error(err.message);

      logActivity({
        action: "booking.deleted",
        entityType: "booking",
        entityId: id,
        details: { customer: current?.customer ?? null, status: current?.status ?? null },
      });
    } catch (err) {
      setBookings(snapshot);
      setTotalCount((c) => c + 1);
      throw err;
    }
  }, []);

  return { bookings, totalCount, loading, loadingMore, loadMore, error, createBooking, updateStatus, assignDriver, updateNotes, togglePriority, updatePaymentStatus, deleteBooking, refetch: fetchBookings };
}

// Dedicated query for "today's" bookings (by pickup_time), independent of the
// PAGE_SIZE cap on useBookings() — so today's totals stay accurate even once
// the operator has more than PAGE_SIZE bookings on file.
export function useTodayBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchIdRef = useRef(0);

  const fetchToday = useCallback(async () => {
    if (!isConfigured) return;
    const myId = ++fetchIdRef.current;
    setLoading(true);
    try {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);

      const { data, error: err } = await supabase
        .from("bookings")
        .select("*, drivers!driver_id(name)")
        .gte("pickup_time", start.toISOString())
        .lt("pickup_time", end.toISOString())
        .order("pickup_time", { ascending: true });
      if (fetchIdRef.current !== myId) return;
      if (err) { setError(err.message); return; }
      setBookings((data || []).map(shapedBooking));
      setError(null);
    } finally {
      if (fetchIdRef.current === myId) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchToday();
  }, [fetchToday]);

  useRealtimeBookings(fetchToday);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchToday();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [fetchToday]);

  useEffect(() => {
    if (!isConfigured) return;
    const id = setInterval(fetchToday, 60_000);
    return () => clearInterval(id);
  }, [fetchToday]);

  return { bookings, loading, error, refetch: fetchToday };
}
