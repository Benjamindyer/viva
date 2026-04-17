-- Seed default content for The Man / Plan / Van cards.
-- These replace the old about_* keys which are no longer used on the homepage.
INSERT INTO content (key, value) VALUES
  ('mvp_man_desc',  'One driver. Jon knows your dog''s name before departure. You speak to the same person from first enquiry to doorstep delivery — not a call centre, not a relay of strangers.'),
  ('mvp_plan_desc', 'Transparent pricing. DEFRA compliant. AHC paperwork guidance included. No hidden costs, no nasty surprises at the border. You know exactly what you''re paying and why.'),
  ('mvp_van_desc',  'Climate-controlled, GPS tracked, individual crates, regular rest stops. Your dog travels in comfort — not in a cage in the dark — with updates sent throughout the journey.')
ON CONFLICT (key) DO NOTHING;
