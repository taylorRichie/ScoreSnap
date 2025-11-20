# Multi-Team Session Merging

## Overview

ScoreSnap supports merging multiple uploads into a single session, including uploads from different teams bowling at the same time and location.

## Use Cases

### 1. Same Team, Multiple Uploads
**Scenario**: Ryan's team uploads Game 1, then later uploads Games 2-3.

**Behavior**: 
- Second upload merges with first session (bowler overlap detected)
- Games are appended to existing series
- Single session with complete series data

### 2. Different Teams, Same Session
**Scenario**: 
- Team A (Ryan, Erin, Croix, Blake, Nash) uploads their game
- Team B (Grandpa, Brandon, Richie, Caiden) uploads their game from the same time/location

**Behavior**:
- Second upload merges with first session (no bowler overlap, but same time/location)
- Both teams appear in the same session
- Each team has their own series

### 3. Multiple Screens, Same Game
**Scenario**: Two adjacent lanes with different bowlers, uploaded separately.

**Behavior**:
- Uploads merge into single session
- Different teams are tracked separately
- Session statistics include all bowlers

## Matching Logic

The `findMatchingSession` function in `/web/src/lib/database.ts` uses a two-tier approach:

### Tier 1: Bowler Overlap (Preferred)
```typescript
// If ANY bowlers match, it's the same team adding more games
if (overlap > 0) {
  return session.id  // Merge with this session
}
```

**Example**:
- Existing session: Ryan, Erin, Croix
- New upload: Ryan, Erin, Croix
- **Result**: Merge (same team, additional games)

### Tier 2: Time/Location Match (Fallback)
```typescript
// If NO bowlers match but time/location match, it's a different team
if (sameTimeWindow && sameLocation && overlap === 0) {
  return session.id  // Merge as different team
}
```

**Example**:
- Existing session: Ryan, Erin, Croix (Team A)
- New upload: Grandpa, Brandon, Richie (Team B)
- Same bowling alley, within 1 hour
- **Result**: Merge (different team, same session)

## Time Window

Sessions are matched within a **6-hour window** (±3 hours):

```typescript
const timeWindowStart = new Date(targetDate.getTime() - 3 * 60 * 60 * 1000) // 3 hours before
const timeWindowEnd = new Date(targetDate.getTime() + 3 * 60 * 60 * 1000) // 3 hours after
```

This allows for:
- Multiple game uploads over time
- Different team uploads from the same bowling session
- Reasonable tolerance for EXIF timestamp variations
- Longer bowling sessions with breaks
- Images taken hours apart but part of the same event

## Location Matching

Sessions are matched by:
1. **Bowling Alley ID** (preferred) - from GPS coordinates
2. **Location string** (fallback) - from AI parsing or manual entry

## Team Assignment

Teams are assigned based on the `teams` array from OpenAI Vision API:

```json
{
  "teams": [
    {
      "name": "Team A",
      "bowlers": ["Ryan", "Erin", "Croix", "Blake", "Nash"]
    }
  ]
}
```

- All bowlers on the same screen → Same team
- Different screens at same time → Different teams
- Team names are stored in the `teams` table
- Bowlers are linked via `team_bowlers` junction table

## Database Structure

```
sessions
├── id
├── date_time
├── location
├── bowling_alley_id
└── name

teams
├── id
├── session_id
└── name

team_bowlers
├── team_id
└── bowler_id

series
├── id
├── session_id
├── bowler_id
└── games_count

games
├── id
├── series_id
├── game_number
└── total_score
```

## Console Logging

When matching sessions, you'll see detailed logs:

```
🔍 Searching for matching sessions...
  Time window: 2024-11-17T20:00:00.000Z to 2024-11-17T22:00:00.000Z
  Bowling alley ID: abc-123
  Bowlers: Ryan, Erin, Croix, Blake, Nash
  Found 1 candidate session(s)
  Session xyz-789: 0/5 bowlers match, session has 4 bowlers
✅ Found matching session without overlap (different team): xyz-789
```

## Benefits

- ✅ **Single session view** - All teams in one place
- ✅ **Complete data** - No duplicate sessions
- ✅ **Flexible uploads** - Upload games individually or as series
- ✅ **Multi-team support** - Different teams automatically detected
- ✅ **Smart merging** - Prefers bowler overlap, falls back to time/location

