# Deletion Features Documentation

## Overview
This document describes the deletion features implemented for ScoreSnap, allowing users to manage their data by deleting sessions and uploads.

## Features Implemented

### 1. Delete Session (with Cascading Deletes)

**API Endpoint:** `DELETE /api/sessions/[id]`

**What Gets Deleted:**
- ✅ The session record
- ✅ All upload files (images) associated with the session
- ✅ All upload database records
- ✅ All series records
- ✅ All game records
- ✅ All frame records
- ✅ All team records
- ✅ All team_bowler associations

**What Does NOT Get Deleted:**
- ❌ Bowler profiles (these are shared across sessions)
- ❌ Bowling alley records (these are shared across sessions)

**Security:**
- Only the user who created the session can delete it
- Requires authentication via JWT token
- Validates user permissions before deletion

**Deletion Order (to respect foreign key constraints):**
1. Frames (referenced by games)
2. Games (referenced by series)
3. Series (referenced by session)
4. Team_bowlers (referenced by teams)
5. Teams (referenced by session)
6. Upload files from filesystem
7. Upload records (referenced by session)
8. Session record

**UI Location:**
- Session detail page (`/sessions/[id]`)
- Trash icon button in the header next to the edit button
- Confirmation dialog with detailed warning about what will be deleted

### 2. Delete Upload (Non-Cascading)

**API Endpoint:** `DELETE /api/uploads/[id]`

**What Gets Deleted:**
- ✅ The upload file (image) from the filesystem
- ✅ The upload database record

**What Does NOT Get Deleted:**
- ❌ Session data
- ❌ Game data
- ❌ Series data
- ❌ Bowler data
- ❌ Any other associated records

**Purpose:**
This allows users to clean up uploaded images without affecting the game data that was extracted from them. Useful for:
- Removing duplicate uploads
- Cleaning up test uploads
- Managing storage space

**Security:**
- Only the user who uploaded the file can delete it
- Requires authentication via JWT token
- Validates user permissions before deletion

**UI Location:**
- Debug upload page (`/debug/upload`)
- Red "Delete" button on each upload card
- Browser confirmation dialog before deletion

## Usage Examples

### Deleting a Session
1. Navigate to a session detail page
2. Click the trash icon in the header
3. Review the confirmation dialog
4. Click "Delete Session" to confirm
5. You'll be redirected to the sessions list

### Deleting an Upload
1. Navigate to the debug upload page
2. Find the upload you want to delete
3. Click the red "Delete" button
4. Confirm in the browser dialog
5. The upload will be removed from the list

## Error Handling

Both deletion endpoints handle errors gracefully:
- **401 Unauthorized**: User is not logged in
- **403 Forbidden**: User doesn't have permission to delete
- **404 Not Found**: Session/upload doesn't exist
- **500 Internal Server Error**: Database or filesystem error

If a file deletion fails (e.g., file already deleted), the operation continues and removes the database record anyway.

## Data Purging Strategy

For users who want to clean up data while keeping their account:

1. **Delete Individual Sessions**: Use the session delete feature to remove specific bowling sessions
2. **Delete Uploads**: Use the upload delete feature to remove image files while keeping game data
3. **Delete Bowlers**: Use the bowler delete feature (already implemented) to remove bowler profiles

**Note:** There is no "delete all data" button to prevent accidental data loss. Users must delete items individually or use the admin cleanup API.

## Admin Cleanup API

For administrators, there's a separate cleanup endpoint:
- `POST /api/admin/cleanup` - Removes duplicate bowlers and sessions
- `POST /api/admin/purge` - Complete database reset (use with caution)

## Implementation Files

### API Routes
- `/web/src/app/api/sessions/[id]/route.ts` - Session DELETE endpoint
- `/web/src/app/api/uploads/[id]/route.ts` - Upload DELETE endpoint (new file)

### UI Components
- `/web/src/app/sessions/[id]/page.tsx` - Session detail page with delete button
- `/web/src/app/debug/upload/page.tsx` - Upload page with delete buttons

## Testing

To test the deletion features:

1. **Test Session Deletion:**
   ```bash
   # Create a test session by uploading an image
   # Navigate to the session detail page
   # Click the delete button
   # Verify all data is removed
   ```

2. **Test Upload Deletion:**
   ```bash
   # Upload a test image
   # Navigate to /debug/upload
   # Click delete on the upload
   # Verify the file is removed but session data remains (if processed)
   ```

## Future Enhancements

Potential improvements for the deletion features:
- Bulk delete operations (select multiple sessions/uploads)
- Soft delete with recovery period
- Archive feature instead of permanent deletion
- Deletion audit log
- Scheduled cleanup of old data

