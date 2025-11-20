-- Fix GPS coordinates for Western Hemisphere (USA)
-- Migration: 20241119000001_fix_western_hemisphere_gps
-- 
-- Problem: GPS coordinates were parsed without hemisphere reference,
-- causing Western longitudes to be positive instead of negative.
--
-- This migration fixes:
-- - Uploads table: exif_location_lng
-- - Sessions table: gps_longitude
-- - Bowling alleys table: longitude
--
-- Safety: Only affects coordinates in range 70-180 (clearly Western Hemisphere)

-- Fix uploads table
-- Western Hemisphere longitude should be negative (USA, Canada, South America)
UPDATE public.uploads
SET exif_location_lng = -exif_location_lng
WHERE exif_location_lng > 0           -- Currently positive (wrong)
  AND exif_location_lng >= 70         -- Western Hemisphere range (70°W to 180°W)
  AND exif_location_lng <= 180
  AND exif_location_lat IS NOT NULL  -- Has latitude (sanity check)
  AND exif_location_lat >= 20         -- Reasonable latitude for USA/Canada (20°N to 70°N)
  AND exif_location_lat <= 70;

-- Fix sessions table (has gps_latitude and gps_longitude columns)
UPDATE public.sessions
SET gps_longitude = -gps_longitude
WHERE gps_longitude > 0
  AND gps_longitude >= 70
  AND gps_longitude <= 180
  AND gps_latitude IS NOT NULL
  AND gps_latitude >= 20
  AND gps_latitude <= 70;

-- Fix bowling_alleys table
UPDATE public.bowling_alleys
SET longitude = -longitude
WHERE longitude > 0
  AND longitude >= 70
  AND longitude <= 180
  AND latitude IS NOT NULL
  AND latitude >= 20
  AND latitude <= 70;

-- Show results
DO $$
DECLARE
  uploads_fixed INTEGER;
  sessions_fixed INTEGER;
  alleys_fixed INTEGER;
BEGIN
  SELECT COUNT(*) INTO uploads_fixed 
  FROM public.uploads 
  WHERE exif_location_lng < 0 
    AND exif_location_lng >= -180 
    AND exif_location_lng <= -70;
  
  SELECT COUNT(*) INTO sessions_fixed 
  FROM public.sessions 
  WHERE gps_longitude < 0 
    AND gps_longitude >= -180 
    AND gps_longitude <= -70;
  
  SELECT COUNT(*) INTO alleys_fixed 
  FROM public.bowling_alleys 
  WHERE longitude < 0 
    AND longitude >= -180 
    AND longitude <= -70;
  
  RAISE NOTICE 'GPS Coordinate Fix Summary:';
  RAISE NOTICE '  Uploads fixed: %', uploads_fixed;
  RAISE NOTICE '  Sessions fixed: %', sessions_fixed;
  RAISE NOTICE '  Bowling alleys fixed: %', alleys_fixed;
END $$;

