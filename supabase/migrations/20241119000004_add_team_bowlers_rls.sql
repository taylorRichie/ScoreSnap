-- Add RLS policies for team_bowlers table
-- This table had RLS enabled but no policies, blocking all operations

-- Team bowlers: Users can view all team_bowlers relationships
CREATE POLICY "Users can view all team_bowlers" ON public.team_bowlers
    FOR SELECT USING (true);

-- Team bowlers: Users can add bowlers to teams they created
CREATE POLICY "Users can add bowlers to their teams" ON public.team_bowlers
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.teams
            WHERE id = team_bowlers.team_id
            AND auth.uid() = created_by_user_id
        )
    );

-- Team bowlers: Users can update team_bowlers for teams they created
CREATE POLICY "Users can update their team_bowlers" ON public.team_bowlers
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.teams
            WHERE id = team_bowlers.team_id
            AND auth.uid() = created_by_user_id
        )
    );

-- Team bowlers: Users can delete team_bowlers for teams they created
CREATE POLICY "Users can remove bowlers from their teams" ON public.team_bowlers
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.teams
            WHERE id = team_bowlers.team_id
            AND auth.uid() = created_by_user_id
        )
    );

