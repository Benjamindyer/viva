-- Email template blocks stored in the content table.
-- Variables: {first_name} {dog_name} {reference} {deposit} {balance} {direction} {travel_date}
INSERT INTO content (key, value) VALUES

  -- ── Booking request received (auto-sent to customer on submission) ──────────
  ('email_request_subject',
   'Booking request received — {reference}'),

  ('email_request_intro',
   'We''ve received your booking request for {dog_name}. Jon will review your details and be in touch within 24 hours to confirm and send payment instructions.'),

  ('email_request_footer',
   'Please do not make any travel arrangements until you receive confirmation from Jon.'),

  -- ── Payment details / booking confirmed (sent manually by Jon) ──────────────
  ('email_payment_subject',
   'Your Viva Españiel booking is confirmed — {reference}'),

  ('email_payment_intro',
   'Jon has reviewed your booking request for {dog_name} and is pleased to confirm it. To secure your spot, please pay the 50% deposit using the details below.'),

  ('email_payment_note',
   'Please include your reference number {reference} as the PayPal payment note. Your spot is not confirmed until the deposit is received.'),

  ('email_payment_footer',
   'The balance of {balance} is collected on delivery of {dog_name}. Any questions? Reply to this email and Jon will be in touch.')

ON CONFLICT (key) DO NOTHING;
