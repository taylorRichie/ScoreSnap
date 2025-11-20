-- Add file_hash column to uploads table for duplicate detection
-- This prevents wasting API credits on identical image uploads

ALTER TABLE public.uploads
ADD COLUMN IF NOT EXISTS file_hash TEXT;

-- Create index for fast duplicate lookups
CREATE INDEX IF NOT EXISTS idx_uploads_file_hash ON public.uploads(file_hash);

-- Add comment for documentation
COMMENT ON COLUMN public.uploads.file_hash IS 'SHA-256 hash of the uploaded file content for duplicate detection';

