# Overview

This project is a live music performance application designed for professional stage use, providing real-time audio mixing, MIDI event sequencing, and synchronized lyrics display. Key capabilities include a multi-track audio engine, visual level monitoring, transport controls, and automatic song duration detection. The application operates offline, utilizing client-side blob URLs for audio and persistent file data storage, eliminating internet dependency during performance. The vision is to provide a robust, reliable, and user-friendly tool for musicians to manage live performances.

# User Preferences

Preferred communication style: Simple, everyday language.
Architecture preference: **100% local authentication and storage** - completely eliminate all cloud dependencies using localStorage and local popup-based authentication. Authentication system is now fully functional with working login/logout flow.
Data persistence: Local file system with organized folders for audio files and JSON config files for metadata. All data must be stored locally on user's device.
Performance priority: Fast, dependable operation without any internet connection required. Zero web-based components.
Mobile optimization: **Mobile-first stage performance design** - optimized for live music performance with touch-friendly controls, full-width transport buttons, and clean mobile interface suitable for stage lighting conditions.

# System Architecture

## Mobile App Architecture
- **Framework**: React Native with TypeScript using Expo managed workflow for cross-platform Android/iOS.
- **UI/UX Decisions**: Touch-optimized interfaces with large targets, full-width transport controls, reorganized mobile layouts (song list top, lyrics middle, controls bottom), and a clean interface for performance. Responsive font sizes and spacing for mobile and desktop. Landscape orientation for stage performance.
- **Navigation**: React Navigation with stack-based routing.
- **Audio Processing**: Expo AV for native platform audio performance.
- **State Management**: React Context for local state management.

## Mobile Data Layer
- **Database**: SQLite with Expo SQLite for local data persistence.
- **File Storage**: Expo File System for local audio file management in device documents directory (MP3, WAV, OGG, M4A).
- **Audio Handling**: Expo Document Picker for file selection, native audio caching.
- **Offline Operation**: Complete functionality without internet dependency; all data (songs, tracks, MIDI events) stored locally on device.

## Core Features
- **Multi-track Audio Engine**: Real-time audio mixing with individual track controls (volume, mute, solo, balance, VU meters) for up to 6 tracks per song.
- **Track Management**: Manages local backing tracks with automatic duration detection from audio buffer analysis.
- **MIDI Integration**: Time-stamped MIDI event sequencing embedded in lyrics.
- **Transport Controls**: Play, pause, stop, and seek functionality with keyboard shortcuts.
- **Live Monitoring**: Real-time audio level meters (reactive stereo VU meters) and system status indicators, including a fix for Samsung tablet compatibility.
- **Lyrics Display**: Synchronized lyrics with ultra-smooth auto-scrolling (timer-based with 50ms intervals), MIDI command highlighting, and an interactive position slider. Supports both timestamped and plain text lyrics. Fullscreen mode for immersive display.
- **Local File Reference**: Supports MP3, WAV, OGG, and M4A audio formats using blob URLs.
- **Auto-Save System**: Automatic persistence to local database.
- **Local Authentication System**: Offline authentication with localStorage sessions, including login/logout and user type detection.

# External Dependencies

- **react**: Frontend framework
- **react-native**: Mobile application framework
- **expo**: Framework for universal React applications
- **Expo AV**: Native audio performance for React Native
- **Expo File System**: Local file management for React Native
- **Expo Document Picker**: File selection for React Native
```