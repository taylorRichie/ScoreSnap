-- Fix RPC functions to work with public access
-- Add SECURITY DEFINER so they can bypass RLS when called by unauthenticated users

-- Drop and recreate get_bowler_stats with SECURITY DEFINER
DROP FUNCTION IF EXISTS get_bowler_stats(UUID);

CREATE OR REPLACE FUNCTION get_bowler_stats(bowler_uuid UUID)
RETURNS TABLE (
    total_games INTEGER,
    total_score INTEGER,
    average_score DECIMAL(5,2),
    high_game INTEGER,
    high_series INTEGER
) 
SECURITY DEFINER
SET search_path = public
AS $$
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
    WHERE g.bowler_id = bowler_uuid
    AND g.total_score IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to anon users
GRANT EXECUTE ON FUNCTION get_bowler_stats(UUID) TO anon;
GRANT EXECUTE ON FUNCTION get_bowler_stats(UUID) TO authenticated;

