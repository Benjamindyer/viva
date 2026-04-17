-- Add video_url to gallery_items so Jon can paste a YouTube URL per entry.
-- When set, the homepage renders a YouTube embed instead of a static image.
ALTER TABLE gallery_items ADD COLUMN IF NOT EXISTS video_url TEXT NOT NULL DEFAULT '';
