-- Enable public read access to all main tables
-- This allows unauthenticated users to view data without signing in

-- Bowlers: Anyone can view
DROP POLICY IF EXISTS "Users can view all bowlers" ON public.bowlers;
CREATE POLICY "Anyone can view bowlers" ON public.bowlers
  FOR SELECT USING (true);

-- Sessions: Anyone can view
DROP POLICY IF EXISTS "Users can view sessions" ON public.sessions;
DROP POLICY IF EXISTS "Users can view sessions they created or uploaded to" ON public.sessions;
CREATE POLICY "Anyone can view sessions" ON public.sessions
  FOR SELECT USING (true);

-- Series: Anyone can view
DROP POLICY IF EXISTS "Users can view series" ON public.series;
DROP POLICY IF EXISTS "Users can view series for their sessions" ON public.series;
CREATE POLICY "Anyone can view series" ON public.series
  FOR SELECT USING (true);

-- Games: Anyone can view
DROP POLICY IF EXISTS "Users can view games" ON public.games;
DROP POLICY IF EXISTS "Users can view games for series they have access to" ON public.games;
CREATE POLICY "Anyone can view games" ON public.games
  FOR SELECT USING (true);

-- Frames: Anyone can view
DROP POLICY IF EXISTS "Users can view frames" ON public.frames;
DROP POLICY IF EXISTS "Users can view frames for games they have access to" ON public.frames;
CREATE POLICY "Anyone can view frames" ON public.frames
  FOR SELECT USING (true);

-- Teams: Anyone can view
DROP POLICY IF EXISTS "Users can view teams" ON public.teams;
CREATE POLICY "Anyone can view teams" ON public.teams
  FOR SELECT USING (true);

-- Team Bowlers: Anyone can view
DROP POLICY IF EXISTS "Users can view team bowlers" ON public.team_bowlers;
CREATE POLICY "Anyone can view team_bowlers" ON public.team_bowlers
  FOR SELECT USING (true);

-- Bowling Alleys: Anyone can view
DROP POLICY IF EXISTS "Users can view bowling alleys" ON public.bowling_alleys;
CREATE POLICY "Anyone can view bowling_alleys" ON public.bowling_alleys
  FOR SELECT USING (true);

-- Uploads: Users can only view their own uploads
DROP POLICY IF EXISTS "Users can view uploads" ON public.uploads;
CREATE POLICY "Users can view uploads for sessions" ON public.uploads
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND (
      auth.uid() = user_id OR
      EXISTS (
        SELECT 1 FROM public.sessions 
        WHERE sessions.id = uploads.session_id 
        AND auth.uid() = sessions.created_by_user_id
      )
    )
  );

-- Note: INSERT, UPDATE, DELETE policies remain restricted to authenticated users
-- Only SELECT (read) operations are public

