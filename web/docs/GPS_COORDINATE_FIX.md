# GPS Coordinate Hemisphere Fix

## Critical Bug Fixed

**Issue**: GPS coordinates were being parsed without the hemisphere reference (N/S/E/W), causing Western longitudes to be positive instead of negative.

**Impact**: All locations in the Western Hemisphere (USA, Canada, South America) had incorrect longitude coordinates, placing them on the wrong side of the planet.

## The Problem

### Before Fix

```javascript
const convertGPSCoordinate = (gpsArray: number[] | undefined): number | null => {
  if (!gpsArray || !Array.isArray(gpsArray) || gpsArray.length !== 3) {
    return null
  }
  const [degrees, minutes, seconds] = gpsArray
  return degrees + (minutes / 60) + (seconds / 3600)
}

// Example: Utah bowling alley
// Input: [111, 53, 30.5592]
// Output: 111.891822 ❌ WRONG (should be negative)
```

This put Utah coordinates at **111.891822°E** (somewhere in China) instead of **-111.891822°W** (Utah, USA).

### After Fix

```javascript
const convertGPSCoordinate = (
  gpsArray: number[] | undefined, 
  ref: string | undefined
): number | null => {
  if (!gpsArray || !Array.isArray(gpsArray) || gpsArray.length !== 3) {
    return null
  }
  const [degrees, minutes, seconds] = gpsArray
  let decimal = degrees + (minutes / 60) + (seconds / 3600)
  
  // Apply hemisphere: South (S) and West (W) are negative
  if (ref === 'S' || ref === 'W') {
    decimal = -decimal
  }
  
  return decimal
}

// Example: Utah bowling alley
// Input: [111, 53, 30.5592], 'W'
// Output: -111.891822 ✅ CORRECT
```

## EXIF GPS Data Structure

GPS coordinates in EXIF data include both the coordinate array AND a hemisphere reference:

```javascript
{
  GPSLatitude: [40, 53, 6.7884],      // Degrees, Minutes, Seconds
  GPSLatitudeRef: 'N',                // North or South
  GPSLongitude: [111, 53, 30.5592],   // Degrees, Minutes, Seconds
  GPSLongitudeRef: 'W'                // East or West
}
```

### Hemisphere Rules

- **Latitude**:
  - `N` (North): Positive (+)
  - `S` (South): Negative (-)

- **Longitude**:
  - `E` (East): Positive (+)
  - `W` (West): Negative (-)

## Real-World Example

### Utah Bowling Alley

**EXIF Data**:
```
Latitude:  40°53'6.7884"N
Longitude: 111°53'30.5592"W
```

**Before Fix**:
```
40.885219, 111.891822
```
This placed the location in **Inner Mongolia, China** 🇨🇳

**After Fix**:
```
40.885219, -111.891822
```
This correctly places the location in **Utah, USA** 🇺🇸

## Impact on Google Places

### Before Fix
```
🔍 Searching: 40.885219, 111.891822
❌ No bowling alleys found (searching in China)
```

### After Fix
```
🔍 Searching: 40.885219, -111.891822
✅ Found bowling alleys in Utah!
```

## Testing

Verified with multiple hemisphere combinations:

| Location | Coordinates | Expected | Result |
|----------|-------------|----------|--------|
| Utah, USA | 40°53'N, 111°53'W | 40.885, -111.892 | ✅ Pass |
| Sydney, Australia | 33°51'S, 151°12'E | -33.865, 151.200 | ✅ Pass |
| Tokyo, Japan | 35°41'N, 139°41'E | 35.689, 139.691 | ✅ Pass |
| Buenos Aires, Argentina | 34°36'S, 58°22'W | -34.603, -58.381 | ✅ Pass |

## Affected Code

### File: `web/src/app/api/uploads/route.ts`

**Lines Modified**: 115-146

**Changes**:
1. Added `GPSLatitudeRef` and `GPSLongitudeRef` to EXIF parsing
2. Updated `convertGPSCoordinate` to accept `ref` parameter
3. Applied hemisphere logic: negate if `S` or `W`

## Database Impact

### Existing Records

Any uploads processed before this fix have **incorrect GPS coordinates** stored in the database:

```sql
-- Old uploads with Western longitude (USA)
-- These will have positive longitude instead of negative
SELECT id, exif_location_lng
FROM uploads
WHERE exif_location_lng > 0  -- Should be negative for USA
  AND created_at < '2024-11-19';  -- Before fix date
```

### Migration Options

**Option 1**: Re-upload images (recommended)
- Delete old uploads
- Upload again with fixed parser
- GPS coordinates will be correct

**Option 2**: Manual correction (advanced)
```sql
-- Fix USA/Western Hemisphere coordinates
UPDATE uploads
SET exif_location_lng = -exif_location_lng
WHERE exif_location_lng > 0
  AND exif_location_lng < 180
  AND created_at < '2024-11-19';
```

⚠️ **Warning**: Only run if you're certain all affected records are in Western Hemisphere.

## Verification

After this fix, you can verify coordinates are correct:

1. **Check upload record**:
   ```
   Latitude: 40.885219 (positive - Northern Hemisphere ✓)
   Longitude: -111.891822 (negative - Western Hemisphere ✓)
   ```

2. **Verify in Google Maps**:
   - Copy coordinates: `40.885219, -111.891822`
   - Paste into Google Maps search
   - Should show location in Utah, USA

3. **Test "Identify Location" button**:
   - Should now find bowling alleys in correct location
   - Distance should be accurate

## Related Files

- `/web/src/app/api/uploads/route.ts` - GPS parsing (FIXED)
- `/web/src/lib/google-places.ts` - Uses coordinates to search
- `/web/src/app/api/uploads/[id]/identify-location/route.ts` - Manual identification

## Summary

✅ **Fixed**: GPS coordinates now correctly handle hemispheres  
✅ **Tested**: Verified with N/S/E/W combinations  
✅ **Impact**: Western Hemisphere locations now work correctly  
✅ **Future**: All new uploads will have correct coordinates  

⚠️ **Note**: Old uploads may need to be re-uploaded or manually corrected in database.

## How to Verify Your Uploads

1. Go to `/debug/upload`
2. Find your upload
3. Check the GPS coordinates displayed
4. For USA locations:
   - Latitude should be **positive** (20-50 range)
   - Longitude should be **NEGATIVE** (-70 to -170 range)
5. If longitude is positive, that upload was processed before the fix

## Next Steps

1. ✅ Re-upload any images that were processed with incorrect coordinates
2. ✅ Click "Identify Location" button to link to bowling alley
3. ✅ Verify coordinates in Google Maps if unsure

The fix is now live and all new uploads will have correct GPS coordinates! 🎉

