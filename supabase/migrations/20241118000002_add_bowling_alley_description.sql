-- Add description column to bowling_alleys table
-- Migration: 20241118000002_add_bowling_alley_description

ALTER TABLE public.bowling_alleys 
ADD COLUMN IF NOT EXISTS description TEXT;

-- Add comment explaining the field
COMMENT ON COLUMN public.bowling_alleys.description IS 'Description of the bowling alley from AI or user input';

