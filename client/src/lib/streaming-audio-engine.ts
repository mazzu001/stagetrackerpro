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
  // Enhanced panning nodes for 100% isolation
  channelSplitter?: ChannelSplitterNode | null;
  leftGainNode?: GainNode | null;
  rightGainNode?: GainNode | null;
  channelMerger?: ChannelMergerNode | null;
  useEnhancedPanning?: boolean;
  // Channel-specific analyzers for true stereo metering
  leftAnalyzer?: AnalyserNode | null;
  rightAnalyzer?: AnalyserNode | null;
  postPanSplitter?: ChannelSplitterNode | null;
  // Mono-to-stereo conversion support
  audioBuffer?: AudioBuffer | null;
  bufferSource?: AudioBufferSourceNode | null;
  hasMonoConversion?: boolean;
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
  private useEnhancedPanning: boolean = true; // Enable 100% isolation panning
  // Add timing reference properties for AudioContext-based tracks
  private audioContextStartTime: number = 0;
  private playbackStartTime: number = 0;

  constructor() {
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.state = {
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      tracks: [],
      masterVolume: 1.0,
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

  // Preload all tracks to ensure they're ready for playback
  async preloadAllTracks(): Promise<void> {
    console.log(`⏳ Preloading ${this.state.tracks.length} tracks...`);
    let errorOccurred = false;
    
    // PHASE 1: Check and convert mono tracks FIRST (before creating audio elements)
    console.log(`🔧 Phase 1: Checking for mono tracks that need conversion...`);
    const conversionPromises = this.state.tracks.map(async (track) => {
      if (!track.hasMonoConversion) {
        await this.checkAndConvertMono(track);
      }
    });
    
    try {
      await Promise.all(conversionPromises);
      console.log(`✅ Mono conversion phase complete`);
    } catch (error) {
      console.warn(`⚠️ Some mono conversions failed (continuing):`, error);
    }
    
    // PHASE 2: Create audio nodes and preload
    console.log(`🔧 Phase 2: Creating audio elements and preloading...`);
    const preloadPromises = this.state.tracks.map(async (track) => {
      try {
        this.ensureTrackAudioNodes(track);
        if (track.audioElement) {
          return new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
              console.warn(`⚠️ Preload timeout for ${track.name}`);
              errorOccurred = true;
              reject(new Error(`Preload timeout for ${track.name}`));
            }, 5000);
            const onCanPlay = () => {
              clearTimeout(timeout);
              if (track.audioElement) {
                track.audioElement.removeEventListener('canplay', onCanPlay);
                track.audioElement.removeEventListener('error', onError);
              }
              console.log(`✅ Track ready: ${track.name}`);
              resolve();
            };
            const onError = (e: Event) => {
              clearTimeout(timeout);
              if (track.audioElement) {
                track.audioElement.removeEventListener('canplay', onCanPlay);
                track.audioElement.removeEventListener('error', onError);
              }
              console.warn(`⚠️ Failed to preload ${track.name}:`, e);
              errorOccurred = true;
              reject(new Error(`Failed to preload ${track.name}`));
            };
            if (track.audioElement && track.audioElement.readyState >= 2) {
              clearTimeout(timeout);
              console.log(`✅ Track already ready: ${track.name}`);
              resolve();
            } else if (track.audioElement) {
              track.audioElement.addEventListener('canplay', onCanPlay, { once: true });
              track.audioElement.addEventListener('error', onError, { once: true });
              track.audioElement.preload = 'metadata';
              track.audioElement.load();
            }
          });
        }
      } catch (error) {
        console.warn(`⚠️ Error preloading track ${track.name}:`, error);
        errorOccurred = true;
        throw error;
      }
    });
    try {
      await Promise.all(preloadPromises);
      console.log(`✅ All ${this.state.tracks.length} tracks preloaded and ready`);
    } catch (err) {
      errorOccurred = true;
      console.error('❌ One or more tracks failed to preload:', err);
      throw err;
    }
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
    
    // Mono conversion should already be done during preload
    // This ensures we don't re-convert on demand
    
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
        // Use MediaElementAudioSourceNode for ALL tracks (mono and stereo)
        // The browser's MediaElement natively handles mono files by playing them in both channels
        console.log(`🔧 Using MediaElementAudioSourceNode for track: ${track.name}`);
        track.source = this.audioContext.createMediaElementSource(track.audioElement);
        
        track.gainNode = this.audioContext.createGain();
        track.analyzerNode = this.audioContext.createAnalyser();
        
        if (this.useEnhancedPanning) {
          // Enhanced panning for 100% isolation
          track.channelSplitter = this.audioContext.createChannelSplitter(2);
          track.leftGainNode = this.audioContext.createGain();
          track.rightGainNode = this.audioContext.createGain();
          track.channelMerger = this.audioContext.createChannelMerger(2);
          track.useEnhancedPanning = true;
          
          // Create channel-specific analyzers for true stereo metering
          track.postPanSplitter = this.audioContext.createChannelSplitter(2);
          track.leftAnalyzer = this.audioContext.createAnalyser();
          track.rightAnalyzer = this.audioContext.createAnalyser();
          
          // Setup analyzer properties
          track.leftAnalyzer.fftSize = 512;
          track.leftAnalyzer.smoothingTimeConstant = 0.6;
          track.rightAnalyzer.fftSize = 512;
          track.rightAnalyzer.smoothingTimeConstant = 0.6;
          
          // Connect enhanced audio graph (source is always MediaElement now)
          track.source.connect(track.gainNode);
          track.gainNode.connect(track.channelSplitter);
          
          // Connect channels through individual gain nodes
          track.channelSplitter.connect(track.leftGainNode, 0); // Left channel
          track.channelSplitter.connect(track.rightGainNode, 1); // Right channel
          
          // Merge back to stereo
          track.leftGainNode.connect(track.channelMerger, 0, 0); // Left to left
          track.rightGainNode.connect(track.channelMerger, 0, 1); // Right to right
          
          // Split the post-panning signal for channel-specific analysis
          track.channelMerger.connect(track.postPanSplitter);
          track.postPanSplitter.connect(track.leftAnalyzer, 0); // Left channel to left analyzer
          track.postPanSplitter.connect(track.rightAnalyzer, 1); // Right channel to right analyzer
          
          // Keep the original analyzer for compatibility (measures combined signal)
          track.channelMerger.connect(track.analyzerNode);
          
          // Connect to master
          track.analyzerNode.connect(this.state.masterGainNode!);
          
          console.log(`🎯 Enhanced audio nodes created for: ${track.name} (100% isolation + stereo metering)`);
        } else {
          // Fallback to standard StereoPanner
          track.panNode = this.audioContext.createStereoPanner();
          track.useEnhancedPanning = false;
          
          // Connect standard audio graph (source is always MediaElement now)
          track.source.connect(track.gainNode);
          track.gainNode.connect(track.panNode);
          track.panNode.connect(track.analyzerNode);
          track.analyzerNode.connect(this.state.masterGainNode!);
          
          // Apply standard panning
          track.panNode.pan.value = track.balance / 100;
          
          console.log(`🔧 Standard audio nodes created for: ${track.name}`, {
            nodeType: 'StereoPannerNode',
            initialBalance: track.balance,
            initialPanValue: track.balance / 100
          });
        }
        
        // Setup analyzer
        track.analyzerNode.fftSize = 512;
        track.analyzerNode.smoothingTimeConstant = 0.6;
        
        // Apply initial volume/balance/mute settings
        const gainValue = track.volume > 1 ? track.volume / 100 : track.volume;
        track.gainNode.gain.value = track.isMuted ? 0 : gainValue;
        
        // Apply initial balance
        this.applyBalance(track, track.balance);
        
        console.log(`✅ Audio setup complete for: ${track.name}`, {
          enhancedPanning: track.useEnhancedPanning,
          initialBalance: track.balance
        });
      } catch (nodeError) {
        console.error(`❌ Failed to create audio nodes for ${track.name}:`, nodeError);
        track.source = null;
        track.gainNode = null;
        track.panNode = null;
        track.analyzerNode = null;
      }
    }
  }

  // Check channel count without converting (MediaElement handles mono natively)
  private async checkAndConvertMono(track: StreamingTrack) {
    try {
      console.log(`🔍 Checking audio format for: ${track.name}`);
      
      // Fetch just enough data to decode and check channel count
      const response = await fetch(track.url);
      if (!response.ok) {
        throw new Error(`Failed to fetch audio: ${response.status}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      
      const channelCount = audioBuffer.numberOfChannels;
      console.log(`📊 Detected: ${channelCount === 1 ? 'mono' : 'stereo'} for ${track.name}`);
      
      if (channelCount === 1) {
        // Mono audio - MediaElementAudioSourceNode will handle it natively
        console.log(`✅ Mono audio detected: ${track.name} - MediaElement will play in both channels (no conversion needed)`);
        track.hasMonoConversion = true; // Mark as checked
        this.ensureTrackAudioNodes(track);
      } else {
        // Stereo audio - use normal HTMLAudioElement path
        console.log(`✅ Stereo audio detected: ${track.name} - using standard playback`);
        track.hasMonoConversion = true; // Mark as checked
        this.ensureTrackAudioNodes(track);
      }
      
    } catch (error) {
      console.error(`❌ Audio format check failed for ${track.name}:`, error);
      // Fallback to standard audio element (will work regardless)
      track.hasMonoConversion = true; // Mark as checked to avoid infinite loop
      this.ensureTrackAudioNodes(track);
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
    
    // Start all tracks simultaneously using MediaElement
    const playPromises = this.state.tracks.map(track => {
      if (track.audioElement) {
        // All tracks use HTMLAudioElement now (handles both mono and stereo)
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
        // Pause HTMLAudioElement (handles all tracks now)
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
        // Stop HTMLAudioElement (handles all tracks now)
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
    
    // Sync all tracks to new time (all use HTMLAudioElement now)
    this.state.tracks.forEach(track => {
      if (track.audioElement) {
        track.audioElement.currentTime = this.state.currentTime;
      }
    });
    
    // Reschedule mute regions if playing
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

  // Helper method to apply balance using appropriate panning method
  private applyBalance(track: StreamingTrack, balance: number) {
    if (track.useEnhancedPanning && track.leftGainNode && track.rightGainNode) {
      // Enhanced panning with 100% isolation
      // Balance range: -100 (full left) to +100 (full right)
      const normalizedBalance = balance / 100; // Convert to -1 to +1
      
      // Calculate left and right gains for true isolation
      // At -100: left = 1, right = 0
      // At 0: left = 1, right = 1  
      // At +100: left = 0, right = 1
      let leftGain = 1;
      let rightGain = 1;
      
      if (normalizedBalance < 0) {
        // Panning left: reduce right channel
        rightGain = 1 + normalizedBalance; // normalizedBalance is negative, so this reduces gain
      } else if (normalizedBalance > 0) {
        // Panning right: reduce left channel
        leftGain = 1 - normalizedBalance; // normalizedBalance is positive, so this reduces gain
      }
      
      track.leftGainNode.gain.value = leftGain;
      track.rightGainNode.gain.value = rightGain;
      
      console.log(`🎯 Enhanced balance applied to "${track.name}":`, {
        uiBalance: balance,
        normalizedBalance,
        leftGain: leftGain.toFixed(2),
        rightGain: rightGain.toFixed(2),
        isolation: balance === -100 ? 'Full Left (100%)' : 
                   balance === 100 ? 'Full Right (100%)' : 
                   `Center (L:${(leftGain * 100).toFixed(0)}% R:${(rightGain * 100).toFixed(0)}%)`
      });
    } else if (track.panNode) {
      // Standard StereoPanner (limited isolation)
      const panValue = balance / 100;
      track.panNode.pan.value = panValue;
      
      console.log(`🎚️ Standard balance applied to "${track.name}":`, {
        uiBalance: balance,
        panValue,
        limitation: 'StereoPanner (~70% max isolation)'
      });
    }
  }

  setTrackBalance(trackId: string, balance: number) {
    const track = this.state.tracks.find(t => t.id === trackId);
    if (track) {
      track.balance = balance;
      this.ensureTrackAudioNodes(track);
      // Use the new applyBalance method for both panning types
      this.applyBalance(track, balance);
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

  // Debug method to verify audio graph connections
  private validateAudioGraph(trackId?: string): boolean {
    try {
      if (trackId) {
        // Validate specific track
        const track = this.state.tracks.find(t => t.id === trackId);
        if (!track) return false;
        
        const isValid = !!(
          track.audioElement && 
          track.source && 
          track.gainNode && 
          track.panNode && 
          track.analyzerNode
        );
        
        if (!isValid) {
          console.warn(`⚠️ Track "${track.name}" audio graph incomplete:`, {
            hasAudioElement: !!track.audioElement,
            hasSource: !!track.source,
            hasGainNode: !!track.gainNode,
            hasPanNode: !!track.panNode,
            hasAnalyzerNode: !!track.analyzerNode
          });
        }
        return isValid;
      } else {
        // Validate all tracks
        return this.state.tracks.every(t => this.validateAudioGraph(t.id));
      }
    } catch (error) {
      console.error('❌ Audio graph validation error:', error);
      return false;
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
      try {
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
      } catch (error) {
        console.error(`❌ Failed to schedule mute region ${region.start}-${region.end} for ${track.name}:`, error);
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
    if (!track || !this.state.isPlaying) {
      return { left: 0, right: 0 };
    }

    // Helper function to calculate level from analyzer
    const calculateLevel = (analyzer: AnalyserNode): number => {
      const bufferLength = analyzer.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyzer.getByteFrequencyData(dataArray);
      
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
      // Apply 30% boost for better visual feedback while capping at 100
      return Math.min(100, rawAverage * 100 * 1.3); // Convert to 0-100 range with 30% boost
    };

    // Check if we have channel-specific analyzers (true stereo metering)
    if (track.leftAnalyzer && track.rightAnalyzer) {
      // Use channel-specific analyzers for true left/right levels after panning
      const leftLevel = calculateLevel(track.leftAnalyzer);
      const rightLevel = calculateLevel(track.rightAnalyzer);
      
      // Debug log to confirm channel-specific metering
      if (Math.abs(leftLevel - rightLevel) > 5) { // Only log when there's significant difference
        console.log(`📊 True stereo metering for "${track.name}":`, {
          left: leftLevel.toFixed(1),
          right: rightLevel.toFixed(1),
          balance: track.balance,
          difference: Math.abs(leftLevel - rightLevel).toFixed(1)
        });
      }
      
      return { left: leftLevel, right: rightLevel };
    } else if (track.analyzerNode) {
      // Fallback to mono analyzer (both channels show same level)
      const level = calculateLevel(track.analyzerNode);
      return { left: level, right: level };
    }
    
    return { left: 0, right: 0 };
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
          // Find the best time reference source
          let currentTime = 0;
          let timeSourceFound = false;
          
          // First try to find an HTMLAudioElement track (most accurate)
          for (const track of this.state.tracks) {
            if (track.audioElement && !track.hasMonoConversion) {
              currentTime = track.audioElement.currentTime;
              timeSourceFound = true;
              break;
            }
          }
          
          // If no HTMLAudioElement found, use AudioContext timing for converted tracks
          if (!timeSourceFound) {
            const elapsed = this.audioContext.currentTime - this.audioContextStartTime;
            currentTime = this.playbackStartTime + elapsed;
          }
          
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
        // Disconnect enhanced panning nodes if they exist
        if (track.channelSplitter) {
          try {
            track.channelSplitter.disconnect();
          } catch (e) {
            // Node might already be disconnected
          }
        }
        if (track.leftGainNode) {
          try {
            track.leftGainNode.disconnect();
          } catch (e) {
            // Node might already be disconnected
          }
        }
        if (track.rightGainNode) {
          try {
            track.rightGainNode.disconnect();
          } catch (e) {
            // Node might already be disconnected
          }
        }
        if (track.channelMerger) {
          try {
            track.channelMerger.disconnect();
          } catch (e) {
            // Node might already be disconnected
          }
        }
        // Disconnect channel-specific analyzers
        if (track.postPanSplitter) {
          try {
            track.postPanSplitter.disconnect();
          } catch (e) {
            // Node might already be disconnected
          }
        }
        if (track.leftAnalyzer) {
          try {
            track.leftAnalyzer.disconnect();
          } catch (e) {
            // Node might already be disconnected
          }
        }
        if (track.rightAnalyzer) {
          try {
            track.rightAnalyzer.disconnect();
          } catch (e) {
            // Node might already be disconnected
          }
        }
        // Disconnect standard panning node if it exists
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
      track.channelSplitter = null;
      track.leftGainNode = null;
      track.rightGainNode = null;
      track.channelMerger = null;
      track.postPanSplitter = null;
      track.leftAnalyzer = null;
      track.rightAnalyzer = null;
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
    // Check if we have tracks loaded and they're ready for playback
    // A track is ready if it has an audio element (for streaming) or audio buffer (for converted mono tracks)
    return this.state.tracks.length > 0 && this.state.tracks.every(track => 
      track.audioElement !== null || track.audioBuffer !== null
    );
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

  // Get audio output device properties for status display
  // Note: These are AudioContext settings (your system's audio device),
  // NOT individual track/file properties. They remain constant across all songs.
  getAudioInfo() {
    const sampleRate = this.audioContext.sampleRate;
    const baseLatency = this.audioContext.baseLatency || 0;
    
    // Calculate buffer size from base latency
    // baseLatency is in seconds, so multiply by sample rate to get samples
    const bufferSize = baseLatency > 0 ? Math.round(baseLatency * sampleRate) : 256;
    
    // Bit depth is typically 32-bit for Web Audio API (floating point)
    const bitDepth = 32;
    
    return {
      sampleRate,
      bufferSize,
      bitDepth,
      latency: baseLatency * 1000 // Convert to milliseconds
    };
  }
}
