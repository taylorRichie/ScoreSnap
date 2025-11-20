-- Fix infinite recursion in RLS policies by simplifying them
-- The issue is that policies were referencing other tables that also have policies
-- causing circular dependencies

-- Drop all existing policies first
DROP POLICY IF EXISTS "Anyone can view bowlers" ON public.bowlers;
DROP POLICY IF EXISTS "Anyone can view sessions" ON public.sessions;
DROP POLICY IF EXISTS "Anyone can view series" ON public.series;
DROP POLICY IF EXISTS "Anyone can view games" ON public.games;
DROP POLICY IF EXISTS "Anyone can view frames" ON public.frames;
DROP POLICY IF EXISTS "Anyone can view teams" ON public.teams;
DROP POLICY IF EXISTS "Anyone can view team_bowlers" ON public.team_bowlers;
DROP POLICY IF EXISTS "Anyone can view bowling_alleys" ON public.bowling_alleys;

-- Recreate with simple, non-recursive policies
-- Bowlers: Public read
CREATE POLICY "Public can read bowlers" ON public.bowlers
  FOR SELECT USING (true);

-- Sessions: Public read
CREATE POLICY "Public can read sessions" ON public.sessions
  FOR SELECT USING (true);

-- Series: Public read
CREATE POLICY "Public can read series" ON public.series
  FOR SELECT USING (true);

-- Games: Public read
CREATE POLICY "Public can read games" ON public.games
  FOR SELECT USING (true);

-- Frames: Public read
CREATE POLICY "Public can read frames" ON public.frames
  FOR SELECT USING (true);

-- Teams: Public read
CREATE POLICY "Public can read teams" ON public.teams
  FOR SELECT USING (true);

-- Team Bowlers: Public read
CREATE POLICY "Public can read team_bowlers" ON public.team_bowlers
  FOR SELECT USING (true);

-- Bowling Alleys: Public read
CREATE POLICY "Public can read bowling_alleys" ON public.bowling_alleys
  FOR SELECT USING (true);

-- Note: All write operations (INSERT, UPDATE, DELETE) remain protected
-- by existing policies that check authentication

