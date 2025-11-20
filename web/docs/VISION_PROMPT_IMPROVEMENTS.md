# Vision API Prompt Improvements

## Problem: Series Total vs Game Score Confusion

### Issue
Modern bowling alley displays show multiple types of scores:
- **Game Score**: Individual game score (0-300 max)
- **Series Total**: Cumulative score across multiple games (can exceed 300)

The AI vision model was sometimes picking up series totals instead of individual game scores, resulting in impossible scores like 329 for a single game.

### Example
From a bowling alley screen showing Game 3:
```
G3                           360      1101
┌─────────┬────────────────────────┬──────┬──────┐
│ Erin    │ [frame boxes]          │ 122  │ 329  │
│ Croix   │ [frame boxes]          │ 103  │ 330  │
│ Blake   │ [frame boxes]          │  78  │ 206  │
│ Nash    │ [frame boxes]          │  57  │ 236  │
└─────────┴────────────────────────┴──────┴──────┘
```

- **360** and **1101** at the top = series totals for teams/lanes
- **122** = Erin's game score (correct) ✅
- **329** = Erin's series total across all games (wrong to use) ❌

### Root Cause
The original prompt didn't explicitly instruct the AI to:
1. Differentiate between game scores and series totals
2. Validate that game scores cannot exceed 300
3. Prioritize scores closer to frame boxes over cumulative totals

## Solution (Part 1: Score Validation)

### 1. Enhanced Prompt Instructions
Added explicit "CRITICAL SCORE EXTRACTION RULES" to the vision prompt:

```typescript
CRITICAL SCORE EXTRACTION RULES:
1. A single bowling game score can NEVER exceed 300 (perfect game)
2. Modern bowling displays show TWO types of scores:
   - GAME SCORE: Individual game score (0-300) - THIS IS WHAT WE WANT
   - SERIES TOTAL: Cumulative total across multiple games (can exceed 300) - IGNORE THIS
3. The GAME SCORE is typically displayed closer to the frame boxes
4. SERIES TOTALS are usually displayed separately, often at the top or far right
5. Look for game indicators like "G1", "G2", "G3" to identify which game is being shown
6. If you see a number > 300, it's a SERIES TOTAL - look for the actual game score elsewhere
7. When in doubt, choose the lower number that makes sense for a single game (0-300 range)
```

### 2. Server-Side Validation
Added validation logic in `validateAndCleanParsedData()` to catch any scores that slip through:

```typescript
// Validate total_score - must be between 0-300 for a valid game
let totalScore: number | null = null
if (game.total_score && typeof game.total_score === 'number') {
  if (game.total_score > 300) {
    console.warn(`⚠️ Invalid score detected for ${bowlerName} Game ${gameNumber}: ${game.total_score} (exceeds 300). This is likely a series total, not a game score. Setting to null.`)
    totalScore = null
  } else if (game.total_score < 0) {
    console.warn(`⚠️ Invalid negative score detected for ${bowlerName} Game ${gameNumber}: ${game.total_score}. Setting to null.`)
    totalScore = null
  } else {
    totalScore = game.total_score
  }
}
```

### 3. Game Number Recognition
Enhanced prompt to recognize game indicators like "G1", "G2", "G3" on scoreboards:

```typescript
4. Game numbers should be 1, 2, 3, etc. based on position (or extract from labels like "G1", "G2", "G3")
```

## Solution (Part 2: Game Completeness Validation)

### Problem
When a game is complete (all 10 frames bowled), but the AI fails to parse some frames, we end up with:
- 10th frame with data
- Missing frames 1-9 (parsing failure)
- Invalid/incomplete game data in database

This is a **parsing error**, not a partial game. A partial game means bowling is still in progress.

### Enhanced Validation Logic

#### 1. Prompt Instructions for Completeness
Added "CRITICAL GAME COMPLETENESS RULES" to guide the AI:

```typescript
CRITICAL GAME COMPLETENESS RULES:
1. Determine if each game is COMPLETE or PARTIAL (in-progress)
2. A game is COMPLETE if the 10th frame has a total score displayed
3. A game is PARTIAL if bowling is still in progress (frames are empty or in-progress)
4. For COMPLETE games: ALL 10 frames MUST have roll data - if any frame is missing, this is a parsing error
5. For PARTIAL games: Only include frames that have been bowled (1-9 frames may be incomplete)
6. If you see a 10th frame score but frames 1-9 are not all visible or parseable, SKIP this bowler entirely
7. Better to exclude a bowler than to include incomplete data for a completed game
```

#### 2. Server-Side Completeness Validation
Added validation after frame processing:

```typescript
// CRITICAL VALIDATION: Check game completeness
// If the 10th frame has data, ALL frames 1-10 must exist
let validatedFrames = processedFrames
if (processedFrames && processedFrames.length > 0) {
  const has10thFrame = processedFrames.some((f: any) => f.frame_number === 10)
  
  if (has10thFrame) {
    // Game is COMPLETE - validate all frames exist
    const frameNumbers = processedFrames.map((f: any) => f.frame_number).sort((a: number, b: number) => a - b)
    const missingFrames = []
    
    for (let i = 1; i <= 10; i++) {
      if (!frameNumbers.includes(i)) {
        missingFrames.push(i)
      }
    }
    
    if (missingFrames.length > 0) {
      console.error(`❌ GAME REJECTED: ${bowlerName} Game ${gameNumber} is COMPLETE (has 10th frame) but missing frames: ${missingFrames.join(', ')}. This indicates a parsing error. Returning null frames.`)
      validatedFrames = null
      totalScore = null // Also clear the score since the game data is invalid
    }
  } else {
    // Game is PARTIAL - this is OK, only include frames that were bowled
    console.log(`✓ ${bowlerName} Game ${gameNumber} is PARTIAL (in-progress). Frames present: ${processedFrames.map((f: any) => f.frame_number).join(', ')}`)
  }
}
```

### How It Works

**Complete Game (10th frame exists):**
- ✅ Frames 1-10 all present → Game accepted
- ❌ Frames 1, 2, 5, 10 present (missing 3, 4, 6-9) → Game REJECTED with error log

**Partial Game (10th frame missing):**
- ✅ Frames 1-7 present → Game accepted as partial (in-progress)
- ✅ Frames 1-3 present → Game accepted as partial (still bowling)
- ✅ No rejection - any number of frames 1-9 is valid for partial games

### Error Messages

**Rejected Complete Game:**
```
❌ GAME REJECTED: Ryan Game 2 is COMPLETE (has 10th frame) but missing frames: 3, 5, 7. 
   This indicates a parsing error. Returning null frames.
```

**Accepted Partial Game:**
```
✓ Ryan Game 1 is PARTIAL (in-progress). Frames present: 1, 2, 3, 4, 5, 6, 7
```

## Benefits

1. **Automatic Validation**: Scores > 300 are automatically rejected with warnings
2. **Better AI Guidance**: Clear instructions help the AI distinguish between score types
3. **Completeness Enforcement**: Complete games must have all frames or they're rejected
4. **Parsing Error Detection**: Identifies when the AI failed to read all frames properly
5. **Partial Game Support**: Still allows in-progress games to be captured
6. **Logging**: Warnings are logged to console for debugging and monitoring
7. **Graceful Handling**: Invalid data is set to null rather than corrupting database
8. **Data Integrity**: Prevents incomplete game data from being stored

## Testing Recommendations

When testing with new uploads:
1. **Check console logs** for validation warnings:
   - ⚠️ Score validation warnings (> 300 detected)
   - ❌ Game rejection errors (missing frames in complete games)
   - ✓ Partial game notifications (expected for in-progress games)
2. **Verify game scores** are within 0-300 range
3. **Check frame completeness**:
   - Complete games should have all 10 frames
   - Partial games can have 1-9 frames
   - No complete games with missing frames
4. **Look for patterns** in which screen types cause confusion
5. **Take clearer photos** when possible (better lighting, straight-on angle)
6. **Test edge cases**:
   - Multi-game series (G1, G2, G3)
   - In-progress games (partial frames)
   - Complete games with all frames visible
   - Poor quality images (blurry, angled, glare)

## Future Improvements

### Image Preprocessing
Consider adding preprocessing for poor quality images:
- Auto-brightness/contrast adjustment
- Perspective correction for angled photos
- Noise reduction
- Sharpening

### OCR Fallback
For extremely unclear images, consider:
- Running traditional OCR (Tesseract) alongside GPT Vision
- Comparing results for validation
- Using OCR for numerical values, GPT Vision for structure

### User Feedback Loop
- Allow users to flag incorrect scores
- Collect problematic images for training data
- Build confidence scores based on image quality

## Related Files

- `/web/src/lib/vision.ts` - Vision API and validation logic
- `/web/docs/BOWLING_SCORECARD_FORMAT.md` - Scorecard structure
- `/web/src/app/api/uploads/[id]/process/route.ts` - Upload processing

## Image Quality Guidelines

For best results, take photos that are:
- ✅ Straight-on (not angled)
- ✅ Well-lit (avoid glare and shadows)
- ✅ In focus (not blurry)
- ✅ Full screen visible (all bowlers and frames)
- ✅ High resolution (modern phone cameras work great)

Avoid:
- ❌ Angled/tilted perspectives
- ❌ Glare or reflections
- ❌ Low light / dark screens
- ❌ Blurry or out-of-focus
- ❌ Partial screens (cropped bowlers)
- ❌ Very low resolution

