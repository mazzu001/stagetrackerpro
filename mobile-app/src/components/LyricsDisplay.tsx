import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';

interface LyricsDisplayProps {
  lyrics: string;
  currentTime: number;
  isPlaying: boolean;
}

export default function LyricsDisplay({
  lyrics,
  currentTime,
  isPlaying,
}: LyricsDisplayProps) {
  const scrollViewRef = useRef<ScrollView>(null);

  // Parse lyrics into lines with timestamps (if available)
  const parseLyrics = (lyricsText: string) => {
    const lines = lyricsText.split('\n').filter(line => line.trim());
    
    // Check if lyrics have timestamp format [mm:ss] or [mm:ss.ss]
    const timestampRegex = /^\[(\d{1,2}):(\d{2})(?:\.(\d{2}))?\]/;
    
    return lines.map((line, index) => {
      const match = line.match(timestampRegex);
      if (match) {
        const minutes = parseInt(match[1], 10);
        const seconds = parseInt(match[2], 10);
        const centiseconds = match[3] ? parseInt(match[3], 10) : 0;
        const timestamp = minutes * 60 + seconds + centiseconds / 100;
        const text = line.replace(timestampRegex, '').trim();
        
        return {
          timestamp,
          text,
          index,
        };
      }
      
      // For lyrics without timestamps, estimate timing
      const estimatedTimestamp = index * 4; // 4 seconds per line
      return {
        timestamp: estimatedTimestamp,
        text: line,
        index,
      };
    });
  };

  const lyricsLines = parseLyrics(lyrics);

  // Find current line based on playback time
  const getCurrentLineIndex = () => {
    for (let i = lyricsLines.length - 1; i >= 0; i--) {
      if (currentTime >= lyricsLines[i].timestamp) {
        return i;
      }
    }
    return -1;
  };

  const currentLineIndex = getCurrentLineIndex();

  // Auto-scroll to current line
  useEffect(() => {
    if (isPlaying && currentLineIndex >= 0 && scrollViewRef.current) {
      const scrollPosition = currentLineIndex * 40; // Approximate line height
      scrollViewRef.current.scrollTo({
        y: Math.max(0, scrollPosition - 100), // Keep current line visible
        animated: true,
      });
    }
  }, [currentLineIndex, isPlaying]);

  if (!lyrics || lyrics.trim() === '') {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No lyrics available</Text>
      </View>
    );
  }

  return (
    <ScrollView
      ref={scrollViewRef}
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {lyricsLines.map((line, index) => {
        const isCurrent = index === currentLineIndex;
        const isPast = index < currentLineIndex;
        const isFuture = index > currentLineIndex;

        return (
          <View key={index} style={styles.lineContainer}>
            <Text
              style={[
                styles.lyricsLine,
                isCurrent && styles.currentLine,
                isPast && styles.pastLine,
                isFuture && styles.futureLine,
              ]}
            >
              {line.text}
            </Text>
            
            {/* Show timestamp for current line */}
            {isCurrent && isPlaying && (
              <Text style={styles.timestamp}>
                {formatTime(line.timestamp)}
              </Text>
            )}
          </View>
        );
      })}
      
      {/* Add some bottom padding for better scrolling */}
      <View style={styles.bottomPadding} />
    </ScrollView>
  );
}

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
    fontStyle: 'italic',
  },
  lineContainer: {
    marginBottom: 12,
  },
  lyricsLine: {
    fontSize: 16,
    lineHeight: 24,
    color: '#ffffff',
    textAlign: 'center',
  },
  currentLine: {
    color: '#007AFF',
    fontWeight: 'bold',
    fontSize: 18,
    transform: [{ scale: 1.05 }],
  },
  pastLine: {
    color: '#888',
    opacity: 0.7,
  },
  futureLine: {
    color: '#aaa',
    opacity: 0.5,
  },
  timestamp: {
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    fontFamily: 'monospace',
  },
  bottomPadding: {
    height: 100,
  },
});