import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useMIDISequencer } from '../hooks/useMIDISequencer';

interface LyricsLine {
  timestamp: number; // in seconds
  text: string;
  hasMIDICommand?: boolean;
  midiCommands?: string[];
}

interface LyricsDisplayProps {
  lyrics: string;
  currentTime: number;
  isPlaying: boolean;
  onMidiCommand?: (command: string) => void;
  fontSize?: number;
  autoScrollEnabled?: boolean;
}

export default function LyricsDisplay({ 
  lyrics, 
  currentTime, 
  isPlaying, 
  onMidiCommand,
  fontSize: propFontSize = 18,
  autoScrollEnabled: propAutoScrollEnabled = true
}: LyricsDisplayProps) {
  const [fontSize, setFontSize] = useState(propFontSize);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(propAutoScrollEnabled);
  const [parsedLines, setParsedLines] = useState<LyricsLine[]>([]);
  const [currentLineIndex, setCurrentLineIndex] = useState(-1);
  
  const scrollViewRef = useRef<ScrollView>(null);
  const { loadFromLyrics, updateTime } = useMIDISequencer({ 
    onExecuteCommand: onMidiCommand 
  });

  // Parse lyrics into lines with timestamps and MIDI commands
  const parseLines = (): LyricsLine[] => {
    if (!lyrics) return [];
    
    return lyrics.split('\n').map((line, index) => {
      const timestampMatch = line.match(/\[(\d{1,2}):(\d{2})\]/);
      const midiMatches = line.match(/\[\[([^\]]+)\]\]/g);
      
      if (timestampMatch) {
        const minutes = parseInt(timestampMatch[1]);
        const seconds = parseInt(timestampMatch[2]);
        const timestamp = minutes * 60 + seconds;
        
        // Remove timestamp and MIDI commands from display text
        let text = line.replace(/\[\d{1,2}:\d{2}\]/, '').trim();
        if (midiMatches) {
          midiMatches.forEach(match => {
            text = text.replace(match, '').trim();
          });
        }
        
        return { 
          timestamp, 
          text, 
          hasMIDICommand: !!midiMatches,
          midiCommands: midiMatches || []
        };
      }
      return { timestamp: -1, text: line, hasMIDICommand: false };
    }).filter(line => line.text.length > 0);
  };

  // Update parsed lines and load MIDI commands when lyrics change
  useEffect(() => {
    const lines = parseLines();
    setParsedLines(lines);
    
    // Load MIDI commands from lyrics
    if (lyrics) {
      loadFromLyrics(lyrics);
    }
  }, [lyrics, loadFromLyrics]);

  // Update current line based on time and handle MIDI sequencing
  useEffect(() => {
    if (parsedLines.length === 0) return;
    
    // Update MIDI sequencer time
    updateTime(currentTime * 1000); // Convert to milliseconds
    
    // Find current line based on timestamp
    let newCurrentLineIndex = -1;
    for (let i = parsedLines.length - 1; i >= 0; i--) {
      if (parsedLines[i].timestamp <= currentTime && parsedLines[i].timestamp >= 0) {
        newCurrentLineIndex = i;
        break;
      }
    }
    
    if (newCurrentLineIndex !== currentLineIndex) {
      setCurrentLineIndex(newCurrentLineIndex);
      
      // Auto-scroll to current line
      if (autoScrollEnabled && isPlaying && newCurrentLineIndex >= 0 && scrollViewRef.current) {
        const lineHeight = 60; // Approximate line height
        const scrollOffset = Math.max(0, (newCurrentLineIndex - 2) * lineHeight);
        scrollViewRef.current.scrollTo({ y: scrollOffset, animated: true });
      }
    }
  }, [currentTime, parsedLines, currentLineIndex, autoScrollEnabled, isPlaying, updateTime]);

  return (
    <View style={styles.container}>
      <View style={styles.controlsContainer}>
        <Text style={styles.title}>Lyrics</Text>
        
        <View style={styles.controls}>
          <TouchableOpacity
            style={[
              styles.autoScrollButton,
              autoScrollEnabled && styles.autoScrollButtonActive
            ]}
            onPress={() => setAutoScrollEnabled(!autoScrollEnabled)}
          >
            <Text style={[
              styles.autoScrollText,
              autoScrollEnabled && styles.autoScrollTextActive
            ]}>
              {autoScrollEnabled ? '⏸' : '▶'}
            </Text>
          </TouchableOpacity>
          
          <View style={styles.fontControls}>
            <TouchableOpacity
              style={styles.fontButton}
              onPress={() => setFontSize(Math.max(12, fontSize - 2))}
            >
              <Text style={styles.fontButtonText}>A-</Text>
            </TouchableOpacity>
            <Text style={styles.fontSizeDisplay}>{fontSize}</Text>
            <TouchableOpacity
              style={styles.fontButton}
              onPress={() => setFontSize(Math.min(32, fontSize + 2))}
            >
              <Text style={styles.fontButtonText}>A+</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView 
        ref={scrollViewRef}
        style={styles.lyricsContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.lyricsContent}>
          {parsedLines.map((line, index) => {
            const isActive = index === currentLineIndex;
            const isUpcoming = index === currentLineIndex + 1;
            
            return (
              <View key={index} style={styles.lineContainer}>
                <Text
                  style={[
                    styles.lyricsLine,
                    { fontSize },
                    isActive && styles.activeLine,
                    isUpcoming && styles.upcomingLine,
                    line.hasMIDICommand && styles.midiLine
                  ]}
                >
                  {line.text}
                </Text>
                
                {/* Show MIDI command indicator */}
                {line.hasMIDICommand && (
                  <View style={styles.midiIndicator}>
                    <Text style={styles.midiIndicatorText}>🎹</Text>
                    {line.midiCommands && (
                      <Text style={styles.midiCommandText}>
                        {line.midiCommands.join(', ')}
                      </Text>
                    )}
                  </View>
                )}
              </View>
            );
          })}
          
          {/* Spacer for scrolling */}
          <View style={{ height: 200 }} />
        </View>
      </ScrollView>

      {parsedLines.length === 0 && (
        <View style={styles.noLyricsContainer}>
          <Text style={styles.noLyricsText}>No lyrics available</Text>
        </View>
      )}
      
      {/* Show current line info for debugging */}
      {__DEV__ && currentLineIndex >= 0 && (
        <View style={styles.debugInfo}>
          <Text style={styles.debugText}>
            Line {currentLineIndex + 1}/{parsedLines.length} • {Math.floor(currentTime)}s
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#444',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  autoScrollButton: {
    backgroundColor: '#2a2a2a',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  autoScrollButtonActive: {
    backgroundColor: '#007AFF',
  },
  autoScrollText: {
    color: '#666',
    fontSize: 14,
  },
  autoScrollTextActive: {
    color: '#ffffff',
  },
  fontControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fontButton: {
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  fontButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },
  fontSizeDisplay: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    minWidth: 24,
    textAlign: 'center',
  },
  lyricsContainer: {
    flex: 1,
  },
  lyricsContent: {
    padding: 16,
  },
  lineContainer: {
    marginBottom: 12,
  },
  lyricsLine: {
    color: '#ffffff',
    lineHeight: 32,
    marginBottom: 4,
    textAlign: 'center',
  },
  activeLine: {
    color: '#4CAF50',
    fontWeight: '700',
    textShadowColor: 'rgba(76, 175, 80, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  upcomingLine: {
    color: '#FFC107',
    fontWeight: '600',
  },
  midiLine: {
    borderLeftWidth: 3,
    borderLeftColor: '#9C27B0',
    paddingLeft: 12,
  },
  midiIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    opacity: 0.7,
  },
  midiIndicatorText: {
    fontSize: 12,
    marginRight: 6,
  },
  midiCommandText: {
    fontSize: 10,
    color: '#9C27B0',
    fontFamily: 'monospace',
  },
  debugInfo: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 4,
    borderRadius: 4,
  },
  debugText: {
    color: '#ffffff',
    fontSize: 10,
    fontFamily: 'monospace',
  },
  noLyricsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  noLyricsText: {
    color: '#666',
    fontSize: 16,
    fontStyle: 'italic',
    textAlign: 'center',
  },
});