-- The operator dashboard (evexec-operator-dashboard) has no Supabase Auth and
-- talks to the database with the anon key for everything. The bookings,
-- drivers, and missed_calls policies were rewritten for the
-- website/customer/driver-app and no longer grant anon any read access (and
-- only `bookings` had an anon insert policy), so the dashboard could not see
-- bookings (incl. new ones from evexec.co.uk), drivers, or missed calls, and
-- could not update statuses, assign drivers, etc.
--
-- These policies restore full anon read/write access needed by the
-- dashboard, matching the permissiveness already in place for
-- anon_insert_bookings.

-- bookings: add anon read + update (insert already allowed via anon_insert_bookings)
CREATE POLICY "dashboard_anon_select_bookings" ON bookings
  FOR SELECT TO anon USING (true);

CREATE POLICY "dashboard_anon_update_bookings" ON bookings
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- drivers: dashboard needs to list, create, update, and delete drivers
CREATE POLICY "dashboard_anon_all_drivers" ON drivers
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- missed_calls: RLS was enabled with zero policies, blocking everything
CREATE POLICY "dashboard_anon_all_missed_calls" ON missed_calls
  FOR ALL TO anon USING (true) WITH CHECK (true);
