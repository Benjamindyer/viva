-- Add Spanish address fields to bookings
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS spain_address         TEXT,
  ADD COLUMN IF NOT EXISTS spain_address_display TEXT;
