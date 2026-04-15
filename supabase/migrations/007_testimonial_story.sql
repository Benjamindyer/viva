-- Add long-form story/case study text to testimonials
ALTER TABLE testimonials ADD COLUMN IF NOT EXISTS story_text TEXT NOT NULL DEFAULT '';
