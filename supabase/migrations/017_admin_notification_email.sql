-- ============================================================
-- Viva Espaniel — Admin-editable notification emails + contact form
-- ============================================================

-- Seed default notification email settings in existing content table
INSERT INTO content (key, value) VALUES
  -- Where new bookings + contact form submissions are sent
  ('admin_notification_email', 'vivaespaniel@gmail.com'),
  -- What customers see in the reply-to header
  ('admin_reply_to_email',     'vivaespaniel@gmail.com'),
  -- Inbox that receives contact-form submissions specifically
  ('contact_form_to_email',    'vivaespaniel@gmail.com')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- Contact form submissions log
-- ============================================================
CREATE TABLE IF NOT EXISTS contact_submissions (
    id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    name       TEXT        NOT NULL DEFAULT '',
    email      TEXT        NOT NULL DEFAULT '',
    phone      TEXT        NOT NULL DEFAULT '',
    subject    TEXT        NOT NULL DEFAULT '',
    message    TEXT        NOT NULL DEFAULT '',
    ip         TEXT        NOT NULL DEFAULT '',
    user_agent TEXT        NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contact_submissions_created_at_idx
    ON contact_submissions (created_at DESC);

-- Lock table down — only the service role (used by edge functions + admin) can read/write
ALTER TABLE contact_submissions ENABLE ROW LEVEL SECURITY;
-- No anon policies → public cannot read or write directly; edge functions use service role key.
