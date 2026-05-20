-- ============================================================
-- Viva Espaniel — Hero carousel images
-- ============================================================
-- A list of images shown as a rotating carousel in the homepage
-- hero section. Managed by admin via the admin-bookings edge function.

CREATE TABLE IF NOT EXISTS hero_images (
    id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    image_url  TEXT        NOT NULL DEFAULT '',
    alt_text   TEXT        NOT NULL DEFAULT '',
    caption    TEXT        NOT NULL DEFAULT '',
    sort_order INTEGER     NOT NULL DEFAULT 0,
    active     BOOLEAN     NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hero_images_sort_order_idx
    ON hero_images (sort_order);

-- RLS — public read for active rows, writes service-role-only (matches gallery_items pattern)
ALTER TABLE hero_images ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Public read hero_images"
    ON hero_images FOR SELECT TO anon USING (active = true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Seed: one row pointing at the current static hero image so the carousel
-- renders something before Jon uploads new images.
INSERT INTO hero_images (image_url, alt_text, sort_order, active)
SELECT value,
       'Dog safely transported from Spain to UK by Viva Espaniel',
       1,
       true
FROM content
WHERE key = 'hero_image_url'
  AND value <> ''
  AND NOT EXISTS (SELECT 1 FROM hero_images)
ON CONFLICT DO NOTHING;
