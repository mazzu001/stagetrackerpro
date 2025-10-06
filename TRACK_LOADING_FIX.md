# Track Loading Race Condition Fix

## Problem
Users could click the Play button before tracks were fully loaded, causing:
- Playback timer to start moving
- No audio output
- Confusing user experience

## Root Causes
1. **`isReady` always returned `true`** - The audio engine's isReady check was hardcoded to return true
2. **Race condition in state updates** - `isLoadingTracks` had a brief moment where it was false during song changes
3. **No visual feedback** - Users couldn't see when tracks were loading

## Solutions Implemented

### 1. Immediate Loading State (use-audio-engine.tsx)
Added a new useEffect that sets `isLoadingTracks=true` IMMEDIATELY when song changes:
```typescript
useEffect(() => {
  if (song && song.id) {
    console.log(`🔄 Song changed to "${song.title}" - setting loading state`);
    setIsLoadingTracks(true);
    setIsPlaying(false); // Also stop playback
    setCurrentTime(0); // Reset position
  }
}, [song?.id]);
```

### 2. Fixed isReady Check (streaming-audio-engine.ts)
Changed from always returning `true` to actually checking if tracks are loaded:
```typescript
get isReady(): boolean {
  // Check if we have tracks loaded and they're ready for playback
  return this.state.tracks.length > 0 && this.state.tracks.every(track => 
    track.audioElement !== null || track.audioBuffer !== null
  );
}
```

### 3. Enhanced Play Function (use-audio-engine.tsx)
Improved error messages and logging:
```typescript
const play = useCallback(async () => {
  if (!audioEngineRef.current || !song) {
    console.log('⚠️ Cannot play: No audio engine or song selected');
    return;
  }
  
  if (!audioEngineRef.current.isReady) {
    console.log('⚠️ Tracks not fully loaded yet - please wait');
    return;
  }
  
  // ... rest of play logic
}, [song]);
```

### 4. Visual Loading Indicator (performance.tsx)
Added loading overlay to waveform area:
```tsx
{isLoadingTracks && selectedSong && (
  <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10 rounded">
    <div className="flex items-center space-x-2 text-sm text-muted-foreground">
      <Loader2 className="w-4 h-4 animate-spin" />
      <span>Loading tracks...</span>
    </div>
  </div>
)}
```

## Event Flow (After Fix)

1. **User selects song** → `selectedSongId` changes
2. **performance.tsx** → Fetches song data, calls `setSelectedSong(song)`
3. **use-audio-engine.tsx** → Detects `song.id` change
4. **IMMEDIATELY sets:**
   - `isLoadingTracks = true` ✅
   - `isPlaying = false` ✅
   - `currentTime = 0` ✅
5. **Play button disabled** (because `isLoadingTracks=true`)
6. **Loading overlay appears** over waveform
7. **Async track loading begins:**
   - Fetch audio URLs from IndexedDB
   - Load mute regions
   - Initialize audio elements
   - Preload all tracks
8. **Only after ALL tracks ready:**
   - `setIsLoadingTracks(false)` ✅
   - `isReady` returns `true` ✅
   - Play button enabled ✅
   - Loading overlay disappears ✅

## Testing Checklist
- [ ] Select a song - verify "Loading tracks..." appears
- [ ] Try clicking Play immediately - should be disabled
- [ ] Wait for loading to complete - Play button enables
- [ ] Click Play - audio should start immediately
- [ ] Switch to different song - loading state should reset
- [ ] Check console for proper log sequence

## Benefits
✅ **No more silent playback** - Users can't start playback until tracks are ready  
✅ **Clear visual feedback** - Users know when app is loading  
✅ **Proper state management** - Loading state is set immediately, no race conditions  
✅ **Better error handling** - Clear console messages for debugging  
✅ **Professional UX** - Loading overlay matches app's design language  

## Date
January 22, 2025
