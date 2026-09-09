-- Driver compliance document tracking (driving licence, insurance, MOT).
-- Expiry dates power the compliance alerts shown on the Driver Management page.

ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS licence_expiry   date,
  ADD COLUMN IF NOT EXISTS insurance_expiry date,
  ADD COLUMN IF NOT EXISTS mot_expiry       date;
