-- Add original_parsed_name to series table to track what name was originally parsed
ALTER TABLE public.series ADD COLUMN IF NOT EXISTS original_parsed_name TEXT;

-- Backfill existing series with bowler's canonical name
UPDATE public.series 
SET original_parsed_name = bowlers.canonical_name
FROM public.bowlers
WHERE series.bowler_id = bowlers.id 
AND series.original_parsed_name IS NULL;

-- Create bowler_merges audit table to track merge history
CREATE TABLE IF NOT EXISTS public.bowler_merges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    series_id UUID NOT NULL REFERENCES public.series(id) ON DELETE CASCADE,
    from_bowler_id UUID NOT NULL REFERENCES public.bowlers(id) ON DELETE CASCADE,
    to_bowler_id UUID NOT NULL REFERENCES public.bowlers(id) ON DELETE CASCADE,
    original_name TEXT NOT NULL,
    session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
    merged_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    merged_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_bowler_merges_series_id ON public.bowler_merges(series_id);
CREATE INDEX IF NOT EXISTS idx_bowler_merges_from_bowler_id ON public.bowler_merges(from_bowler_id);
CREATE INDEX IF NOT EXISTS idx_bowler_merges_to_bowler_id ON public.bowler_merges(to_bowler_id);
CREATE INDEX IF NOT EXISTS idx_bowler_merges_session_id ON public.bowler_merges(session_id);
CREATE INDEX IF NOT EXISTS idx_series_original_parsed_name ON public.series(original_parsed_name);

-- Enable RLS on bowler_merges table
ALTER TABLE public.bowler_merges ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view merge history for sessions they have access to
CREATE POLICY "Users can view merge history for their sessions" ON public.bowler_merges
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.sessions
            WHERE sessions.id = bowler_merges.session_id
            AND (
                auth.uid() = sessions.created_by_user_id OR
                EXISTS (SELECT 1 FROM public.uploads WHERE session_id = sessions.id AND user_id = auth.uid())
            )
        )
    );

-- RLS Policy: Users can create merge records for sessions they created or contributed to
CREATE POLICY "Users can create merge records for their sessions" ON public.bowler_merges
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.sessions
            WHERE sessions.id = bowler_merges.session_id
            AND (
                auth.uid() = sessions.created_by_user_id OR
                EXISTS (SELECT 1 FROM public.uploads WHERE session_id = sessions.id AND user_id = auth.uid())
            )
        )
        AND auth.uid() = merged_by_user_id
    );

-- RLS Policy: Users can delete their own merge records
CREATE POLICY "Users can delete their own merge records" ON public.bowler_merges
    FOR DELETE USING (auth.uid() = merged_by_user_id);

-- Add comment
COMMENT ON TABLE public.bowler_merges IS 'Tracks history of bowler merges at the session level';
COMMENT ON COLUMN public.series.original_parsed_name IS 'The original name parsed from the scoreboard before any merges';

