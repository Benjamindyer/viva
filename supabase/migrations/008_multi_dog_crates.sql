-- Add dogs array to bookings
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS dogs JSONB;

-- Add per-crate-type tracking to travel_dates
ALTER TABLE travel_dates
  ADD COLUMN IF NOT EXISTS large_crates INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS small_crates INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS large_taken  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS small_taken  INTEGER NOT NULL DEFAULT 0;

-- Migrate existing dates: 2 large + rest small, derived from spots_available
UPDATE travel_dates
SET large_crates = 2,
    small_crates = GREATEST(0, spots_available - 2)
WHERE spots_available > 0;

-- Atomic crate-claiming function (replaces increment_spots_taken for new bookings)
-- Small dogs can overflow into large crates if small crates are full.
-- Returns TRUE if claim succeeded, FALSE if not enough crates available.
CREATE OR REPLACE FUNCTION claim_crates(
  p_date_id     UUID,
  p_large_count INT DEFAULT 0,
  p_small_count INT DEFAULT 0
) RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE
  v_large_free INT;
  v_small_free INT;
BEGIN
  SELECT large_crates - large_taken, small_crates - small_taken
  INTO v_large_free, v_small_free
  FROM travel_dates WHERE id = p_date_id FOR UPDATE;

  -- Enough large crates for large dogs?
  IF v_large_free < p_large_count THEN RETURN FALSE; END IF;

  -- Enough remaining free crates for small dogs?
  -- (small dogs can use leftover large crates)
  IF (v_large_free - p_large_count) + v_small_free < p_small_count THEN RETURN FALSE; END IF;

  UPDATE travel_dates SET
    large_taken  = large_taken  + p_large_count,
    small_taken  = small_taken  + p_small_count,
    spots_taken  = spots_taken  + p_large_count + p_small_count
  WHERE id = p_date_id;

  RETURN TRUE;
END;
$$;
