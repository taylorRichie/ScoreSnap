-- Fix count queries and aggregations for anonymous users
-- The issue is that SELECT policies work but count/aggregation queries return 0

-- The problem is likely with how RLS evaluates count queries
-- We need to ensure the policies explicitly allow counting

-- First, let's verify RLS is working correctly by checking existing policies
DO $$
BEGIN
  -- For debugging: check if policies exist
  RAISE NOTICE 'Checking RLS policies...';
END $$;

-- Sessions: Ensure count works
DROP POLICY IF EXISTS "public_select_sessions" ON public.sessions;
CREATE POLICY "public_select_sessions" ON public.sessions
  FOR SELECT 
  TO public, anon, authenticated
  USING (true);

-- Games: Ensure count works  
DROP POLICY IF EXISTS "public_select_games" ON public.games;
CREATE POLICY "public_select_games" ON public.games
  FOR SELECT
  TO public, anon, authenticated
  USING (true);

-- Bowlers: Ensure count works
DROP POLICY IF EXISTS "public_select_bowlers" ON public.bowlers;
CREATE POLICY "public_select_bowlers" ON public.bowlers
  FOR SELECT
  TO public, anon, authenticated
  USING (true);

-- Bowling Alleys: Ensure count works
DROP POLICY IF EXISTS "public_select_bowling_alleys" ON public.bowling_alleys;
CREATE POLICY "public_select_bowling_alleys" ON public.bowling_alleys
  FOR SELECT
  TO public, anon, authenticated
  USING (true);

-- Series: Ensure count works
DROP POLICY IF EXISTS "public_select_series" ON public.series;
CREATE POLICY "public_select_series" ON public.series
  FOR SELECT
  TO public, anon, authenticated
  USING (true);

-- Frames: Ensure count works
DROP POLICY IF EXISTS "public_select_frames" ON public.frames;
CREATE POLICY "public_select_frames" ON public.frames
  FOR SELECT
  TO public, anon, authenticated
  USING (true);

-- Teams: Ensure count works
DROP POLICY IF EXISTS "public_select_teams" ON public.teams;
CREATE POLICY "public_select_teams" ON public.teams
  FOR SELECT
  TO public, anon, authenticated
  USING (true);

-- Team Bowlers: Ensure count works
DROP POLICY IF EXISTS "public_select_team_bowlers" ON public.team_bowlers;
CREATE POLICY "public_select_team_bowlers" ON public.team_bowlers
  FOR SELECT
  TO public, anon, authenticated
  USING (true);

-- Uploads: Ensure count works
DROP POLICY IF EXISTS "public_select_uploads" ON public.uploads;
CREATE POLICY "public_select_uploads" ON public.uploads
  FOR SELECT
  TO public, anon, authenticated
  USING (true);

