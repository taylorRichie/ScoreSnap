-- Initial schema for ScoreSnap bowling score capture app
-- Migration: 20241116000000_initial_schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Bowlers table
CREATE TABLE public.bowlers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    primary_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    canonical_name TEXT NOT NULL,
    created_by_user_id UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bowler aliases table for fuzzy name matching
CREATE TABLE public.bowler_aliases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bowler_id UUID NOT NULL REFERENCES public.bowlers(id) ON DELETE CASCADE,
    alias TEXT NOT NULL,
    source TEXT NOT NULL CHECK (source IN ('manual', 'auto_vision')),
    confidence_score DECIMAL(3,2) DEFAULT NULL, -- 0.00 to 1.00
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(bowler_id, alias)
);

-- Bowling alleys table
CREATE TABLE public.bowling_alleys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    address TEXT,
    city TEXT,
    state TEXT,
    zip_code TEXT,
    country TEXT DEFAULT 'USA',
    phone TEXT,
    website TEXT,
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    place_id TEXT, -- Google Places API ID or similar
    verified BOOLEAN DEFAULT FALSE,
    verified_by_user_id UUID REFERENCES auth.users(id),
    verified_at TIMESTAMPTZ,
    created_by_user_id UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(latitude, longitude) -- Prevent duplicate locations
);

-- Sessions table (game nights / series events)
CREATE TABLE public.sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date_time TIMESTAMPTZ NOT NULL,
    bowling_alley_id UUID REFERENCES public.bowling_alleys(id) ON DELETE SET NULL,
    location TEXT, -- fallback location text (e.g., "Main Street Lanes" or GPS coordinates)
    lane INTEGER, -- nullable, one lane per session for v1
    bowling_alley_name TEXT, -- parsed from image or EXIF (deprecated, use bowling_alley_id)
    created_by_user_id UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Teams table
CREATE TABLE public.teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
    created_by_user_id UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Team bowlers many-to-many relationship
CREATE TABLE public.team_bowlers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    bowler_id UUID NOT NULL REFERENCES public.bowlers(id) ON DELETE CASCADE,
    active_from TIMESTAMPTZ DEFAULT NOW(),
    active_to TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(team_id, bowler_id, active_from)
);

-- Series table (represents a bowler's participation in a session)
CREATE TABLE public.series (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
    team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
    bowler_id UUID NOT NULL REFERENCES public.bowlers(id) ON DELETE CASCADE,
    games_count INTEGER DEFAULT 3, -- planned number of games
    series_total INTEGER DEFAULT 0, -- calculated field
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(session_id, bowler_id)
);

-- Games table
CREATE TABLE public.games (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    series_id UUID NOT NULL REFERENCES public.series(id) ON DELETE CASCADE,
    game_number INTEGER NOT NULL CHECK (game_number > 0),
    bowler_id UUID NOT NULL REFERENCES public.bowlers(id) ON DELETE CASCADE,
    total_score INTEGER,
    is_partial BOOLEAN DEFAULT FALSE, -- true if frames not fully known
    handicap INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(series_id, game_number),
    UNIQUE(series_id, bowler_id, game_number)
);

-- Frames table (1-10 frames per game)
CREATE TABLE public.frames (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
    frame_number INTEGER NOT NULL CHECK (frame_number BETWEEN 1 AND 10),
    roll_1 INTEGER CHECK (roll_1 BETWEEN 0 AND 10),
    roll_2 INTEGER CHECK (roll_2 BETWEEN 0 AND 10),
    roll_3 INTEGER CHECK (roll_3 BETWEEN 0 AND 10), -- only for 10th frame
    notation TEXT, -- e.g., 'X', '9/', '8-' for easier reconstruction
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(game_id, frame_number)
);

-- Uploads table (stores image uploads and processing status)
CREATE TABLE public.uploads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    session_id UUID REFERENCES public.sessions(id) ON DELETE SET NULL,
    storage_path TEXT NOT NULL, -- path in Supabase storage or local file system
    original_filename TEXT NOT NULL,
    file_size_bytes INTEGER,
    exif_datetime TIMESTAMPTZ,
    exif_location_lat DECIMAL(10,8), -- GPS latitude
    exif_location_lng DECIMAL(11,8), -- GPS longitude
    exif_location_name TEXT, -- reverse geocoded location
    raw_vision_json JSONB, -- original OpenAI response for debug
    parsed BOOLEAN DEFAULT FALSE,
    parsing_error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Session merge groups (for deduplication)
CREATE TABLE public.session_merge_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    canonical_session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
    merge_reason TEXT, -- e.g., 'time_location_match', 'bowler_overlap'
    confidence_score DECIMAL(3,2) DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Session merge members (links uploads to merge groups)
CREATE TABLE public.session_merge_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merge_group_id UUID NOT NULL REFERENCES public.session_merge_groups(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
    added_by_user_id UUID NOT NULL REFERENCES auth.users(id),
    added_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(merge_group_id, session_id)
);

-- Indexes for performance
CREATE INDEX idx_bowler_aliases_alias ON public.bowler_aliases(alias);
CREATE INDEX idx_bowler_aliases_bowler_id ON public.bowler_aliases(bowler_id);
CREATE INDEX idx_team_bowlers_team_id ON public.team_bowlers(team_id);
CREATE INDEX idx_team_bowlers_bowler_id ON public.team_bowlers(bowler_id);
CREATE INDEX idx_sessions_date_time ON public.sessions(date_time);
CREATE INDEX idx_sessions_location ON public.sessions(location);
CREATE INDEX idx_series_session_id ON public.series(session_id);
CREATE INDEX idx_series_bowler_id ON public.series(bowler_id);
CREATE INDEX idx_games_series_id ON public.games(series_id);
CREATE INDEX idx_games_bowler_id ON public.games(bowler_id);
CREATE INDEX idx_frames_game_id ON public.frames(game_id);
CREATE INDEX idx_uploads_user_id ON public.uploads(user_id);
CREATE INDEX idx_uploads_session_id ON public.uploads(session_id);
CREATE INDEX idx_uploads_exif_datetime ON public.uploads(exif_datetime);
CREATE INDEX idx_session_merge_members_merge_group_id ON public.session_merge_members(merge_group_id);

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE public.bowlers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bowler_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bowling_alleys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_bowlers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.frames ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_merge_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_merge_members ENABLE ROW LEVEL SECURITY;

-- Bowlers: Users can see all bowlers, but only edit their own
CREATE POLICY "Users can view all bowlers" ON public.bowlers
    FOR SELECT USING (true);

CREATE POLICY "Users can insert bowlers" ON public.bowlers
    FOR INSERT WITH CHECK (auth.uid() = created_by_user_id);

CREATE POLICY "Users can update bowlers they created or own" ON public.bowlers
    FOR UPDATE USING (auth.uid() = created_by_user_id OR auth.uid() = primary_user_id);

-- Bowler aliases: Users can see all aliases, but only manage their own bowler's aliases
CREATE POLICY "Users can view all bowler aliases" ON public.bowler_aliases
    FOR SELECT USING (true);

CREATE POLICY "Users can manage aliases for bowlers they created" ON public.bowler_aliases
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.bowlers
            WHERE id = bowler_aliases.bowler_id
            AND created_by_user_id = auth.uid()
        )
    );

-- Teams: Users can view all teams, create their own
CREATE POLICY "Users can view all teams" ON public.teams
    FOR SELECT USING (true);

CREATE POLICY "Users can create teams" ON public.teams
    FOR INSERT WITH CHECK (auth.uid() = created_by_user_id);

CREATE POLICY "Users can update teams they created" ON public.teams
    FOR UPDATE USING (auth.uid() = created_by_user_id);

-- Bowling alleys: Users can view all alleys, create their own
CREATE POLICY "Users can view all bowling alleys" ON public.bowling_alleys
    FOR SELECT USING (true);

CREATE POLICY "Users can create bowling alleys" ON public.bowling_alleys
    FOR INSERT WITH CHECK (auth.uid() = created_by_user_id);

CREATE POLICY "Users can update bowling alleys they created" ON public.bowling_alleys
    FOR UPDATE USING (auth.uid() = created_by_user_id);

-- Sessions: Users can view sessions they created or uploaded to
CREATE POLICY "Users can view sessions they have access to" ON public.sessions
    FOR SELECT USING (
        auth.uid() = created_by_user_id OR
        EXISTS (SELECT 1 FROM public.uploads WHERE session_id = sessions.id AND user_id = auth.uid())
    );

CREATE POLICY "Users can create sessions" ON public.sessions
    FOR INSERT WITH CHECK (auth.uid() = created_by_user_id);

CREATE POLICY "Users can update sessions they created" ON public.sessions
    FOR UPDATE USING (auth.uid() = created_by_user_id);

-- Series: Users can view series for sessions they have access to
CREATE POLICY "Users can view series for accessible sessions" ON public.series
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.sessions
            WHERE id = series.session_id
            AND (
                auth.uid() = created_by_user_id OR
                EXISTS (SELECT 1 FROM public.uploads WHERE session_id = sessions.id AND user_id = auth.uid())
            )
        )
    );

CREATE POLICY "Users can create series for their sessions" ON public.series
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.sessions
            WHERE id = series.session_id
            AND auth.uid() = created_by_user_id
        )
    );

CREATE POLICY "Users can update series for their sessions" ON public.series
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.sessions
            WHERE id = series.session_id
            AND auth.uid() = created_by_user_id
        )
    );

-- Games: Users can view games for series they have access to
CREATE POLICY "Users can view games for accessible series" ON public.games
    FOR SELECT USING (
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

CREATE POLICY "Users can create games for their series" ON public.games
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.series
            JOIN public.sessions ON series.session_id = sessions.id
            WHERE series.id = games.series_id
            AND auth.uid() = sessions.created_by_user_id
        )
    );

CREATE POLICY "Users can update games for their series" ON public.games
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.series
            JOIN public.sessions ON series.session_id = sessions.id
            WHERE series.id = games.series_id
            AND auth.uid() = sessions.created_by_user_id
        )
    );

-- Frames: Users can view frames for games they have access to
CREATE POLICY "Users can view frames for accessible games" ON public.frames
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.games
            JOIN public.series ON games.series_id = series.id
            JOIN public.sessions ON series.session_id = sessions.id
            WHERE games.id = frames.game_id
            AND (
                auth.uid() = sessions.created_by_user_id OR
                EXISTS (SELECT 1 FROM public.uploads WHERE session_id = sessions.id AND user_id = auth.uid())
            )
        )
    );

CREATE POLICY "Users can create frames for their games" ON public.frames
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.games
            JOIN public.series ON games.series_id = series.id
            JOIN public.sessions ON series.session_id = sessions.id
            WHERE games.id = frames.game_id
            AND auth.uid() = sessions.created_by_user_id
        )
    );

CREATE POLICY "Users can update frames for their games" ON public.frames
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.games
            JOIN public.series ON games.series_id = series.id
            JOIN public.sessions ON series.session_id = sessions.id
            WHERE games.id = frames.game_id
            AND auth.uid() = sessions.created_by_user_id
        )
    );

CREATE POLICY "Users can view their own uploads" ON public.uploads
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create uploads" ON public.uploads
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own uploads" ON public.uploads
    FOR UPDATE USING (auth.uid() = user_id);

-- Functions for calculated fields and utilities

-- Function to update series total
CREATE OR REPLACE FUNCTION update_series_total(series_uuid UUID)
RETURNS void AS $$
BEGIN
    UPDATE public.series
    SET series_total = (
        SELECT COALESCE(SUM(total_score), 0)
        FROM public.games
        WHERE series_id = series_uuid
    )
    WHERE id = series_uuid;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate bowler stats
CREATE OR REPLACE FUNCTION get_bowler_stats(bowler_uuid UUID)
RETURNS TABLE (
    total_games INTEGER,
    total_score INTEGER,
    average_score DECIMAL(5,2),
    high_game INTEGER,
    high_series INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(g.*)::INTEGER as total_games,
        SUM(g.total_score)::INTEGER as total_score,
        ROUND(AVG(g.total_score), 2) as average_score,
        MAX(g.total_score)::INTEGER as high_game,
        MAX(s.series_total)::INTEGER as high_series
    FROM public.games g
    JOIN public.series s ON g.series_id = s.id
    WHERE g.bowler_id = bowler_uuid;
END;
$$ LANGUAGE plpgsql;

-- Triggers to maintain data integrity

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to relevant tables
CREATE TRIGGER update_bowlers_updated_at BEFORE UPDATE ON public.bowlers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON public.teams
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON public.sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_series_updated_at BEFORE UPDATE ON public.series
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_games_updated_at BEFORE UPDATE ON public.games
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_uploads_updated_at BEFORE UPDATE ON public.uploads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger to update series total when games are inserted/updated
CREATE OR REPLACE FUNCTION trigger_update_series_total()
RETURNS TRIGGER AS $$
BEGIN
    -- Update series total for the affected series
    PERFORM update_series_total(
        CASE
            WHEN TG_OP = 'DELETE' THEN OLD.series_id
            ELSE NEW.series_id
        END
    );
    RETURN CASE
        WHEN TG_OP = 'DELETE' THEN OLD
        ELSE NEW
    END;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_games_update_series_total
    AFTER INSERT OR UPDATE OR DELETE ON public.games
    FOR EACH ROW EXECUTE FUNCTION trigger_update_series_total();
