# Bowling Alley Display on Upload Cards - Fixed

## Problem

When uploading an image with GPS coordinates, the system would:
1. ✅ Extract GPS coordinates
2. ✅ Call Google Places API to identify bowling alley
3. ✅ Save bowling alley to database
4. ❌ **BUT NOT save it with the upload record**
5. ❌ **So it couldn't be displayed on the debug card**

The debug page only showed GPS coordinates, not the identified bowling alley name.

## Solution

### 1. Database Migration

Added fields to `uploads` table to store the identified bowling alley:

```sql
ALTER TABLE public.uploads 
ADD COLUMN identified_bowling_alley_id UUID REFERENCES public.bowling_alleys(id),
ADD COLUMN identified_bowling_alley_name TEXT;
```

**Migration**: `20241119000002_add_bowling_alley_to_uploads.sql`

### 2. Updated Upload Route

Modified `/api/uploads/route.ts` to save bowling alley info:

**Before**:
```typescript
.insert({
  user_id: user.id,
  storage_path: storagePath,
  original_filename: file.name,
  exif_location_lat: exifLocationLat,
  exif_location_lng: exifLocationLng,
  parsed: false
})
```

**After**:
```typescript
.insert({
  user_id: user.id,
  storage_path: storagePath,
  original_filename: file.name,
  exif_location_lat: exifLocationLat,
  exif_location_lng: exifLocationLng,
  identified_bowling_alley_id: bowlingAlleyId,    // ✅ NEW
  identified_bowling_alley_name: bowlingAlleyName, // ✅ NEW
  parsed: false
})
```

### 3. Updated GET Endpoint

Modified query to include bowling alley details:

**Before**:
```typescript
.select('*')
```

**After**:
```typescript
.select('*, bowling_alley:identified_bowling_alley_id(name, address, city, state)')
```

This performs a JOIN to get full bowling alley details.

### 4. Updated Debug UI

Added bowling alley display to upload cards:

```tsx
{upload.identified_bowling_alley_name && (
  <p className="text-sm text-primary font-medium">
    📍 {upload.identified_bowling_alley_name}
  </p>
)}
{upload.bowling_alley && (
  <p className="text-xs text-muted-foreground">
    {upload.bowling_alley.city}, {upload.bowling_alley.state}
  </p>
)}
```

## What You'll See Now

When you upload an image with GPS:

```
Brandon.jpeg
11/18/2025, 6:47:04 PM
EXIF: 11/9/2025, 1:58:42 PM
GPS: 41.169833, -112.024161
📍 Fat Cats Ogden                    ← NEW! Bowling alley name
Ogden, UT                            ← NEW! City, State
```

Instead of just:

```
Brandon.jpeg
11/18/2025, 6:47:04 PM
EXIF: 11/9/2025, 1:58:42 PM
GPS: 41.169833, -112.024161
```

## Flow

1. **Upload image** → GPS extracted
2. **Identify bowling alley** → Google Places API called automatically
3. **Save to database** → Both `bowling_alleys` table AND `uploads` table
4. **Display immediately** → Shows on debug card without needing "Identify Location" button

## Benefits

✅ **Immediate feedback** - See bowling alley name as soon as upload completes  
✅ **No extra step** - Don't need to click "Identify Location" button  
✅ **Persistent** - Bowling alley info saved with upload  
✅ **Quick verification** - Can see if identification worked correctly  

## "Identify Location" Button Still Useful

The button is still helpful for:
- Re-identifying if wrong location was detected
- Identifying uploads that were processed before this fix
- Overriding the auto-identified location

## Database Schema

```sql
CREATE TABLE public.uploads (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  storage_path TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  exif_location_lat DECIMAL(10,8),
  exif_location_lng DECIMAL(11,8),
  identified_bowling_alley_id UUID REFERENCES bowling_alleys(id),  -- NEW
  identified_bowling_alley_name TEXT,                              -- NEW
  parsed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Summary

✅ **Migration added**: New columns for bowling alley info  
✅ **Upload route updated**: Saves bowling alley with upload  
✅ **GET endpoint updated**: Returns bowling alley details  
✅ **UI updated**: Displays bowling alley name on cards  

Now when you upload images with GPS, you'll immediately see the identified bowling alley! 🎳

