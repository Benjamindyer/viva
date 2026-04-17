-- Fix crate allocation accounting:
-- small dogs should use small crates first, then overflow to large crates.
-- Overflow must increment large_taken so large-dog availability stays accurate.
CREATE OR REPLACE FUNCTION claim_crates(
  p_date_id      UUID,
  p_large_count  INT DEFAULT 0,
  p_small_count  INT DEFAULT 0
) RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE
  v_large_free INT;
  v_small_free INT;
  v_small_in_small INT;
  v_small_in_large INT;
BEGIN
  SELECT large_crates - large_taken, small_crates - small_taken
  INTO v_large_free, v_small_free
  FROM travel_dates
  WHERE id = p_date_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Large dogs must always use large crates.
  IF v_large_free < p_large_count THEN
    RETURN FALSE;
  END IF;

  -- Small dogs can use small crates, then overflow into any leftover large crates.
  IF (v_large_free - p_large_count) + v_small_free < p_small_count THEN
    RETURN FALSE;
  END IF;

  v_small_in_small := LEAST(v_small_free, p_small_count);
  v_small_in_large := GREATEST(0, p_small_count - v_small_in_small);

  UPDATE travel_dates
  SET
    large_taken = large_taken + p_large_count + v_small_in_large,
    small_taken = small_taken + v_small_in_small,
    spots_taken = spots_taken + p_large_count + p_small_count
  WHERE id = p_date_id;

  RETURN TRUE;
END;
$$;
