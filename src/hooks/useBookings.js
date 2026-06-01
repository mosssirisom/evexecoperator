import { useEffect, useState, useCallback } from "react";
import { supabase, isConfigured } from "../lib/supabase";
import { transfers as mockTransfers } from "../data/mockData";
import { useRealtimeBookings } from "./useRealtimeBookings";

function shapedBooking(row) {
  return {
    id: row.ref,
    customer: row.customer_name,
    flight: row.flight ?? "—",
    route: [row.airport, row.destination].filter(Boolean).join(" → ") || row.destination || "—",
    time: row.pickup_time
      ? new Date(row.pickup_time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
      : "—",
    driver: row.drivers?.name ?? "Unassigned",
    price: row.price ? `£${Number(row.price).toFixed(0)}` : "TBC",
    status: row.status,
    priority: row.priority ?? false,
  };
}

export function useBookings() {
  const [bookings, setBookings] = useState(mockTransfers);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchBookings = useCallback(async () => {
    if (!isConfigured) return;
    setLoading(true);
    const { data, error: err } = await supabase
      .from("bookings")
      .select("*, drivers(name)")
      .order("pickup_time", { ascending: true });
    setLoading(false);
    if (err) { setError(err.message); return; }
    setBookings(data.map(shapedBooking));
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  useRealtimeBookings(fetchBookings);

  const updateStatus = useCallback(async (id, status) => {
    if (!isConfigured) {
      setBookings((prev) => prev.map((b) => b.id === id ? { ...b, status } : b));
      return;
    }
    await supabase.from("bookings").update({ status }).eq("ref", id);
    // realtime subscription triggers refetch automatically
  }, []);

  const createBooking = useCallback(
    async (form) => {
      const ref = `EVX-${Date.now().toString().slice(-4)}`;
      if (!isConfigured) {
        setBookings((prev) => [
          ...prev,
          {
            id: ref,
            customer: form.customer,
            flight: form.flight || "—",
            route: `${form.airport} → ${form.destination === "Custom address…" ? form.customAddress : form.destination}`,
            time: form.time,
            driver: "Unassigned",
            price: form.price ? `£${form.price}` : "TBC",
            status: "Dispatched",
            priority: false,
          },
        ]);
        return { ref };
      }
      const { data: driverRow } = form.driver
        ? await supabase.from("drivers").select("id").eq("id", form.driver).single()
        : { data: null };

      const pickup = form.date && form.time
        ? new Date(`${form.date}T${form.time}`).toISOString()
        : null;

      const { error: err } = await supabase.from("bookings").insert({
        ref,
        customer_name: form.customer,
        customer_phone: form.phone,
        customer_email: form.email || null,
        flight: form.flight || null,
        direction: form.direction,
        airport: form.airport,
        destination: form.destination === "Custom address…" ? form.customAddress : form.destination,
        pickup_time: pickup,
        driver_id: driverRow?.id ?? null,
        price: form.price ?? null,
        status: "Dispatched",
        notes: form.notes || null,
      });
      if (err) throw err;
      await fetchBookings();
      return { ref };
    },
    [fetchBookings]
  );

  return { bookings, loading, error, createBooking, updateStatus, refetch: fetchBookings };
}
