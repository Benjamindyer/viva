-- Allow Jon to manually mark a travel date as full
-- (e.g. for bookings taken outside the system)
ALTER TABLE travel_dates
  ADD COLUMN IF NOT EXISTS manually_closed BOOLEAN NOT NULL DEFAULT FALSE;
