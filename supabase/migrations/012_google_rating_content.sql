-- Seed default Google rating content keys
INSERT INTO content (key, value) VALUES
    ('google_rating',       '4.9'),
    ('google_review_count', '186'),
    ('google_stars',        '5'),
    ('google_review_url',   '')
ON CONFLICT (key) DO NOTHING;
