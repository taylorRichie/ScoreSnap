-- Rename place_id to google_place_id for clarity
-- Migration: 20241119000000_rename_place_id_to_google_place_id

ALTER TABLE public.bowling_alleys 
RENAME COLUMN place_id TO google_place_id;

-- Add index on google_place_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_bowling_alleys_google_place_id 
ON public.bowling_alleys(google_place_id);

-- Add comment explaining the field
COMMENT ON COLUMN public.bowling_alleys.google_place_id IS 'Google Places API place_id for accurate location matching';

