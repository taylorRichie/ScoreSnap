# Session & Series Deduplication System

## Overview

The ScoreSnap system now intelligently deduplicates and merges bowling sessions and series based on metadata. This allows multiple uploads to be combined into a single coherent session, supporting scenarios where users upload individual game screens or series screens at different times.

## Key Concepts

### Session
- Represents a bowling outing at a specific time and location
- Can contain multiple series (one per bowler)
- Identified by: date/time (within 4-hour window), location, and bowler overlap

### Series
- Represents a bowler's performance in a session
- Can have 1-3 games (partial series are acceptable)
- Each bowler has ONE series per session

### Game
- Represents a single game within a series
- Has a game_number (1, 2, or 3)
- Should have exactly 10 frames
- Can be partial (no frame data, just total score)

### Frame
- Represents a single frame within a game
- Each game should have 10 frames
- Frames 1-9 can have up to 2 balls
- Frame 10 can have up to 3 balls

## Matching Algorithm

### Session Matching

When a new upload is processed, the system searches for existing sessions that match:

1. **Time Window**: ±4 hours from the upload's date/time
2. **Location**: Same bowling alley ID or location string
3. **Bowler Overlap**: At least 50% of bowlers match

If a match is found, the new data is added to the existing session. Otherwise, a new session is created.

### Series Matching

For each bowler in the upload:

1. Check if the bowler already has a series in the matched session
2. If yes, append new games to the existing series
3. If no, create a new series for that bowler

### Game Conflict Resolution

When appending games to an existing series:

- If a game number already exists, it is **skipped** (existing data is preserved)
- Only new game numbers are added
- The series `games_count` is updated to reflect the total number of games

## Supported Use Cases

### Use Case 1: Individual Game Upload → Series Upload

**Step 1**: Bowler 1 uploads an image of Game 1
```
Result:
- Session created: "Sunday Nov 17 session"
- Bowlers added: [Ryan, Erin, Croix, Blake, Nash]
- Series created for each bowler (partial, games_count=1)
- Teams created based on screen segmentation
- Game 1 data stored with full frame details
- Scores populated for each bowler
```

**Step 2**: Bowler 2 uploads an image of the full series (Games 1, 2, 3)
```
Result:
- Existing session matched (same time, location, bowlers)
- Existing series found for each bowler
- Game 1 skipped (already exists)
- Games 2 and 3 appended to each series
- Series games_count updated to 3
- Final state: Complete series with detailed Game 1, partial Games 2 & 3
```

### Use Case 2: Series Upload → Individual Game Upload

**Step 1**: Upload full series screen
```
Result:
- Session created
- Series created for each bowler (games_count=3)
- Games 1, 2, 3 created (likely partial, no frame data)
```

**Step 2**: Upload detailed Game 1 screen
```
Result:
- Existing session matched
- Existing series found
- Game 1 skipped (already exists - preserves original data)
- No changes made
```

**Note**: To update existing games with more detailed data, you would need to delete the game first or implement an "update" mode.

### Use Case 3: Multiple Individual Game Uploads

**Upload Game 1** → Session created, Game 1 added
**Upload Game 2** → Session matched, Game 2 appended
**Upload Game 3** → Session matched, Game 3 appended

Result: Complete series with all games

## Matching Criteria Details

### Time Window (±4 hours)
- Accommodates variations in EXIF timestamps
- Handles cases where photos are taken at different times during the session
- Can be adjusted if needed

### Location Matching
- Priority 1: Bowling alley ID (from GPS lookup)
- Priority 2: Location string (parsed from image)
- If neither matches, sessions are considered different

### Bowler Overlap (≥50%)
- Calculates: `overlap / max(new_bowlers, existing_bowlers)`
- Allows for some variation in bowler names
- Handles cases where not all bowlers are visible in every upload

## Data Integrity

### Conflict Prevention
- Existing games are never overwritten
- Game numbers are unique within a series
- Frame data is preserved once created

### Validation
- Game numbers must be 1, 2, or 3
- Series can have 1-3 games
- Frames are optional (partial games supported)

### Logging
The system provides detailed console logging:
```
🔍 Searching for matching sessions...
  Time window: 2025-11-17T10:00:00Z to 2025-11-17T18:00:00Z
  Bowling alley ID: abc-123
  Bowlers: [Ryan, Erin, Croix, Blake, Nash]
  Found 1 candidate session(s)
  Session xyz-789: 5/5 bowlers match (100%)
✅ Found matching session: xyz-789
  Found existing series def-456 for bowler
  ⏭️  Skipping game 1 (already exists)
  ✅ Created game 2 for game 2
  ✅ Updated series games_count to 2
```

## Future Enhancements

### Potential Improvements
1. **Smart Game Updates**: Allow updating partial games with detailed data
2. **Confidence Scoring**: Add confidence levels to session matches
3. **Manual Merging**: UI for manually merging sessions
4. **Split Sessions**: UI for splitting incorrectly merged sessions
5. **Time Window Adjustment**: Make the 4-hour window configurable
6. **Bowler Threshold**: Make the 50% overlap threshold configurable

### Advanced Features
- **Multi-lane Sessions**: Handle sessions across multiple lanes
- **Tournament Mode**: Special handling for tournament uploads
- **Practice vs League**: Differentiate session types
- **Historical Matching**: Match sessions from different days if they're clearly related

## Technical Implementation

### Key Functions

#### `findMatchingSession()`
Searches for existing sessions that match the criteria.

**Parameters:**
- `sessionDateTime`: Target date/time
- `bowlingAlleyId`: Bowling alley ID (nullable)
- `location`: Location string (nullable)
- `bowlerNames`: Array of bowler names
- `userId`: User ID (sessions are user-specific)
- `supabaseClient`: Database client

**Returns:** Session ID or null

#### `findOrCreateSeries()`
Finds an existing series or creates a new one for a bowler.

**Parameters:**
- `sessionId`: Session ID
- `bowlerId`: Bowler ID
- `newGames`: Array of games to add
- `supabaseClient`: Database client

**Returns:**
```typescript
{
  seriesId: string
  existingGames: number[]  // Game numbers that already exist
  shouldAppend: boolean    // Whether to append or create new
}
```

#### `persistParsedScoreboardWithResolution()`
Main persistence function that orchestrates the entire process.

**Flow:**
1. Get EXIF data from upload
2. Determine session date/time
3. Identify bowling alley from GPS
4. **Search for matching session**
5. Create session if no match found
6. Create teams
7. For each bowler:
   - Resolve bowler name
   - **Find or create series**
   - Create games (skip existing)
   - Create frames
   - Update series count

## Testing

### Manual Testing Scenarios

1. **Upload same game twice**
   - Expected: Second upload skips the game, no duplicates

2. **Upload Game 1, then Games 1-3**
   - Expected: Game 1 skipped, Games 2-3 added

3. **Upload from different locations**
   - Expected: Separate sessions created

4. **Upload with 4+ hour gap**
   - Expected: Separate sessions created

5. **Upload with different bowlers**
   - Expected: Separate sessions if <50% overlap

### Database Queries for Verification

```sql
-- Check for duplicate games in a series
SELECT series_id, game_number, COUNT(*)
FROM games
GROUP BY series_id, game_number
HAVING COUNT(*) > 1;

-- Verify series games_count matches actual games
SELECT 
  s.id,
  s.games_count,
  COUNT(g.id) as actual_games
FROM series s
LEFT JOIN games g ON g.series_id = s.id
GROUP BY s.id, s.games_count
HAVING s.games_count != COUNT(g.id);

-- Check for sessions with same time/location
SELECT 
  date_time,
  bowling_alley_id,
  location,
  COUNT(*) as session_count
FROM sessions
GROUP BY date_time, bowling_alley_id, location
HAVING COUNT(*) > 1;
```

## Conclusion

This deduplication system provides intelligent session and series management that supports real-world bowling scenarios where data is captured incrementally. The system prioritizes data preservation while allowing flexible data aggregation.

