# Booking Conflict Detection Algorithm Verification

## Algorithm Description

The conflict detection algorithm identifies overlapping bookings for the same game:

1. **Input**: Array of bookings sorted by start_time, filtered by scope (all/storefront/mobile)
2. **Process**:
   - For each booking (i), check all subsequent bookings (j where j > i)
   - Skip if bookings are for different games (parallel games allowed)
   - Break if current.end_time <= other.start_time (sorted, no more overlaps possible)
   - If overlap detected, mark both as conflicting
3. **Output**: Bookings with conflict flag + conflict details array

## Example Scenarios

### Scenario 1: Same Game, Overlapping Times
```
Game A: 14:00-15:00 ❌ CONFLICT
Game A: 14:30-15:30 ❌ CONFLICT
```

### Scenario 2: Same Game, Sequential Times (No Conflict)
```
Game A: 14:00-15:00 ✓ OK
Game A: 15:00-16:00 ✓ OK
```

### Scenario 3: Different Games, Overlapping Times (No Conflict)
```
Game A: 14:00-15:00 ✓ OK
Game B: 14:30-15:30 ✓ OK
```

### Scenario 4: Multiple Conflicts
```
Game A: 14:00-15:00 ❌ CONFLICT
Game A: 14:30-15:30 ❌ CONFLICT
Game A: 15:00-16:00 ❌ CONFLICT
```

## Code Verification

### Original Implementation (state.ts lines 1998-2009)
```typescript
// conflict detection
for (let i = 0; i < filtered.length; i += 1) {
  const current = filtered[i];
  current.conflict = 0;
  for (let j = i + 1; j < filtered.length; j += 1) {
    const other = filtered[j];
    if (current.game_id !== other.game_id) continue;
    if (current.end_time <= other.start_time) break;
    current.conflict = 1;
    other.conflict = 1;
  }
}
```

### New Implementation (bookings/index.svelte.ts)
```typescript
// Conflict detection algorithm
// Two bookings conflict if they're for the same game and their time ranges overlap
for (let i = 0; i < filtered.length; i += 1) {
  const current = filtered[i];
  current.conflict = 0;
  for (let j = i + 1; j < filtered.length; j += 1) {
    const other = filtered[j];
    // Skip if different games (games can run in parallel)
    if (current.game_id !== other.game_id) continue;
    // If current ends before other starts, no more conflicts possible (sorted by start_time)
    if (current.end_time <= other.start_time) break;
    // Overlap detected - mark both as conflicting
    current.conflict = 1;
    other.conflict = 1;
  }
}
```

## Verification Checklist

✅ **Algorithm Logic**: Exact match - both implementations use identical nested loop structure
✅ **Game Comparison**: Both skip conflicts for different games (`current.game_id !== other.game_id`)
✅ **Early Exit Optimization**: Both use `break` when `current.end_time <= other.start_time`
✅ **Conflict Marking**: Both set `conflict = 1` for overlapping bookings
✅ **Initialization**: Both reset `current.conflict = 0` at start of inner loop
✅ **Array Indexing**: Both use `i` and `j = i + 1` pattern correctly

## Performance Characteristics

- **Time Complexity**: O(n²) worst case (all bookings for same game with overlaps)
- **Space Complexity**: O(1) (in-place marking)
- **Optimization**: Early break when no more overlaps possible (sorted data)

## Integration Points

1. **Input Source**: SQLite query sorted by `start_time ASC`
2. **Output Format**: `BookingCalendarResponse` with conflicts array
3. **Real-time Updates**: Called by `broadcastBookingsUpdate()` to emit via WebSocket
