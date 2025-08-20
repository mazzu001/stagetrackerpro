# Overview
This project is a live music performance application designed for professional stage use, enabling real-time audio mixing, MIDI event sequencing, and synchronized lyrics display. Key capabilities include a multi-track audio engine (up to 6 tracks per song), visual level monitoring, transport controls, and automatic song duration detection. The application is built for offline operation, utilizing client-side blob URLs for audio and persistent file data storage, eliminating internet dependency during performance. The business vision is to provide a robust, reliable, and user-friendly tool for musicians to manage live performances without external network reliance.

# User Preferences
Preferred communication style: Simple, everyday language.
Architecture preference: **100% local authentication and storage** - completely eliminate all cloud dependencies using localStorage and local popup-based authentication.
Data persistence: Local file system with organized folders for audio files and JSON config files for metadata. All data must be stored locally on user's device.
Performance priority: Fast, dependable operation without any internet connection required. Zero web-based components.
Mobile optimization: **Mobile-first stage performance design** - optimized for live music performance with touch-friendly controls, full-width transport buttons, and clean mobile interface suitable for stage lighting conditions.

# System Architecture

## Mobile App Architecture
- **Framework**: React Native with TypeScript using Expo managed workflow
- **Platform**: Cross-platform Android/iOS native application
- **UI/UX Decisions**: Touch-optimized interfaces with larger targets, full-width transport controls, reorganized mobile layouts (song list at top, lyrics middle, controls bottom), responsive font sizes and spacing for mobile and desktop, landscape orientation for stage performance, and a clean interface focused on performance.
- **Navigation**: React Navigation with stack-based routing
- **Audio Processing**: Expo AV for native platform audio performance
- **State Management**: React Context for local state management

## Mobile Data Layer
- **Database**: SQLite with Expo SQLite for local data persistence
- **File Storage**: Expo File System for local audio file management in device documents directory (MP3, WAV, OGG, M4A)
- **Audio Handling**: Expo Document Picker for file selection, native audio caching
- **Offline Operation**: Complete functionality without internet dependency. All data (songs, tracks, MIDI events) stored locally on device.

## Core Features
- **Multi-track Audio Engine**: Real-time audio mixing with individual track controls (up to 6 tracks per song), volume, mute, solo, balance, and VU meters.
- **Track Management**: Reference and manage local backing tracks with automatic song duration detection from audio buffer analysis.
- **MIDI Integration**: Time-stamped MIDI event sequencing embedded in lyrics.
- **Transport Controls**: Play, pause, stop, and seek functionality with keyboard shortcuts.
- **Live Monitoring**: Real-time audio level meters (reactive stereo VU meters) and system status indicators.
- **Lyrics Display**: Synchronized lyrics with auto-scrolling, MIDI command highlighting, an interactive position slider, and smooth timer-based scrolling. Fullscreen mode for immersive stage performance.
- **Local File Reference**: Supports MP3, WAV, OGG, and M4A audio formats using blob URLs.
- **Local Authentication System**: Offline authentication with localStorage sessions, including login/logout flow and user type detection (Free vs Paid).

# External Dependencies

## Core Framework Dependencies
- **react**
- **react-native**
- **expo**

## Audio and Media
- **Expo AV**
- **Expo File System**
- **Expo Document Picker**

# Development History

## RESTORE POINT 14 - CLEAN LYRICS DISPLAY (August 20, 2025)
### Professional Stage-Ready Lyrics Interface
- **LYRICS DISPLAY**: Clean performance interface with timestamps and MIDI commands hidden from view
- **FUNCTIONALITY PRESERVED**: All automation features work invisibly in background
- **TIMESTAMP DETECTION**: Fixed regex to prevent false matches with song lyrics containing time references (like "3 AM")
- **BRACKET FILTERING**: Iterative removal system handles all bracket content including nested MIDI commands
- **LINE HIGHLIGHTING**: Restored timestamp-based line-by-line highlighting for synced performance
- **AUTO-SCROLL**: Both timestamped (line-based) and smooth (timer-based) scrolling modes active
- **STAGE PERFORMANCE**: Professional clean interface showing only lyrics text during live performance
- **MIDI AUTOMATION**: Background MIDI command execution continues seamlessly
- **STATUS**: STABLE - Complete lyrics system optimized for professional stage use