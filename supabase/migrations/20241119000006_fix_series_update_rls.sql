-- Fix RLS policy on series table to allow merge operations
-- Users who have uploaded to a session should be able to update series (for merging)

DROP POLICY IF EXISTS "Users can update series for their sessions" ON public.series;

CREATE POLICY "Users can update series for their sessions" ON public.series
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.sessions
            WHERE id = series.session_id
            AND (
                auth.uid() = created_by_user_id OR
                EXISTS (SELECT 1 FROM public.uploads WHERE session_id = sessions.id AND user_id = auth.uid())
            )
        )
    );

-- Add comment explaining the policy
COMMENT ON POLICY "Users can update series for their sessions" ON public.series IS 
'Allows users to update series for sessions they created or have uploaded to. This enables bowler merge functionality.';

