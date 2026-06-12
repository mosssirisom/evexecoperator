-- Audit trail for operator actions on bookings, drivers and missed calls.
-- Lets the team see who changed, cancelled or reassigned a booking and when.

CREATE TABLE IF NOT EXISTS audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid,
  actor_email text,
  action      text not null,
  entity_type text not null,
  entity_id   text not null,
  details     jsonb,
  created_at  timestamptz default now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at desc);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity      ON audit_log(entity_type, entity_id);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log_service_bypass" ON audit_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "audit_log_authenticated_all" ON audit_log
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Anon read/write matches the existing dashboard stopgap (see
-- 003_anon_dashboard_access.sql) so a deployment still mid-rollout of operator
-- auth can keep recording activity. Remove alongside that migration once every
-- operator dashboard is signed in.
CREATE POLICY "audit_log_anon_all" ON audit_log
  FOR ALL TO anon USING (true) WITH CHECK (true);
