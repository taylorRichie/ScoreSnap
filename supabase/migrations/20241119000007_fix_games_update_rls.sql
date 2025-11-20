-- Fix RLS policy on games table to allow merge operations
-- Users who have uploaded to a session should be able to update games (for merging)

DROP POLICY IF EXISTS "Users can update games for their series" ON public.games;

CREATE POLICY "Users can update games for their series" ON public.games
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.series
            JOIN public.sessions ON series.session_id = sessions.id
            WHERE series.id = games.series_id
            AND (
                auth.uid() = sessions.created_by_user_id OR
                EXISTS (SELECT 1 FROM public.uploads WHERE session_id = sessions.id AND user_id = auth.uid())
            )
        )
    );

-- Add comment explaining the policy
COMMENT ON POLICY "Users can update games for their series" ON public.games IS 
'Allows users to update games for sessions they created or have uploaded to. This enables bowler merge functionality.';

