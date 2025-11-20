-- Add GPS coordinates to sessions table for better session matching
-- Migration: 20241118000001_add_session_gps

ALTER TABLE public.sessions 
ADD COLUMN IF NOT EXISTS gps_latitude DECIMAL(10,8),
ADD COLUMN IF NOT EXISTS gps_longitude DECIMAL(11,8);

-- Add comment explaining the fields
COMMENT ON COLUMN public.sessions.gps_latitude IS 'GPS latitude from upload EXIF data, used for session matching';
COMMENT ON COLUMN public.sessions.gps_longitude IS 'GPS longitude from upload EXIF data, used for session matching';

-- Add index for GPS-based queries
CREATE INDEX IF NOT EXISTS idx_sessions_gps ON public.sessions(gps_latitude, gps_longitude);

