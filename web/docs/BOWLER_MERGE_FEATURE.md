# Bowler Merge Feature

## Overview

The Bowler Merge feature allows administrators to reassign a bowler's series from one session to a different bowler profile. This is useful when:
- The AI incorrectly parsed a bowler's name
- A bowler appears with multiple slightly different names (e.g., "Brit" vs "Brittany")
- You need to consolidate data for a single bowler who was parsed as multiple different people

## How It Works

### Session-Level Merging

Merging is done at the **session level**, not globally. This means:
- When you merge "Brit" into "Brittany" for a specific session, only that session's games are reassigned
- Other sessions with "Brit" remain unchanged
- You can have different merge decisions for different sessions

### User Interface

**The merge feature is accessed from the Bowler Profile page:**

1. **Navigate to Bowler**: Go to `/bowlers/[id]` for the bowler you want to merge FROM (e.g., "Brit")
2. **View Sessions**: Scroll down to see all sessions for that bowler
3. **Merge Button**: Each session card has a merge icon (GitMerge) in the footer
4. **Click to Merge**: Clicking the merge icon opens a search dialog
5. **Search for Target**: Type to search for any bowler in the system (e.g., "Brittany")
6. **Select Target**: Click on the desired bowler from search results
7. **Confirmation**: Review the selected target and confirm the merge
8. **Auto-refresh**: After merge, the page automatically refreshes to show the updated data

### Why This Approach?

The bowler profile approach solves a key limitation: you can merge into bowlers who don't appear in the same session.

**Example scenario:**
- "Brit" appears in Session 1
- "Brittany" appears in Session 2
- From Brit's profile, you can merge Session 1 into Brittany's profile
- This wouldn't be possible if merging was only available on the session detail page

### Visual Feedback

- **Merge button**: GitMerge icon in the session card footer
- **Search dialog**: Type-ahead search for all bowlers in the system
- **Selected target**: Shows an alert with the selected bowler's name
- **Confirmation required**: User must explicitly confirm before merge executes
- **Last session redirect**: Automatically redirects to target bowler's profile when merging the last session
- **Auto-cleanup**: Bowlers with 0 sessions are automatically hidden from the bowlers list

## Database Structure

### Tables

#### `series.original_parsed_name`
- New column that stores the original name parsed from the scoreboard
- Preserved even after merges, for audit trail purposes
- Backfilled with the bowler's canonical name for existing series

#### `bowler_merges` (audit table)
- Tracks all merge operations for compliance and debugging
- Fields:
  - `id`: UUID primary key
  - `series_id`: The series that was reassigned
  - `from_bowler_id`: The original bowler
  - `to_bowler_id`: The target bowler
  - `original_name`: The original parsed name
  - `session_id`: The session where the merge occurred
  - `merged_at`: Timestamp of the merge
  - `merged_by_user_id`: The user who performed the merge

### Row Level Security (RLS)

RLS policies ensure:
- Users can only view merge history for sessions they have access to
- Users can only create merge records for their own sessions
- Users can only delete their own merge records

## API Endpoint

### `POST /api/sessions/[id]/merge-bowler`

Request body:
```json
{
  "seriesId": "uuid-of-series-to-merge",
  "targetBowlerId": "uuid-of-target-bowler", // Optional if createNewBowler is true
  "createNewBowler": true, // Optional, false by default
  "newBowlerName": "New Bowler Name" // Required if createNewBowler is true
}
```

Response:
```json
{
  "success": true,
  "message": "Successfully merged 'Dave' into 'David'",
  "fromBowlerId": "uuid",
  "toBowlerId": "uuid",
  "toBowlerName": "David"
}
```

## Permissions

To merge bowlers in a session, you must either:
- Be the user who created the session, OR
- Have uploaded images to the session

## User Flow Example

1. User notices "Brit" and "Brittany" are the same person but appear as separate bowlers
2. Navigates to `/bowlers` and clicks on "Brit"
3. Sees 3 sessions listed for Brit
4. Clicks the merge icon on "Session 1"
5. Types "Brittany" in the search box
6. Selects "Brittany" from the search results
7. Confirms the merge
8. Session 1's games now appear under Brittany's profile
9. Repeats for Sessions 2 and 3
10. After merging the last session:
    - User is automatically redirected to Brittany's profile
    - "Brit" disappears from the `/bowlers` list (bowlers with 0 sessions are hidden)

## Future Enhancements

Potential future improvements:
- Global bowler merge (merge ALL sessions at once)
- Bulk merge operations
- Undo merge functionality
- Merge suggestions based on name similarity (e.g., "Did you mean to merge these?")
- "Merge all sessions" button to merge all of a bowler's sessions in one click
- Persistent teams across sessions (mentioned in cursor rules)

