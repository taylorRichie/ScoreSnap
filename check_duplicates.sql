-- Check for duplicate records
SELECT 'sessions' as table_name, COUNT(*) as count FROM sessions
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

-- Check for duplicate sessions (same date_time within 1 hour)
SELECT
  date_time,
  COUNT(*) as session_count,
  STRING_AGG(id::text, ', ') as session_ids
FROM sessions
GROUP BY date_time
HAVING COUNT(*) > 1
ORDER BY date_time DESC;

-- Check for duplicate bowlers (same name)
SELECT
  name,
  COUNT(*) as bowler_count,
  STRING_AGG(id::text, ', ') as bowler_ids
FROM bowlers
GROUP BY name
HAVING COUNT(*) > 1
ORDER BY bowler_count DESC, name;

-- Check for bowlers with multiple series in same session
SELECT
  b.name as bowler_name,
  s.id as session_id,
  COUNT(sr.id) as series_count
FROM bowlers b
JOIN series sr ON sr.bowler_id = b.id
JOIN sessions s ON s.id = sr.session_id
GROUP BY b.id, b.name, s.id
HAVING COUNT(sr.id) > 1
ORDER BY series_count DESC;
