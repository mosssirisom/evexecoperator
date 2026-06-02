-- Row-Level Security policies for EV Exec operator dashboard
-- Enables RLS on all tables and scopes access by role.
--
-- Service role: unrestricted (used by edge functions and realtime server)
-- Authenticated: full read/write (logged-in operators)
-- Anon: read-only (needed for Supabase Realtime postgres_changes subscriptions)

-- ── bookings ──────────────────────────────────────────────────────────────────

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bookings_service_bypass" ON bookings
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "bookings_authenticated_all" ON bookings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "bookings_anon_select" ON bookings
  FOR SELECT TO anon USING (true);

-- ── drivers ───────────────────────────────────────────────────────────────────

ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "drivers_service_bypass" ON drivers
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "drivers_authenticated_all" ON drivers
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "drivers_anon_select" ON drivers
  FOR SELECT TO anon USING (true);

-- ── missed_calls ──────────────────────────────────────────────────────────────

ALTER TABLE missed_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "missed_calls_service_bypass" ON missed_calls
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "missed_calls_authenticated_all" ON missed_calls
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "missed_calls_anon_select" ON missed_calls
  FOR SELECT TO anon USING (true);
