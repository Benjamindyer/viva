-- Hero carousel image focal point (percent 0–100, center default)
ALTER TABLE hero_images ADD COLUMN IF NOT EXISTS focus_x real DEFAULT 50;
ALTER TABLE hero_images ADD COLUMN IF NOT EXISTS focus_y real DEFAULT 50;
