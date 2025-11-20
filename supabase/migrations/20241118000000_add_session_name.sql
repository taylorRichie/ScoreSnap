-- Add name field to sessions table
-- Migration: 20241118000000_add_session_name

ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS name TEXT;

-- Add a comment explaining the field
COMMENT ON COLUMN public.sessions.name IS 'User-editable session name, auto-generated from date if not provided';

-- Update existing sessions to have auto-generated names based on their date_time
UPDATE public.sessions
SET name = TO_CHAR(date_time, 'Day Mon DD') || ' session'
WHERE name IS NULL;

