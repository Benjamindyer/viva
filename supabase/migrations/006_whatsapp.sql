-- Add WhatsApp contact settings
INSERT INTO settings (key, value) VALUES
    ('whatsapp_number',  ''),
    ('whatsapp_enabled', 'false')
ON CONFLICT (key) DO NOTHING;

-- Extend public-readable settings to include WhatsApp
DROP POLICY IF EXISTS "Public read pricing settings" ON settings;
CREATE POLICY "Public read pricing settings"
    ON settings FOR SELECT TO anon
    USING (key IN (
        'base_price_gbp', 'per_mile_pence', 'booking_fee_gbp',
        'paypal_email', 'paypal_link',
        'bank_name', 'bank_sort_code', 'bank_account_number', 'bank_account_name',
        'whatsapp_number', 'whatsapp_enabled'
    ));
