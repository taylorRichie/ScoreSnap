-- Clean up ALL existing SELECT policies to prevent conflicts
-- Drop all possible variations of SELECT policies that may exist

-- Bowlers
DROP POLICY IF EXISTS "Users can view all bowlers" ON public.bowlers;
DROP POLICY IF EXISTS "Anyone can view bowlers" ON public.bowlers;
DROP POLICY IF EXISTS "Public can read bowlers" ON public.bowlers;

-- Sessions
DROP POLICY IF EXISTS "Users can view sessions they have access to" ON public.sessions;
DROP POLICY IF EXISTS "Users can view sessions they created or uploaded to" ON public.sessions;
DROP POLICY IF EXISTS "Users can view sessions" ON public.sessions;
DROP POLICY IF EXISTS "Anyone can view sessions" ON public.sessions;
DROP POLICY IF EXISTS "Public can read sessions" ON public.sessions;

-- Series
DROP POLICY IF EXISTS "Users can view series for accessible sessions" ON public.series;
DROP POLICY IF EXISTS "Users can view series for their sessions" ON public.series;
DROP POLICY IF EXISTS "Users can view series" ON public.series;
DROP POLICY IF EXISTS "Anyone can view series" ON public.series;
DROP POLICY IF EXISTS "Public can read series" ON public.series;

-- Games
DROP POLICY IF EXISTS "Users can view games for series they have access to" ON public.games;
DROP POLICY IF EXISTS "Users can view games for their sessions" ON public.games;
DROP POLICY IF EXISTS "Users can view games" ON public.games;
DROP POLICY IF EXISTS "Anyone can view games" ON public.games;
DROP POLICY IF EXISTS "Public can read games" ON public.games;

-- Frames
DROP POLICY IF EXISTS "Users can view frames for games they have access to" ON public.frames;
DROP POLICY IF EXISTS "Users can view frames" ON public.frames;
DROP POLICY IF EXISTS "Anyone can view frames" ON public.frames;
DROP POLICY IF EXISTS "Public can read frames" ON public.frames;

-- Teams
DROP POLICY IF EXISTS "Users can view teams" ON public.teams;
DROP POLICY IF EXISTS "Anyone can view teams" ON public.teams;
DROP POLICY IF EXISTS "Public can read teams" ON public.teams;

-- Team Bowlers
DROP POLICY IF EXISTS "Users can view all team_bowlers" ON public.team_bowlers;
DROP POLICY IF EXISTS "Users can view team bowlers" ON public.team_bowlers;
DROP POLICY IF EXISTS "Anyone can view team_bowlers" ON public.team_bowlers;
DROP POLICY IF EXISTS "Public can read team_bowlers" ON public.team_bowlers;

-- Bowling Alleys
DROP POLICY IF EXISTS "Users can view bowling alleys" ON public.bowling_alleys;
DROP POLICY IF EXISTS "Anyone can view bowling_alleys" ON public.bowling_alleys;
DROP POLICY IF EXISTS "Public can read bowling_alleys" ON public.bowling_alleys;

-- Uploads
DROP POLICY IF EXISTS "Users can view uploads for sessions" ON public.uploads;
DROP POLICY IF EXISTS "Users can view uploads" ON public.uploads;
DROP POLICY IF EXISTS "Anyone can view uploads" ON public.uploads;

-- Now create ONE clean SELECT policy per table with clear naming
CREATE POLICY "public_select_bowlers" ON public.bowlers
  FOR SELECT USING (true);

CREATE POLICY "public_select_sessions" ON public.sessions
  FOR SELECT USING (true);

CREATE POLICY "public_select_series" ON public.series
  FOR SELECT USING (true);

CREATE POLICY "public_select_games" ON public.games
  FOR SELECT USING (true);

CREATE POLICY "public_select_frames" ON public.frames
  FOR SELECT USING (true);

CREATE POLICY "public_select_teams" ON public.teams
  FOR SELECT USING (true);

CREATE POLICY "public_select_team_bowlers" ON public.team_bowlers
  FOR SELECT USING (true);

CREATE POLICY "public_select_bowling_alleys" ON public.bowling_alleys
  FOR SELECT USING (true);

CREATE POLICY "public_select_uploads" ON public.uploads
  FOR SELECT USING (true);

