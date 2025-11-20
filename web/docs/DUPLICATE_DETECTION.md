# Duplicate File Detection

## Overview

ScoreSnap automatically detects and prevents duplicate image uploads using SHA-256 file hashing. This saves API credits by avoiding redundant processing of identical images.

## How It Works

### 1. File Hash Computation

When a file is uploaded, ScoreSnap computes a SHA-256 hash of the file content:

```typescript
const fileHash = crypto.createHash('sha256').update(buffer).digest('hex')
```

### 2. Duplicate Check

Before saving the file or processing it, the system checks if a file with the same hash already exists for the current user:

```typescript
const { data: existingUpload } = await supabase
  .from('uploads')
  .select('...')
  .eq('user_id', user.id)
  .eq('file_hash', fileHash)
  .single()
```

### 3. Response Handling

**If duplicate detected:**
- Returns HTTP 200 with `duplicate: true` flag
- Includes details of the existing upload
- Does NOT save a new file
- Does NOT call vision API
- Does NOT identify bowling alley again

**If new file:**
- Proceeds with normal upload flow
- Saves file to disk
- Extracts EXIF metadata
- Identifies bowling alley (if GPS available)
- Calls vision API when processed
- Saves hash to database

## Database Schema

```sql
ALTER TABLE public.uploads
ADD COLUMN file_hash TEXT;

CREATE INDEX idx_uploads_file_hash ON public.uploads(file_hash);
```

## API Response

### New Upload Response
```json
{
  "success": true,
  "upload": {
    "id": "uuid",
    "storage_path": "/uploads/...",
    "original_filename": "scorecard.jpg",
    "exif_datetime": "2024-11-19T12:00:00Z",
    "created_at": "2024-11-19T12:00:00Z"
  }
}
```

### Duplicate Upload Response
```json
{
  "success": true,
  "duplicate": true,
  "message": "This image has already been uploaded",
  "upload": {
    "id": "existing-uuid",
    "storage_path": "/uploads/...",
    "original_filename": "scorecard.jpg",
    "parsed": true,
    "created_at": "2024-11-18T10:00:00Z"
  }
}
```

## Frontend Handling

The upload page detects duplicates and shows a warning toast:

```typescript
if (data.duplicate) {
  toast.warning(`${file.name} was already uploaded`, {
    description: `Original upload from ${new Date(data.upload.created_at).toLocaleString()}`
  })
} else {
  toast.success(`Uploaded ${file.name}`)
}
```

## Benefits

1. **Saves API Credits**: Avoids redundant calls to OpenAI Vision API
2. **Saves Google Places Credits**: Avoids redundant location identification
3. **Faster Response**: Returns immediately without processing
4. **Better UX**: User knows the file was already uploaded
5. **Storage Efficiency**: Prevents duplicate files on disk

## User Scope

Duplicate detection is **per-user**:
- User A can upload the same image as User B
- The check only looks at `user_id + file_hash` combination
- This allows multiple users to upload the same public scoreboards

## Edge Cases

### Same Image, Different Filenames
✅ **Detected as duplicate** - Hash is based on file content, not filename

### Edited Image (cropped, rotated, etc.)
❌ **NOT detected as duplicate** - Any change to file content produces different hash

### Re-upload After Deletion
✅ **Detected as duplicate** - Hash remains in database even if upload is marked deleted

### Different Users, Same Image
❌ **NOT detected as duplicate** - Check is scoped to user_id

## Technical Details

- **Hash Algorithm**: SHA-256 (64-character hex string)
- **Hash Computed On**: Raw file buffer before saving to disk
- **Database Index**: B-tree index on `file_hash` for O(log n) lookups
- **Performance**: Hash computation adds ~5-10ms for typical image files

## Migration

Migration: `20241119000003_add_file_hash_to_uploads.sql`

The migration adds the `file_hash` column and index. Existing uploads will have `null` hash values and won't be checked for duplicates (since we can't retroactively compute hashes for files that may have been deleted).

