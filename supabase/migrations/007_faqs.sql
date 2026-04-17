-- FAQs table
CREATE TABLE IF NOT EXISTS faqs (
    id         UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
    question   TEXT    NOT NULL DEFAULT '',
    answer     TEXT    NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    active     BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE faqs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Public read faqs" ON faqs FOR SELECT TO anon USING (active = true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Seed default FAQs
INSERT INTO faqs (question, answer, sort_order) VALUES
  ('What documents does my dog need to travel between Spain and the UK?',
   'Post-Brexit, dogs travelling from Spain to the UK need: a microchip, a valid rabies vaccination, an Animal Health Certificate (AHC) issued by an Official Veterinarian within 10 days of travel, and a tapeworm treatment (given 1–5 days before arrival in the UK). We can guide you through exactly what''s needed for your dog''s journey.',
   1),
  ('How long does the journey take?',
   'The full door-to-door journey is typically 24–36 hours depending on your pickup and delivery locations. We make regular comfort stops every 2–3 hours so your dog can stretch, toilet, and have water. We never rush — your dog''s comfort always comes first.',
   2),
  ('How many dogs travel per trip?',
   'We keep numbers low to ensure every dog gets individual attention and care throughout the journey. Each dog travels in their own individual crate in a climate-controlled van.',
   3),
  ('How will I know how my dog is doing during the journey?',
   'We send regular photo and video updates via WhatsApp throughout the entire journey, so you always know your dog is safe and happy. You''ll never be left wondering.',
   4),
  ('My dog is nervous or anxious — can you still help?',
   'Absolutely. Please let us know in advance and we''ll take extra care to make the journey as calm as possible. Bringing a familiar blanket or toy can also really help. We''ve transported many nervous dogs and know how to keep them settled.',
   5),
  ('What areas do you collect from and deliver to?',
   'We cover all of Spain and mainland UK. Use our booking tool to enter your specific addresses and we''ll calculate the exact route and price for you.',
   6)
ON CONFLICT DO NOTHING;
