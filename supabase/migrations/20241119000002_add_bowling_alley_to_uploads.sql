-- Add bowling alley info to uploads table
-- Migration: 20241119000002_add_bowling_alley_to_uploads
--
-- Purpose: Store the identified bowling alley with each upload so it can be
-- displayed on the debug page without needing to re-identify

ALTER TABLE public.uploads 
ADD COLUMN IF NOT EXISTS identified_bowling_alley_id UUID REFERENCES public.bowling_alleys(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS identified_bowling_alley_name TEXT;

-- Add comment explaining the fields
COMMENT ON COLUMN public.uploads.identified_bowling_alley_id IS 'Bowling alley automatically identified from GPS coordinates during upload';
COMMENT ON COLUMN public.uploads.identified_bowling_alley_name IS 'Name of bowling alley (cached for display)';

-- Add index for queries
CREATE INDEX IF NOT EXISTS idx_uploads_bowling_alley ON public.uploads(identified_bowling_alley_id);

