# Bowling Alley Identification Flow

## Overview

Bowling alley identification happens **automatically during AI analysis**, not when clicking "Add to Database". The system uses GPS coordinates from image EXIF data to identify and create bowling alley records.

## Complete Flow

### 1. User Uploads Image

```
User clicks "Upload" → Image saved to disk → EXIF data extracted (GPS, date/time)
```

### 2. User Clicks "Process with AI"

This triggers a single API call that does everything:

```
POST /api/uploads/[id]/process
```

### 3. AI Analysis (Parallel Operations)

The system performs these operations:

**A. Vision Analysis (OpenAI GPT-4o-mini)**
- Analyzes the bowling scoreboard image
- Extracts bowler names, scores, frames, teams
- Returns structured JSON data

**B. Bowling Alley Identification (if GPS available)**
- Extracts GPS coordinates from EXIF data
- Calls `getOrCreateBowlingAlley()` function
- Uses OpenAI GPT-4o-mini to identify nearby bowling alleys
- Creates or finds existing bowling alley record

### 4. Automatic Persistence

After AI analysis completes, the system automatically:

```typescript
// This happens automatically, no "Add to Database" button needed
const persistResult = await persistParsedScoreboardWithResolution(
  uploadId,
  parsedData,
  resolvedMappings,
  userId
)
```

Inside `persistParsedScoreboardWithResolution`:

1. **Get EXIF data** from upload record
2. **Identify bowling alley** from GPS coordinates
3. **Find or create session** (with `bowling_alley_id`)
4. **Create teams** (checking for duplicates)
5. **Create bowlers** (with name resolution)
6. **Create series and games**

### 5. Display Results

The bowling alley information is immediately available:

- **Sessions List**: Shows bowling alley name
- **Session Detail**: Shows full bowling alley info (name, address, phone, website)
- **Breadcrumb**: Shows session name (which includes bowling alley if available)

## Code Flow

```typescript
// 1. User clicks "Process with AI"
POST /api/uploads/[id]/process

// 2. Vision analysis
const visionResult = await parseBowlingScoreboard(filePath)

// 3. Name resolution check
const nameResolution = await analyzeNameResolution(visionResult.parsedData)

// 4. Automatic persistence (includes bowling alley identification)
const persistResult = await persistParsedScoreboardWithResolution(
  uploadId,
  visionResult.parsedData,
  nameResolution.resolvedMappings,
  userId
)

// Inside persistParsedScoreboardWithResolution:

// Get GPS from upload
const { data: upload } = await supabase
  .from('uploads')
  .select('exif_datetime, exif_location_lat, exif_location_lng')
  .eq('id', uploadId)
  .single()

// Identify bowling alley from GPS
if (upload.exif_location_lat && upload.exif_location_lng) {
  const alleyResult = await getOrCreateBowlingAlley(
    upload.exif_location_lat,
    upload.exif_location_lng,
    userId
  )
  bowlingAlleyId = alleyResult.alleyId
}

// Create session with bowling_alley_id
const sessionData = {
  name: generateSessionName(sessionDateTime),
  date_time: sessionDateTime,
  bowling_alley_id: bowlingAlleyId,  // ← Linked here
  gps_latitude: upload.exif_location_lat,
  gps_longitude: upload.exif_location_lng,
  // ...
}
```

## Bowling Alley Identification Details

### Input
- GPS Latitude (e.g., 41.169833)
- GPS Longitude (e.g., 112.024161)

### Process
1. Check if bowling alley already exists at those exact coordinates
2. If not found, call OpenAI GPT-4o-mini with prompt:
   ```
   Find the nearest bowling alley to these GPS coordinates: [lat, lng]
   Return: name, address, city, state, zip, phone, website
   ```
3. Create new `bowling_alleys` record
4. Return `alleyId`

### Output
- `bowling_alley_id` stored in session
- Full bowling alley details available via join

## Why No "Add to Database" Button?

The "Add to Database" button was **removed** because:

1. **Redundant**: Data is already persisted after AI analysis
2. **Confusing**: Users thought they needed to click it
3. **Misleading**: Bowling alley identification was already happening during AI analysis, not when clicking this button
4. **Unnecessary**: The system automatically handles everything

## Console Logging

During "Process with AI", you'll see:

```
🤖 Starting OpenAI Vision processing...
🎳 Checking for GPS coordinates in upload: { lat: 41.169833, lng: 112.024161 }
🎳 Attempting to identify bowling alley from GPS coordinates: 41.169833 112.024161
🏢 getOrCreateBowlingAlley called with: { latitude: 41.169833, longitude: 112.024161 }
🔍 Calling identifyBowlingAlley...
✅ Bowling alley identified and saved: Lucky Strike Lanes ID: abc-123-def
📝 Creating new session (no match found)
✅ Created new session: xyz-789-ghi
✅ Created team team-1 for Team A
✅ Associated bowler Ryan with team Team A
```

## Troubleshooting

### Bowling Alley Not Showing

**Check:**
1. Does the image have GPS coordinates? (Look for "GPS: lat, lng" in debug UI)
2. Check server logs for "🎳 Attempting to identify bowling alley"
3. Check for errors in `getOrCreateBowlingAlley`

**Common Issues:**
- Image has no GPS data (screenshots, GPS disabled)
- GPS coordinates not near a bowling alley
- OpenAI API error or rate limit

### Session Not Showing Bowling Alley

**Check:**
1. Does the session have a `bowling_alley_id`?
2. Is the bowling alley record in the database?
3. Is the API query joining `bowling_alleys` table?

## Database Schema

```sql
-- Bowling alley record
CREATE TABLE bowling_alleys (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  phone TEXT,
  website TEXT,
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  created_by_user_id UUID REFERENCES auth.users(id)
);

-- Session links to bowling alley
CREATE TABLE sessions (
  id UUID PRIMARY KEY,
  bowling_alley_id UUID REFERENCES bowling_alleys(id),  -- ← Link
  gps_latitude DECIMAL(10,8),
  gps_longitude DECIMAL(11,8),
  -- ...
);
```

## Benefits

1. **Automatic**: No manual entry needed
2. **Fast**: Happens in parallel with vision analysis
3. **Accurate**: Uses GPS coordinates for precise location
4. **Reusable**: Same bowling alley record used for multiple sessions
5. **Rich Data**: Includes address, phone, website from OpenAI
6. **Session Matching**: GPS coordinates help match uploads to same session

