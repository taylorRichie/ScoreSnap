-- Database cleanup script for ScoreSnap
-- This script identifies and removes duplicate records while preserving upload-level uniqueness

-- First, let's see what we have
SELECT 'Before cleanup - record counts:' as status;
SELECT
  'sessions' as table_name, COUNT(*) as count FROM sessions
UNION ALL
SELECT 'bowlers', COUNT(*) FROM bowlers
UNION ALL
SELECT 'series', COUNT(*) FROM series
UNION ALL
SELECT 'games', COUNT(*) FROM games
UNION ALL
SELECT 'frames', COUNT(*) FROM frames
UNION ALL
SELECT 'uploads', COUNT(*) FROM uploads
UNION ALL
SELECT 'teams', COUNT(*) FROM teams
UNION ALL
SELECT 'team_bowlers', COUNT(*) FROM team_bowlers;

-- Identify duplicate bowlers (same name, different IDs)
-- We'll keep the bowler with the most recent creation date
CREATE TEMP TABLE bowler_duplicates AS
SELECT
  name,
  COUNT(*) as duplicate_count,
  ARRAY_AGG(id ORDER BY created_at DESC) as bowler_ids,
  ARRAY_AGG(created_at ORDER BY created_at DESC) as created_dates
FROM bowlers
GROUP BY name
HAVING COUNT(*) > 1;

-- Show duplicate bowlers
SELECT 'Duplicate bowlers found:' as status;
SELECT * FROM bowler_duplicates;

-- For each set of duplicate bowlers, update all references to point to the most recent one
-- and then delete the older duplicates
DO $$
DECLARE
  bowler_rec RECORD;
  keep_id UUID;
  delete_ids UUID[];
BEGIN
  FOR bowler_rec IN SELECT * FROM bowler_duplicates LOOP
    -- Keep the most recent bowler (first in the array since we ordered by created_at DESC)
    keep_id := bowler_rec.bowler_ids[1];
    -- Delete all others
    delete_ids := bowler_rec.bowler_ids[2:];

    RAISE NOTICE 'Keeping bowler % (%), deleting bowlers % for name: %',
      keep_id, bowler_rec.created_dates[1], delete_ids, bowler_rec.name;

    -- Update series to point to the kept bowler
    UPDATE series SET bowler_id = keep_id WHERE bowler_id = ANY(delete_ids);

    -- Update team_bowlers to point to the kept bowler
    UPDATE team_bowlers SET bowler_id = keep_id WHERE bowler_id = ANY(delete_ids);

    -- Delete the duplicate bowlers
    DELETE FROM bowlers WHERE id = ANY(delete_ids);
  END LOOP;
END $$;

-- Clean up orphaned records
-- Delete series that don't have corresponding bowlers
DELETE FROM series WHERE bowler_id NOT IN (SELECT id FROM bowlers);

-- Delete games that don't have corresponding series
DELETE FROM games WHERE series_id NOT IN (SELECT id FROM series);

-- Delete frames that don't have corresponding games
DELETE FROM frames WHERE game_id NOT IN (SELECT id FROM games);

-- Delete team_bowlers that reference non-existent bowlers or teams
DELETE FROM team_bowlers WHERE bowler_id NOT IN (SELECT id FROM bowlers);
DELETE FROM team_bowlers WHERE team_id NOT IN (SELECT id FROM teams);

-- Clean up empty teams (teams with no bowlers)
DELETE FROM teams WHERE id NOT IN (SELECT DISTINCT team_id FROM team_bowlers);

-- Show results after cleanup
SELECT 'After cleanup - record counts:' as status;
SELECT
  'sessions' as table_name, COUNT(*) as count FROM sessions
UNION ALL
SELECT 'bowlers', COUNT(*) FROM bowlers
UNION ALL
SELECT 'series', COUNT(*) FROM series
UNION ALL
SELECT 'games', COUNT(*) FROM games
UNION ALL
SELECT 'frames', COUNT(*) FROM frames
UNION ALL
SELECT 'uploads', COUNT(*) FROM uploads
UNION ALL
SELECT 'teams', COUNT(*) FROM teams
UNION ALL
SELECT 'team_bowlers', COUNT(*) FROM team_bowlers;

-- Final validation
SELECT 'Validation - checking for remaining issues:' as status;

-- Check for bowlers with multiple series in the same session (shouldn't happen)
SELECT
  'Bowlers with multiple series in same session:' as issue,
  COUNT(*) as count
FROM (
  SELECT b.id, s.id as session_id, COUNT(sr.id) as series_count
  FROM bowlers b
  JOIN series sr ON sr.bowler_id = b.id
  JOIN sessions s ON s.id = sr.session_id
  GROUP BY b.id, s.id
  HAVING COUNT(sr.id) > 1
) sub;

-- Check for orphaned records
SELECT
  'Orphaned series (no bowler):' as issue,
  COUNT(*) as count
FROM series WHERE bowler_id NOT IN (SELECT id FROM bowlers);

SELECT
  'Orphaned games (no series):' as issue,
  COUNT(*) as count
FROM games WHERE series_id NOT IN (SELECT id FROM series);

SELECT
  'Orphaned frames (no game):' as issue,
  COUNT(*) as count
FROM frames WHERE game_id NOT IN (SELECT id FROM games);

SELECT 'Database cleanup completed successfully!' as status;
