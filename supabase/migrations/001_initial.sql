-- ============================================================
-- Viva Españiel — initial schema
-- Run this in the Supabase SQL editor after creating the project
-- ============================================================

-- Settings: key/value store for Jon to manage pricing etc.
CREATE TABLE IF NOT EXISTS settings (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL,
    updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Seed default settings
INSERT INTO settings (key, value) VALUES
    ('base_price_gbp',  '495'),
    ('per_mile_pence',  '50'),
    ('deposit_percent', '50'),
    ('paypal_email',    ''),
    ('paypal_link',     '')
ON CONFLICT (key) DO NOTHING;

-- Travel dates: Jon manages these in admin
CREATE TABLE IF NOT EXISTS travel_dates (
    id               UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
    departure_date   DATE    NOT NULL,
    direction        TEXT    NOT NULL CHECK (direction IN ('uk_to_spain', 'spain_to_uk', 'both')),
    spots_available  INTEGER NOT NULL DEFAULT 6,
    spots_taken      INTEGER NOT NULL DEFAULT 0,
    active           BOOLEAN NOT NULL DEFAULT true,
    notes            TEXT,
    created_at       TIMESTAMPTZ DEFAULT now()
);

-- Bookings
CREATE TABLE IF NOT EXISTS bookings (
    id                  UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
    reference           TEXT    UNIQUE NOT NULL,
    created_at          TIMESTAMPTZ DEFAULT now(),

    -- Journey
    direction           TEXT    NOT NULL CHECK (direction IN ('uk_to_spain', 'spain_to_uk')),
    travel_date_id      UUID    REFERENCES travel_dates(id),
    travel_date_display TEXT,

    -- Customer
    first_name          TEXT    NOT NULL,
    last_name           TEXT    NOT NULL,
    email               TEXT    NOT NULL,
    phone               TEXT,

    -- Dog
    dog_name            TEXT    NOT NULL,
    breed               TEXT,
    breed_display       TEXT,
    size                TEXT,

    -- Route
    uk_address          TEXT,
    uk_address_display  TEXT,
    miles_from_dover    NUMERIC,

    -- Pricing (locked at submission time)
    base_price_gbp      NUMERIC NOT NULL,
    mileage_cost_gbp    NUMERIC NOT NULL DEFAULT 0,
    total_price_gbp     NUMERIC NOT NULL,
    deposit_gbp         NUMERIC NOT NULL,
    balance_gbp         NUMERIC NOT NULL,

    -- Admin
    status              TEXT    NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending','approved','deposit_sent','deposit_received','in_transit','completed','cancelled')),
    admin_notes         TEXT    DEFAULT ''
);

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE settings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings     ENABLE ROW LEVEL SECURITY;

-- Settings: public can read pricing (not internal keys)
CREATE POLICY "Public read pricing settings"
    ON settings FOR SELECT TO anon
    USING (key IN ('base_price_gbp', 'per_mile_pence', 'deposit_percent'));

-- Travel dates: public can read active dates
CREATE POLICY "Public read active travel dates"
    ON travel_dates FOR SELECT TO anon
    USING (active = true);

-- Bookings: public can INSERT only (status defaults to 'pending')
CREATE POLICY "Public submit bookings"
    ON bookings FOR INSERT TO anon
    WITH CHECK (true);

-- Service role bypasses all RLS automatically (used in Edge Functions)
