# Team Parsing Rules

## Overview
ScoreSnap automatically organizes bowlers into teams based on which scoreboard screen they appear on. A session can have multiple teams (Team A, Team B, Team C, etc.).

## Core Principle
**One screen = One team**

All bowlers visible on a single scoreboard screen are automatically teammates, regardless of how many bowlers appear on that screen.

## Team Assignment Rules

### Rule 1: Screen-Based Teams
- ALL bowlers on the same screen are on the SAME team
- 1 bowler on a screen → Team A
- 5 bowlers on a screen → Team A (all 5 are teammates)
- 10 bowlers on a screen → Team A (all 10 are teammates)
- NEVER split bowlers from the same screen into different teams

### Rule 2: Team Naming Convention
- **First screen uploaded** → "Team A"
- **Second screen uploaded** → "Team B"
- **Third screen uploaded** → "Team C"
- **And so on...** → Team D, Team E, etc.

### Rule 3: Custom Team Names
- If a scoreboard displays explicit team names (like "Team Tigers", "Team Bears"), those names are used instead
- Default to alphabetical pattern (Team A, B, C) when no labels are visible

### Rule 4: Multiple Teams Per Session
- A session can have 2+ teams
- Common scenarios:
  - 2 teams competing on a shared ball return (2 screens)
  - 3+ teams at a family event across multiple lanes
  - Tournament play with many teams

## Examples

### Example 1: Two-Team Game
```
Upload 1: Left screen shows Richie, Ryan, Erin, Croix, Brittany
→ All 5 assigned to "Team A"

Upload 2: Right screen shows Caiden, Ellis, Briggs, Mike
→ All 4 assigned to "Team B"

Result: Session with 2 teams, 9 total bowlers
```

### Example 2: Three-Team Family Event
```
Upload 1: Lane 11 screen (left) shows Brandon, Grandpa, Nash, Blake, Dayna
→ "Team A"

Upload 2: Lane 11 screen (right) shows [different bowlers]
→ "Team B"

Upload 3: Lane 13 screen shows Caiden, Ellis, Briggs, Mike
→ "Team C"

Result: Session with 3 teams, family event across 2 lanes
```

### Example 3: Single Team
```
Upload 1: Screen shows Brandon, Richie, Ryan
→ All 3 assigned to "Team A"

Result: Session with 1 team, 3 bowlers
```

## Session Display

When viewing a session with teams, the UI displays:

```
Scores
├── Team A ─────────────────────── Total: 1763
│   ├── Richie: 139, 133, 129 (401)
│   ├── Ryan: 116, 152, 143 (411)
│   ├── Erin: 118, 104, 116 (338)
│   ├── Croix: 96, 83, 92 (271)
│   └── Brittany: 82, 112, 148 (342)
│   └── Team Total: 551, 584, 628 (1763)
│
├── Team B ─────────────────────── Total: 1138
│   ├── Caiden: 66, 116, 134 (316)
│   ├── Ellis: 59, 44, 48 (151)
│   ├── Briggs: 49, 132, 138 (319)
│   └── Mike: 87, 138, 127 (352)
│   └── Team Total: 261, 430, 447 (1138)
```

Each team shows:
- Team name in header
- Total pin count for the team
- List of bowlers with their scores
- Team totals row showing sum per game

## Technical Implementation

### Vision Prompt
The AI vision model is instructed to:
1. Identify all bowlers on a single screen
2. Group them into one team
3. Use "Team A" for single-screen uploads
4. Never split screen-mates into different teams

### Database Structure
```sql
sessions
  └── teams
      └── team_bowlers
          └── bowlers
              └── series
                  └── games
```

### Team Totals Calculation
```javascript
// Sum all bowlers' scores for each game
teamTotals = games.map(gameNum => 
  teamBowlers.reduce((sum, bowler) => 
    sum + bowler.games[gameNum].total_score, 0
  )
)

// Grand total = sum of all game totals
teamGrandTotal = teamTotals.reduce((sum, total) => sum + total, 0)
```

## Edge Cases

### Scenario: Single bowler per screen
**Situation**: 2 screens, 1 bowler each
**Result**: 2 teams with 1 bowler each
**Reason**: Each screen = one team, regardless of bowler count

### Scenario: Uneven teams
**Situation**: Team A has 5 bowlers, Team B has 3 bowlers
**Result**: Both teams displayed normally, totals calculated per team
**Reason**: Teams don't need to have the same number of bowlers

### Scenario: No team data
**Situation**: Old session before team tracking was implemented
**Result**: Fallback display showing all bowlers in a single table (no team grouping)
**Reason**: Graceful degradation for legacy data

## Best Practices

### For Users
1. Upload all screens from a session together for best results
2. If uploading screens separately, upload in order (left to right, lane by lane)
3. Clear photos help AI correctly identify all bowlers on a screen

### For Developers
1. Always validate that team assignments match screen groupings
2. Team totals should be calculated dynamically (not stored)
3. Support sessions with 1, 2, 3+ teams
4. Fallback gracefully when team data is missing

## Future Enhancements

Potential improvements:
- Manual team editing/reassignment UI
- Team vs team statistics and comparison
- League play with team standings
- Tournament bracket support
- Team averages and performance trends

