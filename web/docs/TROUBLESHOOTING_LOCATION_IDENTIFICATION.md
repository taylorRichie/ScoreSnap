# Troubleshooting Location Identification

## Using the "Identify Location" Button

The "Identify Location" button is **already functional** in the Debug Upload page at `/debug/upload`.

### How to Use It

1. Navigate to **Debug Upload** page (`/debug/upload`)
2. Upload an image with GPS coordinates
3. After processing, click the **"Identify Location"** button
4. The system will search for bowling alleys using Google Places API
5. If found, it will link the bowling alley to your session

### What It Does

The button:
- ✅ Reads GPS coordinates from your image EXIF data
- ✅ Calls Google Places Nearby Search API
- ✅ Searches within 0.5 → 1 → 2 miles radius
- ✅ Identifies the nearest bowling alley
- ✅ Saves it to database (if new)
- ✅ Links it to your session (if upload has a session)
- ✅ Can override existing bowling alley assignment

## Why Location Identification Might Fail

### 1. No GPS Data in Image

**Symptom**: You see "⚠️ No GPS data in image" under the upload

**Causes**:
- Location services were disabled when photo was taken
- Screenshot instead of camera photo
- GPS data stripped by editing software
- Indoor location with poor GPS signal

**Solution**:
- Enable location services on your phone before taking photos
- Take new photos with location enabled
- Use original photos, not screenshots or edited versions

### 2. No Bowling Alley Within 2 Miles

**Symptom**: Toast message says "Could not identify bowling alley within 2 miles"

**Causes**:
- Bowling alley is more than 2 miles from photo location
- Google doesn't have the bowling alley in its database
- Bowling alley is classified differently in Google (e.g., "Entertainment Center")
- GPS coordinates are inaccurate (common indoors)

**Solution**:
1. **Check the coordinates**: Look in browser console for exact coordinates
2. **Verify in Google Maps**: 
   - Copy/paste coordinates: `lat, lng`
   - Search Google Maps to see if there's a bowling alley nearby
3. **Manual workaround**: If the alley exists but wasn't found, you can still use the session without automated location

### 3. Google Places API Error

**Symptom**: Error message in console or toast

**Causes**:
- API key not configured
- API quota exceeded
- Network connectivity issues
- API key restrictions blocking the request

**Solution**:
1. Check `.env.local` has `GOOGLE_PLACES_API_KEY`
2. Verify API key in Google Cloud Console
3. Check API quota/billing
4. Review API key restrictions

## Checking Server Logs

To see detailed logging:

### 1. Terminal Running `npm run dev`

Look for logs like:

```
📍 Identifying bowling alley for upload: abc123
📍 GPS coordinates: 40.758896, -73.985130
🔍 Searching for bowling alleys within 0.5 mile(s)...
✅ Found 2 bowling alley(s) within 0.5 mile(s)
🎯 Nearest alley: Lucky Strike Times Square at 0.14 miles
✅ Bowling alley identified: Lucky Strike Times Square
✅ Distance: 0.14 miles
✅ Confidence: 95%
📝 Updating session with bowling_alley_id: def456
✅ Session updated successfully
```

Or if it fails:

```
📍 Identifying bowling alley for upload: abc123
📍 GPS coordinates: 40.616528, -111.886635
🔍 Searching for bowling alleys within 0.5 mile(s)...
⚠️ No results within 0.5 mile(s)
🔍 Searching for bowling alleys within 1 mile(s)...
⚠️ No results within 1 mile(s)
🔍 Searching for bowling alleys within 2 mile(s)...
⚠️ No results within 2 mile(s)
❌ No bowling alleys found within 2 miles
⚠️ Could not identify bowling alley
⚠️ Reason: No bowling alley found within 2 miles of coordinates
```

### 2. Browser Console

Open DevTools (F12) and look in Console tab for:

```javascript
📍 Location identification result: {
  success: true,
  bowlingAlley: {
    name: "Lucky Strike Times Square",
    address: "222 W 44th St",
    city: "New York",
    state: "NY",
    phone: "(212) 680-0012",
    website: "https://...",
    distanceMiles: 0.14,
    confidence: 0.95,
    source: "google-places",
    placeId: "ChIJUf2r9FRYwokRKrasyV7rvwQ"
  },
  coordinates: { lat: 40.758896, lng: -73.985130 }
}
```

## Enhanced Error Messages

The system now shows detailed information:

### Success Message
```
✅ Location identified: Lucky Strike Times Square (0.14 mi away, 95% confidence)
```

Browser console shows:
```
📍 Address: 222 W 44th St New York NY
📞 Phone: (212) 680-0012
🌐 Website: https://www.luckystrikeent.com/...
🆔 Google Place ID: ChIJUf2r9FRYwokRKrasyV7rvwQ
```

### Failure Message
```
⚠️ Could not identify bowling alley within 2 miles of this location (40.616528, -111.886635)
```

Browser console shows:
```
⚠️ No bowling alley found at coordinates: { lat: 40.616528, lng: -111.886635 }
💡 Tip: Try searching these coordinates in Google Maps to verify if there is a bowling alley nearby
```

## Common Scenarios

### Scenario 1: Wrong GPS Coordinates (Indoor Photos)

**Problem**: Photo taken inside bowling alley has inaccurate GPS

**Why**: Smartphones often can't get accurate GPS indoors, may report coordinates from when you entered the building or a nearby cell tower

**Solution**:
- Take photos near windows or entrance for better GPS
- Manually verify coordinates match bowling alley location
- If coordinates are off, the system may not find the alley

### Scenario 2: New or Unlisted Bowling Alley

**Problem**: Bowling alley is new or not in Google's database

**Why**: Google Places data may not include very new establishments or small local alleys

**Solution**:
- Verify alley exists in Google Maps
- You can still use ScoreSnap without automated location
- Consider adding the bowling alley to Google Maps Business

### Scenario 3: Entertainment Center Classification

**Problem**: Venue has bowling but is classified as "Entertainment Center" or "Arcade"

**Why**: Google Places API searches specifically for type `bowling_alley`

**Solution**:
- This is a limitation of the current implementation
- May require future enhancement to search broader categories
- Manual session entry still works

## Testing Your Setup

### Test with Known Location

Use coordinates of a well-known bowling alley:

**Times Square, NYC** (near Lucky Strike):
```
Latitude: 40.758896
Longitude: -73.985130
```

This should find "Lucky Strike Times Square" at ~0.14 miles.

### Steps to Test:

1. Create a test image with those GPS coordinates
2. Upload to ScoreSnap
3. Click "Identify Location"
4. Should successfully identify Lucky Strike

If this works, your setup is correct and issue is with your image's GPS data.

## Manual Override

The "Identify Location" button **can be used to override** an existing bowling alley assignment:

1. Upload already has a bowling alley linked
2. Click "Identify Location" again
3. System will re-run identification
4. If different alley found, it will update the session

This is useful if:
- Initial automated identification was wrong
- You want to force re-identification
- GPS data was updated or corrected

## API Quota Check

If you're hitting quota limits:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** > **Dashboard**
3. Click **Places API**
4. Check **Quotas** tab
5. Verify you haven't exceeded:
   - 0-100,000 requests: Free
   - $200/month credit typically covers ~4,000 identifications

## Quick Checklist

When location identification fails:

- [ ] Image has GPS data (check upload list)
- [ ] Coordinates are reasonable (not 0,0 or out of range)
- [ ] Bowling alley exists at those coordinates (check Google Maps)
- [ ] Google Places API key is configured in `.env.local`
- [ ] Dev server is running and showing logs
- [ ] Browser console shows detailed error info
- [ ] API quota not exceeded (check Google Cloud Console)
- [ ] Network connectivity is working

## Still Having Issues?

1. **Check exact coordinates**: Look in browser console
2. **Verify in Google Maps**: Paste coordinates to see what's there
3. **Check server logs**: Look for detailed error messages
4. **Test with known location**: Try Times Square coordinates above
5. **Verify API key**: Make sure it's valid and not restricted
6. **Check API billing**: Ensure Places API is enabled with billing

## What Gets Stored

When location is successfully identified:

```sql
-- Bowling Alley Record
INSERT INTO bowling_alleys (
  name,                    -- "Lucky Strike Times Square"
  address,                 -- "222 W 44th St"
  city,                    -- "New York"
  state,                   -- "NY"
  zip_code,               -- "10036"
  phone,                  -- "(212) 680-0012"
  website,                -- "https://..."
  google_place_id,        -- "ChIJUf2r9FRYwokRKrasyV7rvwQ"
  latitude,               -- 40.758896 (from Google)
  longitude,              -- -73.985130 (from Google)
  created_by_user_id      -- Your user ID
)

-- Session Update
UPDATE sessions 
SET bowling_alley_id = <new_id>
WHERE id = <session_id>
```

The bowling alley is:
- ✅ Saved once in `bowling_alleys` table
- ✅ Referenced by multiple sessions
- ✅ Deduplicated by Google Place ID
- ✅ Reused for future uploads at same location

## Summary

- ✅ **Button is working**: Already hooked up and functional
- ✅ **Manual trigger**: Click anytime to identify or re-identify
- ✅ **Override existing**: Can update existing bowling alley assignment
- ✅ **Detailed logging**: Check server logs and browser console
- ✅ **Clear error messages**: Shows coordinates and helpful tips
- ✅ **Auto-retry**: Expands search radius automatically

The system is ready to use! If location isn't found, it's likely because:
1. No GPS data in image
2. No bowling alley within 2 miles
3. Google doesn't have that alley in database

Check the logs and coordinates to diagnose the specific issue.

