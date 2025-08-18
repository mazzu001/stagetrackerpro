# Stage Performance Mobile App

A React Native mobile application for live music performance with local file storage and offline capabilities.

## Features

- **Local File Storage**: All audio files stored locally on device for fast performance
- **Offline Operation**: Works completely without internet connection
- **Multi-track Audio**: Support for up to 6 audio tracks per song
- **Real-time Audio Mixing**: Individual track volume, mute, solo, and balance controls
- **Transport Controls**: Play, pause, stop, and seek functionality
- **Lyrics Display**: Synchronized lyrics with auto-scrolling
- **VU Meters**: Visual audio level monitoring
- **SQLite Database**: Local database for song and track metadata

## Technology Stack

- **React Native**: Cross-platform mobile framework
- **Expo**: Development platform and managed workflow
- **Expo AV**: Audio playback and recording
- **Expo SQLite**: Local database storage
- **Expo File System**: Local file management
- **TypeScript**: Type safety and development experience

## Getting Started

### Prerequisites

- Node.js 18 or higher
- Expo CLI: `npm install -g @expo/cli`
- iOS Simulator (macOS) or Android Studio (for emulators)

### Installation

1. Navigate to the mobile app directory:
   ```bash
   cd mobile-app
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   expo start
   ```

4. Run on device:
   - iOS: Press `i` or scan QR code with Camera app
   - Android: Press `a` or scan QR code with Expo Go app

### Building for Production

For iOS:
```bash
expo build:ios
```

For Android:
```bash
expo build:android
```

## Project Structure

```
mobile-app/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── TrackControls.tsx
│   │   ├── TransportControls.tsx
│   │   ├── VUMeter.tsx
│   │   └── LyricsDisplay.tsx
│   ├── providers/           # Context providers
│   │   ├── DatabaseProvider.tsx
│   │   └── AudioEngineProvider.tsx
│   └── screens/             # Main app screens
│       ├── SongListScreen.tsx
│       ├── PerformanceScreen.tsx
│       └── TrackManagerScreen.tsx
├── App.tsx                  # Main app component
├── app.json                 # Expo configuration
└── package.json             # Dependencies
```

## Key Differences from Web Version

1. **Local File Storage**: Files stored in device documents directory instead of cloud
2. **SQLite Database**: Local database instead of PostgreSQL
3. **Native Audio**: Expo AV instead of Web Audio API
4. **Mobile UI**: Touch-optimized interface for mobile screens
5. **Offline First**: Complete offline functionality without internet dependency

## Audio File Support

- MP3
- WAV
- M4A
- OGG

## Performance Considerations

- Files are cached in device memory for instant access
- Audio playback uses native platform audio engines
- Database operations are optimized for mobile performance
- UI components use React Native's optimized rendering

## Known Limitations

- Advanced audio effects require react-native-audio-api for Web Audio API equivalent
- Perfect synchronization may require react-native-track-player for complex scenarios
- Balance/pan controls limited by Expo AV capabilities

## Migration from Web Version

The mobile app maintains the same core functionality as the web version but with these architectural changes:

1. **Storage**: PostgreSQL → SQLite + Local Files
2. **Audio**: Web Audio API → Expo AV
3. **UI**: React DOM → React Native
4. **Navigation**: Wouter → React Navigation
5. **File Handling**: Server Upload → Local File System

## Development Notes

- Use `expo start --tunnel` for testing on physical devices
- Background audio requires custom development client (not Expo Go)
- Testing file uploads requires physical device or simulator with file access