# Mobile App Setup Instructions

Your stage performance application has been successfully converted to a React Native mobile app with local file storage for maximum performance and offline reliability.

## What Changed

✅ **Cloud → Local**: Files now stored locally on device instead of slow cloud storage
✅ **Web → Mobile**: Native Android/iOS app optimized for stage performance  
✅ **Online → Offline**: Complete offline operation without internet dependency
✅ **Fast Performance**: Local storage eliminates network delays during live performance

## Quick Start

1. **Navigate to mobile app**:
   ```bash
   cd mobile-app
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start development server**:
   ```bash
   npx expo start
   ```

4. **Run on device**:
   - **iOS**: Press `i` or scan QR code with Camera app
   - **Android**: Press `a` or scan QR code with Expo Go app

## Project Structure

```
mobile-app/
├── src/
│   ├── screens/
│   │   ├── SongListScreen.tsx      # Manage your song library
│   │   ├── TrackManagerScreen.tsx  # Add/manage audio tracks
│   │   └── PerformanceScreen.tsx   # Live performance mode
│   ├── components/
│   │   ├── TrackControls.tsx       # Individual track mixing
│   │   ├── TransportControls.tsx   # Play/pause/stop controls
│   │   ├── VUMeter.tsx            # Audio level visualization
│   │   └── LyricsDisplay.tsx       # Synchronized lyrics
│   └── providers/
│       ├── DatabaseProvider.tsx    # Local SQLite database
│       └── AudioEngineProvider.tsx # Native audio engine
└── App.tsx                         # Main application
```

## Key Features

- **Local File Storage**: Audio files stored in device documents directory
- **SQLite Database**: All song/track metadata stored locally
- **Native Audio**: Expo AV for platform-optimized performance
- **Touch Interface**: Mobile-optimized controls for live performance
- **Offline Operation**: Works completely without internet
- **Multi-track Support**: Up to 6 tracks per song with individual controls

## Usage Flow

1. **Create Songs**: Tap "New Song" to add songs to your library
2. **Add Tracks**: Use "Track Manager" to upload audio files from device
3. **Performance Mode**: Load songs for live mixing and playback
4. **Mixing Controls**: Individual volume, mute, solo for each track
5. **Lyrics Display**: Synchronized lyrics with auto-scrolling

## Audio File Support

- MP3, WAV, M4A, OGG formats
- Files stored locally for instant access
- No file size limits (device storage dependent)

## Development Notes

- Use physical device for file upload testing
- Background audio requires custom development build
- All data persists locally between app sessions

## Migration from Web Version

Your existing web version data can be exported and manually imported to the mobile app if needed. The mobile app uses the same core data structure but stores everything locally for performance.

## Performance Benefits

🚀 **Instant Loading**: Local files eliminate network delays
🔒 **Reliable**: No internet outages can interrupt performance  
⚡ **Fast Mixing**: Native audio engine for real-time performance
📱 **Mobile Optimized**: Touch controls designed for stage use

The mobile app is now your primary platform for stage performance!