# Google Places API Implementation

## ✅ Implementation Complete

ScoreSnap now uses **Google Places API** as the source of truth for bowling alley identification, replacing the previous GPT-based inference system.

## What Was Implemented

### 1. New Google Places Service (`src/lib/google-places.ts`)

A comprehensive service that:
- ✅ Calls Google Places Nearby Search API
- ✅ Implements radius expansion (0.5 → 1 → 2 miles)
- ✅ Calculates exact distances using Haversine formula
- ✅ Fetches detailed place information
- ✅ Parses address components (street, city, state, zip)
- ✅ Checks for existing alleys by Place ID and coordinates
- ✅ Saves new bowling alleys to database

### 2. Updated Vision Service (`src/lib/vision.ts`)

- ✅ Replaced GPT-based identification with Google Places
- ✅ Updated `identifyBowlingAlley()` to use new service
- ✅ Updated `getOrCreateBowlingAlley()` with better deduplication
- ✅ Returns comprehensive bowling alley information

### 3. Database Migration

- ✅ Created migration: `20241119000000_rename_place_id_to_google_place_id.sql`
- ✅ Renamed `place_id` → `google_place_id` for clarity
- ✅ Added index on `google_place_id` for faster lookups
- ✅ Migration applied successfully

### 4. Environment Configuration

- ✅ Added `GOOGLE_PLACES_API_KEY` to `.env.local`
- ✅ Updated `env.example` with new variable
- ✅ API key secured (not committed to git)

### 5. Updated Documentation

- ✅ Updated `BOWLING_ALLEY_IDENTIFICATION.md` with new implementation details
- ✅ Documented API setup and costs
- ✅ Added troubleshooting guide
- ✅ Explained advantages over previous system

## How It Works

### Request Flow

```
1. User uploads image with GPS coordinates
   ↓
2. System calls identifyBowlingAlley(lat, lng, userId)
   ↓
3. Google Places Nearby Search (0.5 mile radius)
   ↓
4. If no results → expand to 1 mile
   ↓
5. If no results → expand to 2 miles
   ↓
6. If results found:
   - Calculate exact distances
   - Get nearest alley
   - Fetch Place Details (address, phone, website)
   - Check if alley exists in database (by place_id or coordinates)
   - Save if new
   - Return bowling alley info
   ↓
7. Link to session
```

### Deduplication Strategy

The system prevents duplicates using **three-tier matching**:

1. **Primary**: Google Place ID (unique identifier from Google)
2. **Secondary**: Approximate coordinates (within ~50m)
3. **Fallback**: Exact latitude/longitude

This ensures photos taken from different parts of the same bowling alley are correctly matched.

## API Configuration

Your API key is already configured in `.env.local`:

```bash
GOOGLE_PLACES_API_KEY=your-google-api-key-here
```

**Security Notes:**
- ✅ API key is in `.env.local` (gitignored)
- ✅ Never committed to repository
- ⚠️ Recommend restricting key to your server IP in Google Cloud Console

## Testing Results

Tested with real coordinates:

### ✅ Lucky Strike Times Square (NYC)
```
Location: 40.758896, -73.985130
Result: Found at 0.14 miles
Name: Lucky Strike Times Square
Address: 222 W 44th St, New York, NY 10036, USA
Phone: (212) 680-0012
Website: https://www.luckystrikeent.com/...
Place ID: ChIJUf2r9FRYwokRKrasyV7rvwQ
```

### Service Verification
- ✅ API authentication working
- ✅ Nearby Search functional
- ✅ Place Details retrieval working
- ✅ Distance calculation accurate
- ✅ Radius expansion logic operational
- ✅ Address parsing correct

## API Costs

### Pricing (as of 2024)
- **Nearby Search**: $32 per 1,000 requests
- **Place Details**: $17 per 1,000 requests
- **Total per identification**: $0.049

### Free Tier
- $200/month credit from Google
- Covers ~4,000 bowling alley identifications/month
- More than sufficient for typical usage

### Cost Comparison

**Before (GPT-4o)**:
- $0.01-0.05 per identification
- Inconsistent results
- Could create duplicates

**After (Google Places)**:
- $0.049 per identification
- Consistent, accurate results
- Excellent deduplication
- Real-time data

## Advantages Over Previous System

| Feature | GPT-based (Before) | Google Places (Now) |
|---------|-------------------|---------------------|
| Data source | Training data (outdated) | Real-time Google data |
| Accuracy | Inconsistent (inference) | Highly accurate |
| Deduplication | Poor (coordinate-based only) | Excellent (Place ID + coordinates) |
| Information | Name, approximate address | Full details + verified data |
| Cost | $0.01-0.05 | $0.049 |
| Reliability | Variable | Consistent |
| Phone/Website | Often missing | Usually included |
| Updates | Never | Real-time |

## Files Modified/Created

### Created
- `/web/src/lib/google-places.ts` - New service (399 lines)
- `/supabase/migrations/20241119000000_rename_place_id_to_google_place_id.sql` - Migration
- `/web/docs/GOOGLE_PLACES_IMPLEMENTATION.md` - This document

### Modified
- `/web/src/lib/vision.ts` - Updated bowling alley identification
- `/web/env.example` - Added GOOGLE_PLACES_API_KEY
- `/web/.env.local` - Added API key (not in git)
- `/web/docs/BOWLING_ALLEY_IDENTIFICATION.md` - Updated documentation

### Database
- Renamed column: `place_id` → `google_place_id`
- Added index on `google_place_id`
- Migration applied successfully

## Usage

The integration is **automatically active**. No code changes needed in your existing upload flow.

### Existing Code Works As-Is

```typescript
// In your upload processing route
const alleyResult = await getOrCreateBowlingAlley(
  upload.exif_location_lat,
  upload.exif_location_lng,
  userId
)

if (alleyResult.alleyId) {
  // Link to session
  await supabase
    .from('sessions')
    .update({ bowling_alley_id: alleyResult.alleyId })
    .eq('id', sessionId)
}
```

### New Response Structure

```typescript
{
  alleyId: "uuid-string",
  alleyInfo: {
    name: "Lucky Strike Times Square",
    address: "222 W 44th St",
    city: "New York",
    state: "NY",
    zipCode: "10036",
    phone: "(212) 680-0012",
    website: "https://www.luckystrikeent.com/...",
    confidence: 0.95,  // 0-1 scale
    source: "google-places",
    placeId: "ChIJUf2r9FRYwokRKrasyV7rvwQ",
    distanceMiles: 0.14
  }
}
```

## Monitoring

### Console Logs

When a bowling alley is identified, you'll see:

```
🔍 Identifying bowling alley using Google Places API...
🔍 Searching for bowling alleys within 0.5 mile(s)...
✅ Found 2 bowling alley(s) within 0.5 mile(s)
🎯 Nearest alley: Lucky Strike Times Square at 0.14 miles
📋 Google Places Details: ChIJUf2r9FRYwokRKrasyV7rvwQ
✅ Bowling alley identified: Lucky Strike Times Square
   Address: 222 W 44th St, New York, NY 10036
   Distance: 0.14 miles
   Confidence: 95%
✅ Found existing alley in database: Lucky Strike Times Square
```

### Error Handling

The service handles:
- ✅ No GPS coordinates → Returns null gracefully
- ✅ No bowling alley within 2 miles → Returns null
- ✅ API errors → Logs error, returns null
- ✅ Invalid coordinates → Validates and rejects
- ✅ Network issues → Catches and logs

## Next Steps (Optional Enhancements)

Future improvements you might consider:

1. **Caching**: Cache Google Places results by `place_id` to reduce API calls
2. **User Selection**: Allow users to choose from multiple nearby alleys if multiple are found
3. **Fallback Search**: Try text search if nearby search finds nothing
4. **User Reviews**: Integrate Google ratings and reviews
5. **Photos**: Fetch bowling alley photos from Google Places
6. **Hours**: Display operating hours
7. **Analytics**: Track which alleys are most frequented

## Troubleshooting

### API Key Issues

If you see `GOOGLE_PLACES_API_KEY not configured`:

1. Check `.env.local` exists in `/web/`
2. Verify key is present and not commented out
3. Restart your dev server after adding key

### No Results Found

If no bowling alley is found for a valid location:

1. Check the location has GPS coordinates
2. Verify bowling alley exists in Google Maps
3. Try searching in Google Maps to confirm it's classified as a bowling alley
4. Some smaller alleys might not be in Google's database

### API Errors

If you see Google Places API errors:

1. **INVALID_REQUEST**: Check coordinate format
2. **REQUEST_DENIED**: API key issue or Places API not enabled
3. **OVER_QUERY_LIMIT**: Exceeded free tier (unlikely for bowling app)
4. **UNKNOWN_ERROR**: Temporary Google issue, retry

## Support

For issues or questions:
- Check logs for detailed error messages
- Review `/web/docs/BOWLING_ALLEY_IDENTIFICATION.md`
- Verify API key in Google Cloud Console
- Check Google Places API quota/billing

## Summary

✅ **Implementation is complete and tested**
✅ **All existing code continues to work**
✅ **Better accuracy and reliability than GPT-based system**
✅ **Excellent deduplication with Place ID**
✅ **Real-time data from authoritative source**
✅ **Cost-effective with generous free tier**

The system is ready to use immediately!

