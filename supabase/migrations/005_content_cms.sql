-- ============================================================
-- Viva Españiel — CMS content tables
-- ============================================================

-- Key/value store for hero, about, trust cards, footer, meta
CREATE TABLE IF NOT EXISTS content (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Testimonials (variable count, managed in admin)
CREATE TABLE IF NOT EXISTS testimonials (
    id         UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
    name       TEXT    NOT NULL DEFAULT '',
    location   TEXT    NOT NULL DEFAULT '',
    quote      TEXT    NOT NULL DEFAULT '',
    stars      INTEGER NOT NULL DEFAULT 5 CHECK (stars BETWEEN 1 AND 5),
    avatar_url TEXT    NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    active     BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Gallery items (variable count, managed in admin)
CREATE TABLE IF NOT EXISTS gallery_items (
    id         UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
    dog_name   TEXT    NOT NULL DEFAULT '',
    route      TEXT    NOT NULL DEFAULT '',
    image_url  TEXT    NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    active     BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE content       ENABLE ROW LEVEL SECURITY;
ALTER TABLE testimonials  ENABLE ROW LEVEL SECURITY;
ALTER TABLE gallery_items ENABLE ROW LEVEL SECURITY;

-- Public can read all (no sensitive data in these tables)
DO $$ BEGIN
  CREATE POLICY "Public read content" ON content FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Public read testimonials" ON testimonials FOR SELECT TO anon USING (active = true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Public read gallery" ON gallery_items FOR SELECT TO anon USING (active = true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Seed default content (from current hardcoded HTML)
INSERT INTO content (key, value) VALUES
  ('hero_badge',       '🇬🇧 UK ↔ Spain ↔ UK 🇪🇸 British Dog Transport'),
  ('hero_headline',    'Safe Journeys for Your Furry Family'),
  ('hero_tagline',     'A British company reuniting dogs with their families between the UK and Spain — in both directions. Every paw-senger travels in comfort and safety.'),
  ('hero_image_url',   'https://images.unsplash.com/photo-1530281700549-e82e7bf110d6?w=800&q=80'),
  ('about_photo_url',  'jon-brown.png'),
  ('about_subtitle',   'Meet The Founder'),
  ('about_name',       'Jon Brown'),
  ('about_bio1',       'With over 16 years in the transport industry, Jon has dedicated his career to reuniting families with their four-legged loved ones. What started as a passion project has grown into a trusted service that''s helped thousands of dogs make the journey between Spain and the UK safely.'),
  ('about_bio2',       'Jon personally oversees every transport, ensuring the highest standards of care from pickup to delivery. His hands-on approach and genuine love for animals is what sets Viva Españiel apart.'),
  ('about_quote',      'Every dog that travels with us becomes part of our family for the journey. I understand how much trust people place in us, and I take that responsibility seriously. These aren''t just pets – they''re family members, and they deserve to travel in comfort and safety.'),
  ('about_years',      '16+'),
  ('trust_1_title',    'Vet Approved'),
  ('trust_1_desc',     'Health checks before and after every journey'),
  ('trust_1_image',    'https://images.unsplash.com/photo-1628009368231-7bb7cfcb0def?w=200&q=80'),
  ('trust_2_title',    'Climate Controlled'),
  ('trust_2_desc',     'AC and heating for maximum comfort'),
  ('trust_2_image',    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=200&q=80'),
  ('trust_3_title',    'Live Tracking'),
  ('trust_3_desc',     'Real-time updates and photos'),
  ('trust_3_image',    'https://images.unsplash.com/photo-1596492784531-6e6eb5ea9993?w=200&q=80'),
  ('trust_4_title',    'Regular Stops'),
  ('trust_4_desc',     'Comfort breaks every 2-3 hours'),
  ('trust_4_image',    'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=200&q=80'),
  ('footer_tagline',   'Reuniting dogs with their families since 2019. Made with love and plenty of treats.'),
  ('meta_title',       'Viva Españiel — Dog Transport Spain ↔ UK'),
  ('meta_description', 'Professional dog transport between Spain and the UK. Door-to-door service, climate-controlled vans, live updates and regular stops. Book your dog''s journey today.')
ON CONFLICT (key) DO NOTHING;

-- Seed default testimonials
INSERT INTO testimonials (name, location, quote, stars, avatar_url, sort_order) VALUES
  ('Sarah Mitchell', 'Manchester', 'Luna arrived safe and sound! The team sent photos every few hours. Can''t recommend enough!',                                        5, 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80', 1),
  ('James Thompson', 'Bristol',    'We rescued Pablo from Valencia. They handled everything - paperwork, journey, everything. 10/10!',                                   5, 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80', 2),
  ('Emma Watson',    'Edinburgh',  'Churro was treated like royalty - climate controlled van, regular stops, constant updates!',                                         5, 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&q=80', 3)
ON CONFLICT DO NOTHING;

-- Seed default gallery items
INSERT INTO gallery_items (dog_name, route, image_url, sort_order) VALUES
  ('Luna',    'Galgo • Murcia → Manchester',     'https://images.unsplash.com/photo-1477884213360-7e9d7dcc1e48?w=800&q=80', 1),
  ('Max',     'Podenco • Valencia → London',      'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400&q=80', 2),
  ('Bella',   'Mixed • Seville → Bristol',        'https://images.unsplash.com/photo-1517849845537-4d257902454a?w=400&q=80', 3),
  ('Charlie', 'Golden • Madrid → Edinburgh',      'https://images.unsplash.com/photo-1552053831-71594a27632d?w=400&q=80', 4),
  ('Rocky',   'Bulldog • Barcelona → Birmingham', 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=400&q=80', 5)
ON CONFLICT DO NOTHING;
