-- Add video and full photo support to testimonials
ALTER TABLE testimonials ADD COLUMN IF NOT EXISTS video_url TEXT NOT NULL DEFAULT '';
ALTER TABLE testimonials ADD COLUMN IF NOT EXISTS photo_url TEXT NOT NULL DEFAULT '';
