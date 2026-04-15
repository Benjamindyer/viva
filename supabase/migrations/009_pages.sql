-- Custom pages (up to 3) for Jon to manage via admin
CREATE TABLE IF NOT EXISTS pages (
    id             UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
    title          TEXT    NOT NULL DEFAULT '',
    slug           TEXT    NOT NULL DEFAULT '',
    nav_label      TEXT    NOT NULL DEFAULT '',
    status         TEXT    NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'live', 'hidden')),
    hero_image_url TEXT    NOT NULL DEFAULT '',
    body_html      TEXT    NOT NULL DEFAULT '',
    video_url      TEXT    NOT NULL DEFAULT '',
    meta_title     TEXT    NOT NULL DEFAULT '',
    meta_description TEXT  NOT NULL DEFAULT '',
    sort_order     INTEGER NOT NULL DEFAULT 0,
    created_at     TIMESTAMPTZ DEFAULT now(),
    updated_at     TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE pages ENABLE ROW LEVEL SECURITY;

-- Anon can read live + hidden pages (hidden = accessible by URL, just not in nav)
DO $$ BEGIN
  CREATE POLICY "Public read published pages" ON pages FOR SELECT TO anon USING (status IN ('live', 'hidden'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
