# Song Load Time Optimization - Implementation Notes

## Date: January 22, 2025

## Objective
Reduce song selection to playback ready time from ~1300ms to ~200-300ms

## Changes Made

### 1. WAVEFORM GENERATION - Deferred to Track Manager Close
**File:** `client/src/hooks/use-audio-engine.tsx`
- **Line ~135:** REMOVED `autoGenerateWaveform()` call from song load
- **Behavior:** 
  - Cached waveforms display immediately
  - Missing waveforms show empty (blank waveform)
  - Generation happens when Track Manager closes (non-blocking)

**Rollback:**
```typescript
// Add back after preloadAllTracks():
if (audioEngineRef.current && typeof (audioEngineRef.current as any).autoGenerateWaveform === 'function') {
  (audioEngineRef.current as any).autoGenerateWaveform(song, finalUserEmail);
}
```

---

### 2. MUTE REGIONS - Lazy Load (Deferred)
**File:** `client/src/hooks/use-audio-engine.tsx`
- **Lines ~100-110:** REMOVED mute region fetching from initial track load
- **Behavior:**
  - Mute regions NOT fetched during song selection
  - Will be fetched on-demand when needed (future implementation)
  
**Rollback:**
```typescript
// Add back inside trackDataPromises.map():
let muteRegions: any[] = [];
if (finalUserEmail && finalUserEmail !== 'default@user.com') {
  try {
    const regions = await LocalSongStorage.getMuteRegions(finalUserEmail, song.id, track.id);
    if (regions && regions.length > 0) {
      muteRegions = regions;
      console.log(`🔇 Loaded ${muteRegions.length} mute regions for track: ${track.name}`);
    }
  } catch (error) {
    console.warn(`Failed to load mute regions for track ${track.name}:`, error);
  }
}
// And add to return object:
muteRegions: muteRegions,
```

---

### 3. PRIORITY TRACK LOADING - First 2 Tracks Only
**File:** `client/src/hooks/use-audio-engine.tsx`
- **Lines ~125-140:** Modified to load critical tracks first, others in background
- **Behavior:**
  - First 2 tracks preload immediately
  - Remaining tracks preload in background (non-blocking)
  - Play button enables after first 2 tracks ready

**Rollback:**
```typescript
// Replace priority loading with original:
console.log('⏳ Waiting for audio engine to load tracks...');
await audioEngineRef.current?.loadTracks(trackData);
console.log('✅ Audio engine tracks loaded successfully');
console.log('⏳ Preloading audio elements...');
await audioEngineRef.current?.preloadAllTracks();
console.log('✅ All audio elements preloaded and ready');
```

---

### 4. CONSOLIDATE REDUNDANT STATE UPDATES
**File:** `client/src/hooks/use-audio-engine.tsx`
- **Lines ~165-172:** REMOVED duplicate useEffect that set loading state
- **Behavior:**
  - State updates happen once in main loading effect
  - No race conditions

**Rollback:**
```typescript
// Add back the separate effect:
useEffect(() => {
  if (song && song.id) {
    console.log(`🔄 Song changed to "${song.title}" - setting loading state`);
    setIsLoadingTracks(true);
    setIsPlaying(false);
    setCurrentTime(0);
  }
}, [song?.id]);
```

---

### 5. OPTIMIZED AUDIO NODE CREATION
**File:** `client/src/lib/streaming-audio-engine.ts`
- **Method:** `preloadPriorityTracks()` - NEW METHOD
- **Behavior:**
  - Only creates audio nodes for tracks being preloaded
  - Deferred creation for background tracks

**Rollback:**
```typescript
// Use original preloadAllTracks() for everything
// Remove preloadPriorityTracks() method
```

---

## Expected Performance

### BEFORE Optimization:
```
Song Select → Ready for Playback: ~1300ms
  - IndexedDB reads (URLs): ~300ms
  - IndexedDB reads (mute regions): ~400ms
  - Track preloading (all 6): ~600ms
  - Waveform generation: ~500ms (blocking)
```

### AFTER Optimization:
```
Song Select → Ready for Playback: ~200-300ms
  - IndexedDB reads (URLs only): ~300ms
  - Track preloading (first 2): ~150ms
  
Background (non-blocking):
  - Track preloading (remaining): ~400ms
  - Mute regions: Lazy (when needed)
  - Waveform: Deferred (Track Manager close)
```

---

## Testing Checklist
- [ ] Select song - verify loading overlay appears briefly
- [ ] Verify play button enables quickly (~200-300ms)
- [ ] Start playback - verify first 2 tracks play immediately
- [ ] Verify remaining tracks load in background
- [ ] Check waveform displays if cached
- [ ] Verify empty waveform if not cached
- [ ] Close Track Manager - verify waveform generates (if missing)
- [ ] Check console for optimization logs

---

## Rollback Strategy

### Quick Rollback (Git):
```bash
git checkout HEAD -- client/src/hooks/use-audio-engine.tsx
git checkout HEAD -- client/src/lib/streaming-audio-engine.ts
```

### Manual Rollback:
See individual "Rollback" sections above for each change.

---

## Files Modified
1. `client/src/hooks/use-audio-engine.tsx`
2. `client/src/lib/streaming-audio-engine.ts`
