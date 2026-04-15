-- Add booking fee paid flag to bookings
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS booking_fee_paid BOOLEAN NOT NULL DEFAULT false;

-- Add booking fee amount + bank transfer details to settings
INSERT INTO settings (key, value) VALUES
    ('booking_fee_gbp',      '95'),
    ('bank_name',            ''),
    ('bank_sort_code',       ''),
    ('bank_account_number',  ''),
    ('bank_account_name',    '')
ON CONFLICT (key) DO NOTHING;

-- Extend public-readable settings to include payment options
DROP POLICY IF EXISTS "Public read pricing settings" ON settings;
CREATE POLICY "Public read pricing settings"
    ON settings FOR SELECT TO anon
    USING (key IN (
        'base_price_gbp', 'per_mile_pence', 'booking_fee_gbp',
        'paypal_email', 'paypal_link',
        'bank_name', 'bank_sort_code', 'bank_account_number', 'bank_account_name'
    ));
