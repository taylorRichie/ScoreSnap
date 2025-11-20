# Roll Value Conversion

## Problem

OpenAI Vision API returns bowling frame data with special characters for strikes, spares, and misses:
- `"X"` or `"x"` for strikes
- `"/"` for spares
- `"-"` for misses (0 pins)
- Numbers as strings (e.g., `"7"`) or integers

However, the database expects numeric values in `roll_1`, `roll_2`, and `roll_3` columns.

## Solution

The `validateAndCleanParsedData` function in `/web/src/lib/vision.ts` now includes a `convertRoll` helper function that:

1. **Converts strikes (`X`)** → `10`
2. **Converts spares (`/`)** → `10 - previousRoll` (e.g., if roll_1 = 7, then roll_2 = "/" becomes 3)
3. **Converts misses (`-`)** → `0`
4. **Parses numeric strings** → integers (e.g., `"7"` → `7`)
5. **Preserves numbers** → as-is

## Example

### OpenAI Response:
```json
{
  "frame_number": 2,
  "roll_1": 7,
  "roll_2": "/",
  "roll_3": null,
  "notation": "7/"
}
```

### After Conversion:
```json
{
  "frame_number": 2,
  "roll_1": 7,
  "roll_2": 3,  // Calculated: 10 - 7 = 3
  "roll_3": null,
  "notation": "7/"
}
```

### Database Storage:
```
frame_number: 2
roll_1: 7
roll_2: 3
roll_3: NULL
notation: "7/"
```

## Why Keep Notation?

The `notation` field preserves the original bowling notation (e.g., `"7/"`, `"X"`, `"9-"`) for display purposes, while the numeric `roll_1`, `roll_2`, `roll_3` values are used for:
- Score calculations
- Statistics
- Filtering/querying

## Display Logic

The UI (session detail page) uses the `notation` field to determine what to display:
- If `notation === "X"` → Show strike icon (Cross1Icon)
- If `notation` contains `"/"` → Show spare icon (slash SVG)
- Otherwise → Show the numeric roll values

This approach gives us:
- ✅ Accurate numeric data for calculations
- ✅ Proper bowling notation for display
- ✅ Flexibility to handle various OpenAI response formats

