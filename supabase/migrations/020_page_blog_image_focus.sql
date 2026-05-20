-- Focal point for CMS page heroes and blog featured images (percent 0–100, center default)
ALTER TABLE pages ADD COLUMN IF NOT EXISTS focus_x real DEFAULT 50;
ALTER TABLE pages ADD COLUMN IF NOT EXISTS focus_y real DEFAULT 50;

ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS focus_x real DEFAULT 50;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS focus_y real DEFAULT 50;
