# Bowling Scorecard Format

## Overview
The game-by-game breakdown now uses the traditional bowling scorecard format with proper frame layout and Radix UI icons.

## Icon Usage

### Radix Icons (PRIMARY)
- **Cross1Icon** (`<Cross1Icon />`) - Displays strikes (X)
- **SlashIcon** (`<SlashIcon />`) - Displays spares (/)

### Lucide Icons (SECONDARY)
- **Trophy** - High score indicator
- **Zap** - Strikes counter
- Other UI/decorative elements

## Traditional Scorecard Format

### Layout Structure
```
┌─────────┬────┬────┬────┬────┬────┬────┬────┬────┬────┬──────┬───────┐
│ Bowler  │ 1  │ 2  │ 3  │ 4  │ 5  │ 6  │ 7  │ 8  │ 9  │  10  │ Total │
├─────────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼──────┼───────┤
│         │ ┌┬┐│ ┌┬┐│ ┌┬┐│ ┌┬┐│ ┌┬┐│ ┌┬┐│ ┌┬┐│ ┌┬┐│ ┌┬┐│ ┌┬┬┐ │       │
│ Ryan    │ └┴┘│ └┴┘│ └┴┘│ └┴┘│ └┴┘│ └┴┘│ └┴┘│ └┴┘│ └┴┘│ └┴┴┘ │  134  │
│         │  X │  X │  X │  X │  X │  X │  X │  X │  X │  X X │       │
└─────────┴────┴────┴────┴────┴────┴────┴────┴────┴────┴──────┴───────┘
```

### Frame Structure (Frames 1-9)
Each frame cell has two sections:
- **Top half (split)**: Two boxes for roll 1 and roll 2
  - Left box: First roll
  - Right box: Second roll
- **Bottom half**: Running total for that frame

### 10th Frame Structure
The 10th frame has three sections:
- **Top half (split)**: Three boxes for up to 3 rolls
  - Left box: First roll
  - Middle box: Second roll
  - Right box: Third roll (bonus)
- **Bottom half**: Running total

## Display Rules

### Strikes
- **Symbol**: `<Cross1Icon />` (Radix UI X icon)
- **Display**: Shows in first box of top half
- **Second box**: Empty (strike ends the frame)

### Spares
- **Symbol**: `<SlashIcon />` (Radix UI / icon)
- **Display**: Shows in second box of top half
- **Calculation**: First roll + second roll = 10

### Numbers
- **1-9**: Display the actual pin count
- **0**: Display as `-` (dash)

### 10th Frame Special Cases
- **Strike**: Can have up to 3 rolls (all can be strikes)
- **Spare**: Can have 3 rolls (third roll is bonus)
- **Regular**: Only 2 rolls if no strike or spare

## Implementation Details

### Accordion Behavior
- **Type**: `multiple` (allows multiple games open at once)
- **Default**: All games expanded by default
- **Collapsible**: Users can collapse/expand individual games

### Table Layout
- **First column**: Bowler names (clickable links)
- **Frames 1-9**: 9 columns with split top/bottom
- **Frame 10**: 1 column with 3-way split top + bottom
- **Last column**: Total score

### Responsive Design
- **Overflow**: Horizontal scroll on small screens
- **Border**: Separates each frame
- **Minimum width**: Ensures readability

## Code Structure

```typescript
// Frame data structure
const frameData = Array.from({ length: 10 }, (_, i) => {
  return game.frames?.find(f => f.frame_number === i + 1) || null
})

// Frames 1-9 rendering
{frameData.slice(0, 9).map((frame, idx) => (
  <TableCell key={idx} className="p-0 border-l">
    <div className="flex flex-col h-full">
      {/* Top half - rolls */}
      <div className="flex h-8 border-b">
        <div className="flex-1 flex items-center justify-center text-sm border-r">
          {/* Roll 1 */}
        </div>
        <div className="flex-1 flex items-center justify-center text-sm">
          {/* Roll 2 */}
        </div>
      </div>
      {/* Bottom half - running total */}
      <div className="flex items-center justify-center h-8 text-sm font-medium">
        {/* Frame total */}
      </div>
    </div>
  </TableCell>
))}

// 10th frame rendering (3 boxes)
<TableCell className="p-0 border-l">
  <div className="flex flex-col h-full">
    <div className="flex h-8 border-b">
      <div className="flex-1 flex items-center justify-center text-sm border-r">
        {/* Roll 1 */}
      </div>
      <div className="flex-1 flex items-center justify-center text-sm border-r">
        {/* Roll 2 */}
      </div>
      <div className="flex-1 flex items-center justify-center text-sm">
        {/* Roll 3 (bonus) */}
      </div>
    </div>
    <div className="flex items-center justify-center h-8 text-sm font-medium">
      {/* Frame total */}
    </div>
  </div>
</TableCell>
```

## Styling

### Vanilla shadcn/ui
- No custom colors or gradients
- Theme-compatible borders and backgrounds
- Standard table components
- Radix Icons (theme-aware)

### Cell Heights
- **Top half**: `h-8` (32px) for roll display
- **Bottom half**: `h-8` (32px) for running total
- **Total cell height**: 64px

### Borders
- **Vertical**: `border-l` between frames
- **Horizontal**: `border-b` between rolls and totals
- **Frame 10**: Extra `border-r` between 3 boxes

## Future Enhancements

Potential improvements:
- Running totals (cumulative scores per frame)
- Color coding for strikes/spares
- Animation when scores appear
- Print-friendly styling
- Mobile-optimized layout
- Frame-by-frame score calculation display

