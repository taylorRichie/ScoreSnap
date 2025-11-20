# Session Matching with GPS Coordinates

## Overview

ScoreSnap now uses GPS coordinates from image EXIF data to intelligently match and merge uploads into the same session, even when bowling alley identification fails or isn't available yet.

## Problem Solved

Previously, session matching relied on:
1. `bowling_alley_id` (only if AI successfully identified the alley)
2. `location` text field (rarely populated)

This caused uploads from the same bowling session to create separate session records, even when taken minutes apart at the same location.

## Solution

### 1. GPS Coordinates Stored in Sessions

Added `gps_latitude` and `gps_longitude` columns to the `sessions` table:

```sql
ALTER TABLE public.sessions 
ADD COLUMN IF NOT EXISTS gps_latitude DECIMAL(10,8),
ADD COLUMN IF NOT EXISTS gps_longitude DECIMAL(11,8);
```

These coordinates are extracted from upload EXIF data and stored with the session for future matching.

### 2. GPS Proximity Matching

The `findMatchingSession` function now uses a three-tier location matching strategy:

1. **Bowling Alley ID** (highest priority)
   - If both sessions have a `bowling_alley_id`, match on that

2. **GPS Proximity** (medium priority)
   - If GPS coordinates are available, match sessions within ~100 meters (0.001 degrees)
   - Formula: `|lat1 - lat2| < 0.001 AND |lng1 - lng2| < 0.001`

3. **Location String** (lowest priority)
   - Fallback to text-based location matching

### 3. Time Window

Sessions are matched within a **6-hour window** (±3 hours from the upload time):

```typescript
const timeWindowStart = new Date(targetDate.getTime() - 3 * 60 * 60 * 1000)
const timeWindowEnd = new Date(targetDate.getTime() + 3 * 60 * 60 * 1000)
```

### 4. Bowler Overlap Logic

After filtering by location, the system checks for bowler overlap:

- **Bowler Overlap**: If any bowlers match, it's likely the same team adding more games
- **No Overlap**: If no bowlers match but time/location match, it's likely a different team at the same session

## Example Scenario

### Before Fix

```
Upload 1: Brandon.jpeg
- GPS: 41.169833, 112.024161
- Time: 11/9/2025, 1:58:42 PM
- Bowlers: Grandpa, Brandon, Richie, Caiden
- Result: Creates Session A

Upload 2: D989982926231022488.jpeg
- GPS: 41.169839, 112.024178
- Time: 11/9/2025, 1:57:53 PM
- Bowlers: Ryan, Erin, Croix, Blake, Nash
- Result: Creates Session B ❌ (separate session!)
```

### After Fix

```
Upload 1: Brandon.jpeg
- GPS: 41.169833, 112.024161
- Time: 11/9/2025, 1:58:42 PM
- Bowlers: Grandpa, Brandon, Richie, Caiden
- Result: Creates Session A

Upload 2: D989982926231022488.jpeg
- GPS: 41.169839, 112.024178 (Δlat=0.000006, Δlng=0.000017)
- Time: 11/9/2025, 1:57:53 PM (within 6-hour window)
- Bowlers: Ryan, Erin, Croix, Blake, Nash (no overlap)
- Result: Merges into Session A ✅ (different team, same session!)
```

## GPS Threshold

The GPS threshold of **0.001 degrees** (~100 meters) accounts for:
- GPS accuracy variations between devices
- Different locations within the same bowling alley
- Indoor GPS drift

This is conservative enough to avoid false matches while being flexible enough to handle real-world GPS variations.

## Console Logging

The system now logs detailed GPS matching information:

```
🔍 Searching for matching sessions...
  Time window: 2025-11-09T18:57:53.000Z to 2025-11-09T20:57:53.000Z
  Bowling alley ID: null
  Location: null
  GPS: 41.169839 112.024178
  Bowlers: ["Ryan", "Erin", "Croix", "Blake", "Nash"]
  
  Found 1 candidate session(s) matching location
  Session abc123: matches GPS (Δlat=0.000006, Δlng=0.000017)
  Session abc123: 0/5 bowlers match, session has 4 bowlers
  
✅ Found matching session without overlap (different team): abc123
```

## Database Schema

```sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY,
  date_time TIMESTAMPTZ NOT NULL,
  bowling_alley_id UUID REFERENCES bowling_alleys(id),
  location TEXT,
  gps_latitude DECIMAL(10,8),     -- ← New
  gps_longitude DECIMAL(11,8),    -- ← New
  lane INTEGER,
  name TEXT,
  created_by_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_gps ON sessions(gps_latitude, gps_longitude);
```

## Benefits

1. **Automatic Session Merging**: Multiple teams at the same bowling alley are automatically grouped into one session
2. **Works Without Bowling Alley ID**: Session matching works even if AI fails to identify the bowling alley
3. **Handles GPS Variations**: Tolerates small GPS coordinate differences between uploads
4. **Multi-Team Support**: Correctly identifies when different teams are bowling at the same time/location
5. **Better Data Organization**: Users see one session with multiple teams instead of fragmented sessions

## Privacy Note

GPS coordinates are:
- Only stored if present in image EXIF data
- Used solely for session matching
- Not exposed in public APIs
- Can be removed by deleting the session

