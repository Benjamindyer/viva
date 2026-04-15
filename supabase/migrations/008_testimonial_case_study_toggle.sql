-- Explicit toggle to publish/hide the case study on the story page
ALTER TABLE testimonials ADD COLUMN IF NOT EXISTS case_study_enabled BOOLEAN NOT NULL DEFAULT false;
