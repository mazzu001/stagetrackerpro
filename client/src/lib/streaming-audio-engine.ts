// Streaming audio engine with lazy initialization to prevent UI blocking
// Pitch shifting libraries removed - focusing on streaming audio only

import type { MuteRegion } from "@shared/schema";

export interface StreamingTrack {
  id: string;
  name: string;
  url: string;
  audioElement: HTMLAudioElement | null;
  source: MediaElementAudioSourceNode | null;
  gainNode: GainNode | null;
  panNode: StereoPannerNode | null;
  analyzerNode: AnalyserNode | null;
  // Pitch shifting removed
  volume: number;
  balance: number;
  isMuted: boolean;
  isSolo: boolean;
  muteRegions?: MuteRegion[];
}

export interface StreamingAudioEngineState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  tracks: StreamingTrack[];
  masterVolume: number;
  masterGainNode: GainNode | null;
  masterOutputNode: GainNode | null;
}

export class StreamingAudioEngine {
  private audioContext: AudioContext;
  private state: StreamingAudioEngineState;
  private listeners: Set<() => void> = new Set();
  private updateInterval: number | null = null;
  private syncTimeouts: number[] = [];
  private durationTimeouts: number[] = [];
  private onSongEndCallback: (() => void) | null = null;
  private scheduledGainChanges: Map<string, number[]> = new Map(); // Track scheduled gain automation IDs
  private songContext: { userEmail: string; songId: string } | null = null;

  constructor() {
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.state = {
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      tracks: [],
      masterVolume: 0.8,
      masterGainNode: null,
      masterOutputNode: null,
    };
    this.setupMasterOutput();
  }

  // Set the song context for the audio engine
  setSongContext(userEmail: string, songId: string) {
    this.songContext = { userEmail, songId };
    console.log(`🎵 Song context set - User: ${userEmail}, Song: ${songId}`);
  }

  // Tone.js initialization removed

  private setupMasterOutput() {
    // Create master gain node (for volume control)
    this.state.masterGainNode = this.audioContext.createGain();
    this.state.masterGainNode.gain.value = this.state.masterVolume;
    
    // Create master output node
    this.state.masterOutputNode = this.audioContext.createGain();
    
    // Simple and reliable audio routing
    this.state.masterGainNode.connect(this.state.masterOutputNode);
    this.state.masterOutputNode.connect(this.audioContext.destination);
    
    console.log('🎵 Master output initialized');
  }

  // Simplified track loading - no pitch processing
  private async checkForProcessedVersions(trackData: Array<{ id: string; name: string; url: string }>): Promise<Array<{ id: string; name: string; url: string }>> {
    console.log('🎵 Loading original tracks...');
    
    // Simply return the original tracks without any pitch processing
    console.log(`🎵 Track loading complete: ${trackData.length} tracks ready`);
    return trackData;
  }

  // Instant track loading with deferred audio node creation
  async loadTracks(trackData: Array<{ 
    id: string; 
    name: string; 
    url: string;
    volume?: number;
    balance?: number;
    muteRegions?: MuteRegion[];
    isMuted?: boolean;
    isSolo?: boolean;
  }>) {
    console.log(`🚀 Streaming load: ${trackData.length} tracks (deferred setup)`);
    
    // Clear existing tracks first
    this.clearTracks();
    
    // Load original tracks without pitch processing
    const tracksToLoad = await this.checkForProcessedVersions(trackData as any);
    
    // Create lightweight track references without audio nodes yet
    const tracks = tracksToLoad.map(track => {
      const extTrack = track as any;
      return {
        id: extTrack.id,
        name: extTrack.name,
        url: extTrack.url,
        audioElement: null as HTMLAudioElement | null,
        source: null as MediaElementAudioSourceNode | null,
        gainNode: null as GainNode | null,
        panNode: null as StereoPannerNode | null,
        analyzerNode: null as AnalyserNode | null,
        // Use incoming track properties or defaults
        volume: extTrack.volume !== undefined ? extTrack.volume / 100 : 1,  // Convert from 0-100 to 0-1
        balance: extTrack.balance || 0,
        isMuted: extTrack.isMuted || false,
        isSolo: extTrack.isSolo || false,
        muteRegions: extTrack.muteRegions || [],
      };
    });
    
    this.state.tracks = tracks;
    
    // Log if any tracks have mute regions
    const tracksWithRegions = tracks.filter(t => t.muteRegions && t.muteRegions.length > 0);
    if (tracksWithRegions.length > 0) {
      console.log(`🔇 Loaded tracks with mute regions: ${tracksWithRegions.map(t => `${t.name} (${t.muteRegions?.length} regions)`).join(', ')}`);
      
      // Create audio nodes for tracks with mute regions and schedule them
      tracksWithRegions.forEach(track => {
        this.ensureTrackAudioNodes(track);
      });
      
      // Schedule mute regions immediately after loading
      setTimeout(() => {
        if (this.state.isPlaying) {
          this.scheduleAllMuteRegions(this.state.currentTime);
          console.log(`🔇 Scheduled mute regions for playing tracks at ${this.state.currentTime.toFixed(1)}s`);
        } else {
          // Schedule from the beginning for non-playing state
          this.scheduleAllMuteRegions(0);
          console.log(`✅ Mute regions scheduled for ${tracksWithRegions.length} tracks from start`);
        }
      }, 50); // Small delay to ensure audio nodes are created
    }
    
    // Set up duration detection in background
    if (tracks.length > 0) {
      setTimeout(() => this.setupDurationDetection(), 0);
    }
    
    this.notifyListeners();
    console.log(`✅ Streaming ready: ${tracks.length} tracks setup instantly (audio nodes created on demand)`);
  }

  // Auto-generate waveform in background for responsive UI
  async autoGenerateWaveform(song: any, userEmail?: string) {
    if (this.state.tracks.length > 0 && song) {
      console.log(`Starting automatic waveform generation for "${song.title}"...`);
      try {
        // Add timeout for waveform generation
        const waveformPromise = (async () => {
          const { waveformGenerator } = await import('./waveform-generator');
          return await waveformGenerator.generateWaveformFromSong(song, userEmail);
        })();
        
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Waveform generation timeout')), 30000); // 30 second timeout
        });
        
        const waveformData = await Promise.race([waveformPromise, timeoutPromise]) as any[];
        console.log(`📈 Waveform auto-generated for "${song.title}" (${waveformData.length} data points)`);
      } catch (error) {
        console.warn(`⚠️ Failed to auto-generate waveform for "${song.title}" (continuing without waveform):`, error);
        // Don't crash - just continue without waveform
      }
    }
  }

  // Create audio nodes on demand to avoid blocking UI
  private ensureTrackAudioNodes(track: StreamingTrack) {
    // Return early if both audio element and nodes exist
    if (track.audioElement && track.gainNode) return;
    
    // Create audio element if it doesn't exist
    if (!track.audioElement) {
      try {
        // Create audio element with comprehensive error handling
        track.audioElement = new Audio();
        
        // Add comprehensive error handlers BEFORE setting src
        const errorHandler = (e: Event) => {
          console.warn(`⚠️ Audio error for ${track.name}:`, e.type, e);
          // Don't crash - just mark track as failed and continue
          track.audioElement = null;
          this.notifyListeners();
        };
        
        track.audioElement.addEventListener('error', errorHandler);
        track.audioElement.addEventListener('abort', errorHandler);
        track.audioElement.addEventListener('stalled', (e) => {
          console.warn(`⚠️ Audio stalled for ${track.name}:`, e);
          // Don't crash on stalled - just log it
        });
        
        // Add load failure handler
        track.audioElement.addEventListener('loadstart', () => {
          console.log(`🔄 Loading started for ${track.name}`);
        });
        
        // Set src with error handling
        try {
          track.audioElement.src = track.url;
          track.audioElement.preload = 'none'; // CRITICAL: No preloading
          track.audioElement.crossOrigin = 'anonymous';
        } catch (srcError) {
          console.error(`❌ Failed to set audio src for ${track.name}:`, srcError);
          track.audioElement = null;
          return; // Exit early if we can't set the source
        }
        
        // Add ended event listener for backup end detection
        const endedHandler = () => {
          if (this.state.isPlaying) {
            console.log(`🔄 Audio element ended event triggered for ${track.name}, triggering callback`);
            // Use callback if available (same path as stop button), otherwise fall back to direct stop
            if (this.onSongEndCallback) {
              this.onSongEndCallback();
            } else {
              this.stop();
            }
          }
        };
        
        track.audioElement.addEventListener('ended', endedHandler);
        // Store reference for cleanup
        (track.audioElement as any).onended = endedHandler;
      } catch (error) {
        console.error(`❌ Critical error creating audio element for ${track.name}:`, error);
        track.audioElement = null;
        return;
      }
    }
    
    // Create Web Audio nodes if they don't exist
    if (track.audioElement && !track.gainNode) {
      try {
        track.source = this.audioContext.createMediaElementSource(track.audioElement);
        track.gainNode = this.audioContext.createGain();
        track.panNode = this.audioContext.createStereoPanner();
        track.analyzerNode = this.audioContext.createAnalyser();
        
        // Connect audio graph
        track.source.connect(track.gainNode);
        track.gainNode.connect(track.panNode);
        track.panNode.connect(track.analyzerNode);
        track.analyzerNode.connect(this.state.masterGainNode!);
        
        // Setup analyzer
        track.analyzerNode.fftSize = 512;
        track.analyzerNode.smoothingTimeConstant = 0.6;
        
        // Apply initial volume/balance/mute settings
        const gainValue = track.volume > 1 ? track.volume / 100 : track.volume;
        track.gainNode.gain.value = track.isMuted ? 0 : gainValue;
        track.panNode.pan.value = track.balance / 100; // Convert -100..100 to -1..1
        
        console.log(`🔧 Audio nodes created for: ${track.name}`);
      } catch (nodeError) {
        console.error(`❌ Failed to create audio nodes for ${track.name}:`, nodeError);
        track.source = null;
        track.gainNode = null;
        track.panNode = null;
        track.analyzerNode = null;
      }
    }
  }

  // Auto-determine duration from longest track
  private setupDurationDetection() {
    if (this.state.tracks.length === 0) return;
    
    // Set up listeners for each track to detect duration
    this.state.tracks.forEach(track => {
      this.ensureTrackAudioNodes(track);
      if (track.audioElement) {
        const metadataHandler = () => {
          if (this.state.tracks.length > 0) {
            const maxDuration = Math.max(...this.state.tracks.map(t => {
              return t.audioElement?.duration || 0;
            }));
            
            if (maxDuration > 0 && maxDuration !== this.state.duration) {
              this.state.duration = maxDuration;
              this.notifyListeners();
            }
          }
        };
        
        track.audioElement.addEventListener('loadedmetadata', metadataHandler);
        // Store reference for cleanup
        (track.audioElement as any).onloadedmetadata = metadataHandler;
      }
    });
    
    // Fallback: keep checking until we get a duration (with timeout management)
    let checkCount = 0;
    const maxChecks = 50; // Maximum 5 seconds at 100ms intervals
    
    const checkDuration = () => {
      if (this.state.tracks.length > 0 && checkCount < maxChecks) {
        const maxDuration = Math.max(...this.state.tracks.map(t => {
          return t.audioElement?.duration || 0;
        }));
        
        if (maxDuration > 0) {
          this.state.duration = maxDuration;
          this.notifyListeners();
        } else {
          checkCount++;
          const timeoutId = window.setTimeout(checkDuration, 100);
          this.durationTimeouts.push(timeoutId);
        }
      }
    };
    checkDuration();
  }

  // Instant play - no loading delays
  async play() {
    // Allow playback even with no tracks loaded (for UI functionality)
    // This allows transport controls to work even when audio files are missing
    
    // Resume audio context if suspended
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
    
    if (this.state.tracks.length === 0) {
      console.log(`▶️ Starting playback with no audio tracks (transport controls only)`);
      this.state.isPlaying = true;
      this.startTimeTracking();
      this.notifyListeners();
      return;
    }
    
    // Ensure all tracks have audio nodes FIRST
    this.state.tracks.forEach(track => this.ensureTrackAudioNodes(track));
    
    console.log(`▶️ Starting streaming playback: ${this.state.tracks.length} tracks`);
    
    // Start all tracks simultaneously
    const playPromises = this.state.tracks.map(track => {
      if (track.audioElement) {
        try {
          track.audioElement.currentTime = this.state.currentTime;
          return track.audioElement.play().catch(err => {
            console.warn(`⚠️ Failed to start streaming track ${track.name}:`, err);
            // Don't crash - just skip this track and continue
            return Promise.resolve();
          });
        } catch (error) {
          console.warn(`⚠️ Error setting currentTime for ${track.name}:`, error);
          return Promise.resolve();
        }
      }
      return Promise.resolve();
    });
    
    await Promise.allSettled(playPromises);
    
    this.state.isPlaying = true;
    this.startTimeTracking();
    
    // Always reschedule mute regions when playing to ensure they're applied
    // This handles cases where audio nodes were just created or playback position changed
    const tracksWithRegions = this.state.tracks.filter(t => t.muteRegions && t.muteRegions.length > 0);
    if (tracksWithRegions.length > 0) {
      console.log(`🔇 Re-scheduling mute regions for ${tracksWithRegions.length} tracks at playback time ${this.state.currentTime.toFixed(1)}s`);
      // Immediately schedule since nodes are guaranteed to exist now
      this.scheduleAllMuteRegions(this.state.currentTime);
    }
    
    this.notifyListeners();
    
    console.log(`✅ Streaming playback started instantly`);
  }

  pause() {
    this.state.tracks.forEach(track => {
      if (track.audioElement) {
        track.audioElement.pause();
      }
    });
    
    this.state.isPlaying = false;
    this.stopTimeTracking();
    this.notifyListeners();
    
    console.log(`⏸️ Streaming playback paused`);
  }

  stop() {
    this.state.tracks.forEach(track => {
      if (track.audioElement) {
        track.audioElement.pause();
        track.audioElement.currentTime = 0;
      }
    });
    
    this.state.isPlaying = false;
    this.state.currentTime = 0;
    this.stopTimeTracking();
    this.notifyListeners();
    
    console.log(`⏹️ Streaming playback stopped`);
  }

  seek(time: number) {
    this.state.currentTime = Math.max(0, Math.min(this.state.duration, time));
    
    // Sync all tracks to new time
    this.state.tracks.forEach(track => {
      if (track.audioElement) {
        track.audioElement.currentTime = this.state.currentTime;
      }
    });
    
    // Reschedule mute regions from new position if playing
    if (this.state.isPlaying) {
      this.scheduleAllMuteRegions(this.state.currentTime);
    }
    
    this.notifyListeners();
    console.log(`⏯️ Streamed to ${this.state.currentTime.toFixed(1)}s`);
  }

  // Track control methods
  setTrackVolume(trackId: string, volume: number) {
    const track = this.state.tracks.find(t => t.id === trackId);
    if (track) {
      track.volume = volume;
      this.ensureTrackAudioNodes(track);
      if (track.gainNode) {
        // Convert percentage (0-100) to gain value (0-1) for Web Audio API
        const gainValue = volume > 1 ? volume / 100 : volume;
        track.gainNode.gain.value = track.isMuted ? 0 : gainValue;
      }
    }
  }

  toggleTrackMute(trackId: string) {
    const track = this.state.tracks.find(t => t.id === trackId);
    if (track) {
      track.isMuted = !track.isMuted;
      this.ensureTrackAudioNodes(track);
      if (track.gainNode) {
        // Convert percentage (0-100) to gain value (0-1) for Web Audio API
        const gainValue = track.volume > 1 ? track.volume / 100 : track.volume;
        track.gainNode.gain.value = track.isMuted ? 0 : gainValue;
      }
    }
  }

  toggleTrackSolo(trackId: string) {
    const track = this.state.tracks.find(t => t.id === trackId);
    if (track) {
      track.isSolo = !track.isSolo;
      this.updateSoloStates();
    }
  }

  setTrackBalance(trackId: string, balance: number) {
    const track = this.state.tracks.find(t => t.id === trackId);
    if (track) {
      track.balance = balance;
      this.ensureTrackAudioNodes(track);
      if (track.panNode) {
        track.panNode.pan.value = balance / 100; // Convert -100..100 to -1..1
      }
    }
  }

  private updateSoloStates() {
    const hasSoloTracks = this.state.tracks.some(t => t.isSolo);
    
    this.state.tracks.forEach(track => {
      this.ensureTrackAudioNodes(track);
      const shouldMute = hasSoloTracks && !track.isSolo;
      if (track.gainNode) {
        // Convert percentage (0-100) to gain value (0-1) for Web Audio API
        const gainValue = track.volume > 1 ? track.volume / 100 : track.volume;
        track.gainNode.gain.value = shouldMute ? 0 : gainValue;
      }
    });
  }

  setMasterVolume(volume: number) {
    this.state.masterVolume = volume;
    if (this.state.masterGainNode) {
      this.state.masterGainNode.gain.value = volume;
    }
  }

  // Mute region scheduling methods
  setTrackMuteRegions(trackId: string, muteRegions: MuteRegion[]) {
    const track = this.state.tracks.find(t => t.id === trackId);
    if (track) {
      track.muteRegions = muteRegions;
      console.log(`🔇 Set ${muteRegions.length} mute regions for track: ${track.name}`);
    }
  }

  private clearScheduledGainChanges(trackId: string) {
    // Clear any existing scheduled automation for this track
    const track = this.state.tracks.find(t => t.id === trackId);
    if (track && track.gainNode) {
      track.gainNode.gain.cancelScheduledValues(this.audioContext.currentTime);
    }
    this.scheduledGainChanges.delete(trackId);
  }

  private scheduleTrackMuteRegions(track: StreamingTrack, currentTime: number) {
    if (!track.gainNode) {
      console.log(`⚠️ No gain node for track ${track.name}, cannot schedule mute regions`);
      return;
    }
    
    if (!track.muteRegions || track.muteRegions.length === 0) {
      return;
    }

    console.log(`🔇 Scheduling ${track.muteRegions.length} mute regions for track: ${track.name}`);
    
    this.clearScheduledGainChanges(track.id);
    const timeoutIds: number[] = [];

    // Calculate the base gain value (considering volume, mute, solo states)
    const hasSoloTracks = this.state.tracks.some(t => t.isSolo);
    const shouldBeMuted = track.isMuted || (hasSoloTracks && !track.isSolo);
    const baseGain = shouldBeMuted ? 0 : (track.volume > 1 ? track.volume / 100 : track.volume);

    // Start with current state
    track.gainNode.gain.cancelScheduledValues(this.audioContext.currentTime);
    track.gainNode.gain.setValueAtTime(baseGain, this.audioContext.currentTime);

    let scheduledCount = 0;
    
    // Schedule mute regions that are relevant from current playback position
    track.muteRegions.forEach(region => {
      const regionStartTime = this.audioContext.currentTime + Math.max(0, region.start - currentTime);
      const regionEndTime = this.audioContext.currentTime + Math.max(0, region.end - currentTime);

      // Only schedule future events
      if (region.end > currentTime && track.gainNode) {
        // If we're currently in a mute region, start muted
        if (region.start <= currentTime && region.end > currentTime) {
          track.gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
          console.log(`  📍 Currently IN mute region (${region.start.toFixed(1)}s-${region.end.toFixed(1)}s), muting immediately`);
          scheduledCount++;
        }
        
        // Schedule mute start (if in future)
        if (region.start > currentTime) {
          track.gainNode.gain.setValueAtTime(0, regionStartTime);
          console.log(`  📍 Scheduled mute START at ${region.start.toFixed(1)}s`);
          scheduledCount++;
        }
        
        // Schedule mute end (if in future) 
        if (region.end > currentTime) {
          track.gainNode.gain.setValueAtTime(baseGain, regionEndTime);
          console.log(`  📍 Scheduled mute END at ${region.end.toFixed(1)}s`);
          scheduledCount++;
        }
      }
    });

    this.scheduledGainChanges.set(track.id, timeoutIds);
    console.log(`✅ Scheduled ${scheduledCount} mute automation events for track: ${track.name} from position ${currentTime.toFixed(1)}s`);
  }

  private scheduleAllMuteRegions(currentTime: number) {
    this.state.tracks.forEach(track => {
      this.scheduleTrackMuteRegions(track, currentTime);
    });
  }

  // Warm up tracks and apply mute regions immediately when song is loaded
  async warmTracksAndApplyMuteRegions() {
    console.log(`🔥 Warming up tracks and applying mute regions...`);
    
    // Ensure all tracks have audio nodes created
    this.state.tracks.forEach(track => {
      this.ensureTrackAudioNodes(track);
    });
    
    // Debug: Log what tracks we have
    console.log(`🔍 Checking ${this.state.tracks.length} tracks for mute regions:`, 
      this.state.tracks.map(t => ({ name: t.name, muteRegions: t.muteRegions?.length || 0 })));
    
    // Check if any tracks have mute regions to schedule (they should already be attached from loading)
    const tracksWithRegions = this.state.tracks.filter(t => t.muteRegions && t.muteRegions.length > 0);
    if (tracksWithRegions.length > 0) {
      console.log(`🔇 Found ${tracksWithRegions.length} tracks with mute regions to schedule`);
      
      // Give audio nodes time to fully initialize, then schedule mute regions
      setTimeout(() => {
        // Schedule mute regions from the beginning (time 0)
        this.scheduleAllMuteRegions(0);
        console.log(`✅ Mute regions scheduled for ${tracksWithRegions.length} tracks`);
      }, 50);
    } else {
      console.log(`📌 No mute regions to schedule`);
    }
  }



  getTrackLevels(trackId: string): { left: number; right: number } {
    const track = this.state.tracks.find(t => t.id === trackId);
    if (!track || !track.analyzerNode || !this.state.isPlaying) {
      return { left: 0, right: 0 };
    }

    const bufferLength = track.analyzerNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    track.analyzerNode.getByteFrequencyData(dataArray);
    
    // Include full frequency spectrum for bass-heavy tracks
    const startBin = Math.floor(bufferLength * 0.02); // Skip only sub-bass (below ~20Hz)
    const endBin = Math.floor(bufferLength * 0.95);   // Use almost full frequency range
    
    // Calculate weighted average with enhanced bass boost and reduced mid/high frequencies
    let sum = 0;
    let weightedCount = 0;
    for (let i = startBin; i < endBin; i++) {
      // Enhanced bass frequency weighting for VU meters
      let weight = 1.0;
      if (i < bufferLength * 0.08) weight = 20.0; // Maximum boost for kick/sub-bass (20-80 Hz)
      else if (i < bufferLength * 0.2) weight = 20.0; // Maximum boost for bass (80-400 Hz)
      else if (i < bufferLength * 0.4) weight = 1.26; // Reduced mids by 10% (was 1.4)
      else weight = 0.99; // Reduced highs by 10% (was 1.1)
      
      sum += dataArray[i] * weight;
      weightedCount += weight;
    }
    
    const rawAverage = sum / weightedCount / 255; // Normalize to 0-1
    
    // Return normalized levels in 0-100 range for consistent VU meter usage
    const average = rawAverage * 100; // Convert to 0-100 range directly
    
    return { left: average, right: average };
  }

  getMasterLevels(): { left: number; right: number } {
    if (!this.state.isPlaying) {
      return { left: 0, right: 0 };
    }
    
    // Calculate combined levels from all tracks
    const combinedLevels = this.state.tracks.reduce((total, tr) => {
      const trackLevels = this.getTrackLevels(tr.id);
      return {
        left: Math.max(total.left, trackLevels.left),
        right: Math.max(total.right, trackLevels.right)
      };
    }, { left: 0, right: 0 });
    
    return combinedLevels;
  }

  // Set callback for when song ends automatically
  setOnSongEndCallback(callback: (() => void) | null) {
    this.onSongEndCallback = callback;
  }

  // Time tracking for smooth playback
  private startTimeTracking() {
    this.stopTimeTracking(); // Clear any existing interval
    
    this.updateInterval = window.setInterval(() => {
      if (this.state.isPlaying) {
        if (this.state.tracks.length > 0) {
          // Use the first track as time reference
          const firstTrack = this.state.tracks[0];
          if (firstTrack.audioElement) {
            const currentTime = firstTrack.audioElement.currentTime;
            this.state.currentTime = currentTime;
            
            // Check if song has reached its end (with tolerance for timing precision)
            const tolerance = 0.1; // 100ms tolerance to catch songs that end slightly early
            if (this.state.duration > 0 && currentTime >= (this.state.duration - tolerance)) {
              console.log(`🔄 Song ended automatically at ${currentTime.toFixed(2)}s (duration: ${this.state.duration.toFixed(2)}s), triggering callback`);
              // Use callback if available (same path as stop button), otherwise fall back to direct stop
              if (this.onSongEndCallback) {
                this.onSongEndCallback();
              } else {
                this.stop();
              }
              return; // Exit early
            }
          }
        } else {
          // No tracks - manually increment time for transport controls
          this.state.currentTime += 0.016; // 16ms increment
          
          // Check duration limit
          if (this.state.duration > 0 && this.state.currentTime >= this.state.duration) {
            this.state.currentTime = this.state.duration;
            if (this.onSongEndCallback) {
              this.onSongEndCallback();
            } else {
              this.stop();
            }
            return;
          }
        }
        
        this.notifyListeners();
      }
    }, 16); // ~60fps updates
  }

  private stopTimeTracking() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    
    this.syncTimeouts.forEach(timeout => clearTimeout(timeout));
    this.syncTimeouts = [];
    this.clearAllTimeouts();
  }

  clearTracks() {
    this.state.tracks.forEach(track => {
      if (track.audioElement) {
        track.audioElement.pause();
        
        // Remove all event listeners before clearing
        track.audioElement.removeEventListener('ended', track.audioElement.onended as any);
        track.audioElement.removeEventListener('loadedmetadata', track.audioElement.onloadedmetadata as any);
        
        // Disconnect audio nodes properly
        if (track.source) {
          try {
            track.source.disconnect();
          } catch (e) {
            // Node might already be disconnected
          }
        }
        if (track.gainNode) {
          try {
            track.gainNode.disconnect();
          } catch (e) {
            // Node might already be disconnected
          }
        }
        if (track.panNode) {
          try {
            track.panNode.disconnect();
          } catch (e) {
            // Node might already be disconnected
          }
        }
        if (track.analyzerNode) {
          try {
            track.analyzerNode.disconnect();
          } catch (e) {
            // Node might already be disconnected
          }
        }
        
        // Clear the audio element completely
        track.audioElement.src = '';
        track.audioElement.load(); // Force garbage collection
      }
      
      // Clear all node references
      track.audioElement = null;
      track.source = null;
      track.gainNode = null;
      track.panNode = null;
      track.analyzerNode = null;
    });
    this.state.tracks = [];
    
    // Clear any pending duration detection timeouts
    this.clearAllTimeouts();
  }

  private clearAllTimeouts() {
    this.durationTimeouts.forEach(timeout => clearTimeout(timeout));
    this.durationTimeouts = [];
  }

  getState(): StreamingAudioEngineState {
    return { ...this.state };
  }

  get isLoading(): boolean {
    return false; // Streaming is always ready
  }

  get isReady(): boolean {
    // Allow playback even with no audio files loaded
    // This enables the UI to work even when audio files are missing
    return true;
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener());
  }

  dispose() {
    this.stopTimeTracking();
    this.clearTracks();
    this.clearAllTimeouts();
    
    if (this.state.masterGainNode) {
      try {
        this.state.masterGainNode.disconnect();
      } catch (e) {
        // Node might already be disconnected
      }
    }
    
    // Force garbage collection for Edge browser
    const isEdge = /Edg|Edge/.test(navigator.userAgent);
    if (isEdge) {
      console.log('📱 Edge browser: Forcing memory cleanup');
      // Small delay to let cleanup complete
      setTimeout(() => {
        if ((window as any).gc) {
          (window as any).gc();
        }
      }, 100);
    }
    
    if (this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
  }
}