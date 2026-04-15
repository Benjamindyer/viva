-- Helper function called by submit-booking edge function
-- to safely increment spots_taken on a travel date
CREATE OR REPLACE FUNCTION increment_spots_taken(date_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE travel_dates
  SET spots_taken = spots_taken + 1
  WHERE id = date_id
    AND spots_taken < spots_available;
END;
$$;
