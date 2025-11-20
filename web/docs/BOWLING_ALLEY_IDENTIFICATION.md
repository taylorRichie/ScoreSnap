# Bowling Alley Identification

## Overview

ScoreSnap automatically identifies and creates bowling alley records using GPS coordinates from image EXIF data and **Google Places API** as the source of truth.

## How It Works

### 1. Image Upload with GPS Data

When you upload an image, the system extracts EXIF metadata including GPS coordinates:

```typescript
// Extract GPS coordinates from EXIF data
const exifLocationLat = convertGPSCoordinate(exifData?.GPSLatitude)
const exifLocationLng = convertGPSCoordinate(exifData?.GPSLongitude)
```

**Note**: Most smartphones automatically embed GPS coordinates in photos. However:
- Some bowling alleys have indoor GPS issues
- Some phones have location services disabled
- Screenshots don't contain GPS data

### 2. Google Places Identification

If GPS coordinates are present, the system uses **Google Places API Nearby Search** to find the nearest bowling alley:

1. **Searches with 0.5 mile radius** first
2. **If no results, expands to 1 mile**
3. **If still no results, expands to 2 miles**
4. **Returns null if no bowling alley found within 2 miles**

The system gets accurate, real-time information from Google:
   - Name
   - Full address (street, city, state, zip)
   - Phone number
   - Website
   - Google Place ID (for deduplication)
   - Exact coordinates
   - Distance from photo location
   - Confidence score (50-95 based on distance)

```typescript
const alleyResult = await getOrCreateBowlingAlley(
  upload.exif_location_lat,
  upload.exif_location_lng,
  userId
)
```

### 3. Database Record Creation & Deduplication

The system prevents duplicates using multiple strategies:

1. **Checks by Google Place ID first** - Most accurate method
2. **Checks by approximate coordinates** (within ~50m) as fallback
3. **Creates new record** if not found:
   ```sql
   INSERT INTO bowling_alleys (
     name,
     address,
     city,
     state,
     zip_code,
     phone,
     website,
     google_place_id,  -- Unique identifier from Google
     latitude,
     longitude,
     created_by_user_id
   )
   ```
4. **Returns the alley ID** to link with the session

This approach ensures the same bowling alley is not created multiple times, even if photos are taken from different parts of the building.

### 4. Session Linking

The `bowling_alley_id` is stored in the `sessions` table:

```typescript
const sessionData = {
  date_time: sessionDateTime,
  location: parsedData.session.location,
  lane: laneNumber,
  bowling_alley_id: bowlingAlleyId,  // ← Linked here
  name: generateSessionName(sessionDateTime),
  created_by_user_id: userId
}
```

## Checking for GPS Data

### Debug Upload Page

The debug upload page now displays GPS status for each image:

```
Brandon.jpeg
11/17/2025, 10:26:13 PM
EXIF: 11/9/2025, 1:58:42 PM
GPS: 40.712776, -74.005974
```

or

```
Screenshot.png
11/17/2025, 10:26:13 PM
⚠️ No GPS data in image
```

### Console Logs

When processing an upload, check the server logs for:

```
🔍 Google Places Nearby Search: 40.712776,-74.005974 radius=805m
✅ Found 3 bowling alley(s) within 0.5 mile(s)
🎯 Nearest alley: Lucky Strike Manhattan at 0.12 miles
📋 Google Places Details: ChIJN1t_tDeuEmsRUsoyG83frY4
✅ Bowling alley identified: Lucky Strike Manhattan
   Address: 123 Main St, New York, NY 10001
   Distance: 0.12 miles
   Confidence: 95%
```

or

```
❌ No GPS coordinates in EXIF data - skipping bowling alley identification
```

## Troubleshooting

### No Bowling Alley Created

**Possible reasons:**

1. **No GPS data in image**
   - Solution: Take photos with location services enabled
   - Workaround: Manually enter location in session

2. **GPS coordinates not near a bowling alley**
   - Google Places didn't find a bowling alley within 2 miles
   - Solution: System falls back to manual location field

3. **Google Places API error**
   - API key issue or quota exceeded
   - Check server logs for error messages
   - Verify `GOOGLE_PLACES_API_KEY` is set in `.env.local`

4. **Network connectivity issues**
   - Server couldn't reach Google Places API
   - Check internet connection and firewall settings

### Duplicate Bowling Alleys

The system **prevents duplicates** effectively using multiple strategies:

1. **Primary**: Checks by `google_place_id` (unique identifier)
2. **Secondary**: Checks by approximate coordinates (within ~50m)
3. **Fallback**: Checks by exact latitude/longitude

This means:
- ✅ Photos from different parts of the same bowling alley are matched correctly
- ✅ The same location gets the same ID, even if coordinates vary slightly
- ✅ Google Place ID provides authoritative deduplication

**Note**: This is a significant improvement over the previous AI-based system, which could create duplicates due to coordinate variations.

## Database Schema

```sql
CREATE TABLE bowling_alleys (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  phone TEXT,
  website TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  created_by_user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE sessions (
  id UUID PRIMARY KEY,
  bowling_alley_id UUID REFERENCES bowling_alleys(id),
  -- other fields...
);
```

## API Configuration

### Setting Up Google Places API Key

1. **Get an API key** from [Google Cloud Console](https://console.cloud.google.com/)
2. **Enable Places API** for your project
3. **Restrict the key** (recommended):
   - HTTP referrer restrictions for web apps
   - IP restrictions for servers
   - Scope to Places API only
4. **Add to environment**:
   ```bash
   # In web/.env.local
   GOOGLE_PLACES_API_KEY=your_api_key_here
   ```

**Important**: Never commit the API key to git. It's already in `.gitignore`.

### API Costs

Google Places API pricing (as of 2024):
- **Nearby Search**: $32 per 1,000 requests
- **Place Details**: $17 per 1,000 requests
- **Free tier**: $200/month credit (≈6,000 identifications)

For a typical bowling app:
- Each bowling alley identification = 1 Nearby Search + 1 Place Details
- Cost per identification ≈ $0.049
- Free tier covers ~4,000 identifications/month

## Privacy Note

GPS coordinates are:
- ✅ **Stored securely** in your database
- ✅ **Only used** to identify bowling alleys
- ✅ **Sent to Google Places API** for accurate identification
- ✅ **Optional** - sessions work without GPS data

## Advantages Over Previous AI System

**Previous (GPT-based)**:
- ❌ Relied on training data (not real-time)
- ❌ Inconsistent results
- ❌ Could create duplicates
- ❌ Expensive ($0.01-0.05 per call)
- ❌ No authoritative source

**Current (Google Places)**:
- ✅ Real-time, accurate data
- ✅ Consistent, reliable results
- ✅ Excellent deduplication via Place ID
- ✅ Cost-effective ($0.049 per identification)
- ✅ Google as source of truth
- ✅ Includes phone, website, verified addresses

## Future Enhancements

Potential improvements:
- Caching Google Places results by place_id
- User ability to select from multiple nearby alleys
- Reverse geocoding when GPS is approximate
- User reviews and ratings integration

