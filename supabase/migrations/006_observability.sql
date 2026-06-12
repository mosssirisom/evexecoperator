-- Observability: client-side error log, plus server-side analytics
-- aggregates that cover the full bookings table (not just a client's
-- currently-loaded page).

-- ─── Error log ──────────────────────────────────────────────────────────────
-- Captures uncaught render errors (via ErrorBoundary) and global JS
-- exceptions/unhandled promise rejections, so operators/devs can spot
-- recurring issues without needing browser console access.

CREATE TABLE IF NOT EXISTS error_log (
  id               uuid primary key default gen_random_uuid(),
  message          text not null,
  stack            text,
  component_stack  text,
  url              text,
  user_email       text,
  context          jsonb,
  created_at       timestamptz default now()
);

CREATE INDEX IF NOT EXISTS idx_error_log_created_at ON error_log(created_at desc);

ALTER TABLE error_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "error_log_service_bypass" ON error_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "error_log_authenticated_all" ON error_log
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Anon read/write matches the existing dashboard stopgap (see
-- 003_anon_dashboard_access.sql) so a deployment still mid-rollout of operator
-- auth can keep recording errors. Remove alongside that migration once every
-- operator dashboard is signed in.
CREATE POLICY "error_log_anon_all" ON error_log
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- ─── Server-side analytics aggregates ─────────────────────────────────────────
-- The Analytics page paginates bookings client-side (capped for very large
-- datasets). These functions aggregate across the entire table server-side so
-- "All Time" totals stay accurate regardless of how many bookings the client
-- has loaded.

CREATE OR REPLACE FUNCTION get_booking_totals(since timestamptz DEFAULT NULL)
RETURNS TABLE (
  total_bookings     bigint,
  completed_bookings bigint,
  cancelled_bookings bigint,
  total_revenue      numeric,
  unique_customers   bigint
)
LANGUAGE sql STABLE AS $$
  SELECT
    count(*)                                                          AS total_bookings,
    count(*) FILTER (WHERE status = 'Completed')                      AS completed_bookings,
    count(*) FILTER (WHERE status = 'Cancelled')                      AS cancelled_bookings,
    coalesce(sum(price) FILTER (WHERE status = 'Completed'), 0)       AS total_revenue,
    count(DISTINCT coalesce(customer_phone, customer_name))           AS unique_customers
  FROM bookings
  WHERE since IS NULL OR pickup_time >= since;
$$;

CREATE OR REPLACE FUNCTION get_booking_status_breakdown(since timestamptz DEFAULT NULL)
RETURNS TABLE (status text, count bigint)
LANGUAGE sql STABLE AS $$
  SELECT status, count(*) AS count
  FROM bookings
  WHERE since IS NULL OR pickup_time >= since
  GROUP BY status
  ORDER BY count DESC;
$$;

GRANT EXECUTE ON FUNCTION get_booking_totals(timestamptz)            TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_booking_status_breakdown(timestamptz)  TO anon, authenticated;
