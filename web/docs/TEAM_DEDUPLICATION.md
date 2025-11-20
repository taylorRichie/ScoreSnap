# Team Deduplication

## Overview

ScoreSnap now prevents duplicate team records when multiple uploads are added to the same session.

## Problem Solved

Previously, when uploading multiple images to the same session:
- Each upload would create new team records, even if teams already existed
- This resulted in multiple "Team A" records with 0 bowlers
- Bowlers were associated with the wrong team instances
- The Teams page showed duplicate teams

### Example of the Bug

```
Upload 1 (5 bowlers):
- Creates "Team A" (ID: team-1)
- Associates 5 bowlers with team-1
- Result: 1 team with 5 bowlers ✓

Upload 2 (same 5 bowlers, different game):
- Creates "Team A" (ID: team-2) ❌
- Creates "Team A" (ID: team-3) ❌
- Creates "Team A" (ID: team-4) ❌
- Creates "Team A" (ID: team-5) ❌
- Creates "Team A" (ID: team-6) ❌
- Associates 5 bowlers with team-2, team-3, team-4, team-5, team-6
- Result: 6 teams with 0 bowlers each ❌
```

## Solution

### 1. Check for Existing Teams

Before creating a new team, the system now checks if a team with the same name already exists in the session:

```typescript
// Check if team already exists in this session
const { data: existingTeam } = await supabase
  .from('teams')
  .select('id, name')
  .eq('session_id', sessionId)
  .eq('name', teamData.name)
  .maybeSingle()

if (existingTeam) {
  // Team already exists, reuse it
  teamMap[teamData.name] = existingTeam.id
  console.log(`✅ Found existing team ${existingTeam.id} for ${teamData.name}`)
} else {
  // Create new team
  const { data: team } = await supabase
    .from('teams')
    .insert({
      name: teamData.name,
      session_id: sessionId,
      created_by_user_id: userId
    })
    .select()
    .single()

  teamMap[teamData.name] = team.id
  console.log(`✅ Created team ${team.id} for ${teamData.name}`)
}
```

### 2. Check for Existing Bowler-Team Associations

Before associating a bowler with a team, the system checks if the association already exists:

```typescript
// Check if association already exists
const { data: existingAssociation } = await supabase
  .from('team_bowlers')
  .select('id')
  .eq('team_id', teamMap[bowlerData.team])
  .eq('bowler_id', bowlerId)
  .maybeSingle()

if (existingAssociation) {
  console.log(`✅ Bowler ${bowlerData.name} already associated with team ${bowlerData.team}`)
} else {
  // Create new association
  await supabase
    .from('team_bowlers')
    .insert({
      team_id: teamMap[bowlerData.team],
      bowler_id: bowlerId
    })
  console.log(`✅ Associated bowler ${bowlerData.name} with team ${bowlerData.team}`)
}
```

## Example Scenario

### After Fix

```
Upload 1 (5 bowlers):
- Creates "Team A" (ID: team-1)
- Associates 5 bowlers with team-1
- Result: 1 team with 5 bowlers ✓

Upload 2 (same 5 bowlers, different game):
- Finds existing "Team A" (ID: team-1) ✓
- Checks each bowler association:
  - Bowler 1: already associated ✓
  - Bowler 2: already associated ✓
  - Bowler 3: already associated ✓
  - Bowler 4: already associated ✓
  - Bowler 5: already associated ✓
- Result: 1 team with 5 bowlers ✓
```

### Multi-Team Scenario

```
Upload 1 (Team A - 5 bowlers):
- Creates "Team A" (ID: team-1)
- Associates 5 bowlers with team-1
- Result: 1 team with 5 bowlers ✓

Upload 2 (Team B - 4 bowlers, same session):
- Finds no existing "Team B" in this session
- Creates "Team B" (ID: team-2) ✓
- Associates 4 bowlers with team-2
- Result: 2 teams (Team A: 5 bowlers, Team B: 4 bowlers) ✓

Upload 3 (Team A - same 5 bowlers, additional game):
- Finds existing "Team A" (ID: team-1) ✓
- Checks each bowler association (all already exist) ✓
- Result: 2 teams (Team A: 5 bowlers, Team B: 4 bowlers) ✓
```

## Console Logging

The system now logs team operations clearly:

```
Processing 1 teams for session abc123
✅ Found existing team team-1 for Team A
✅ Bowler Ryan already associated with team Team A
✅ Bowler Erin already associated with team Team A
✅ Bowler Croix already associated with team Team A
✅ Bowler Blake already associated with team Team A
✅ Bowler Nash already associated with team Team A
```

Or when creating new teams:

```
Processing 1 teams for session abc123
✅ Created team team-2 for Team B
✅ Associated bowler Alice with team Team B
✅ Associated bowler Bob with team Team B
✅ Associated bowler Carol with team Team B
✅ Associated bowler Dave with team Team B
```

## Database Constraints

The `team_bowlers` table has a unique constraint to prevent duplicate associations:

```sql
CREATE TABLE team_bowlers (
  id UUID PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  bowler_id UUID NOT NULL REFERENCES bowlers(id) ON DELETE CASCADE,
  UNIQUE(team_id, bowler_id)  -- ← Prevents duplicates
);
```

However, the code now checks proactively to avoid constraint violations and provide better logging.

## Benefits

1. **No Duplicate Teams**: Each team name appears only once per session
2. **Correct Bowler Counts**: Teams show the correct number of associated bowlers
3. **Better UI**: The Teams page displays meaningful data
4. **Idempotent Operations**: Re-processing the same upload won't create duplicates
5. **Multi-Upload Support**: Users can upload multiple images from the same session without data corruption

## Related Features

- **Session Matching**: Works in conjunction with GPS-based session matching to ensure uploads are added to the correct session
- **Series Merging**: Bowlers can have multiple series within the same session/team
- **Game Deduplication**: Games are also checked for duplicates before insertion

