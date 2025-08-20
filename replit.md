# Overview

This project is a live music performance application designed for professional stage use. It provides real-time audio mixing, MIDI event sequencing, and synchronized lyrics display. Key capabilities include a multi-track audio engine (up to 6 tracks per song), visual level monitoring, transport controls, and automatic song duration detection from local audio files. The application is built for offline operation, utilizing client-side blob URLs for audio and persistent file data storage, eliminating the need for an internet connection or file uploads during performance. The business vision is to provide a robust, reliable, and user-friendly tool for musicians to manage their live performances without dependency on external networks.

## Restore Points

### Restore Point 1 (August 20, 2025)
- Complete working application with multi-track audio engine
- Real-time VU meters and audio level monitoring  
- Transport controls (play/pause/stop) with keyboard shortcuts
- Song management and track loading from local files
- User authentication system with localStorage
- Mobile-optimized performance interface
- **Note**: Lyrics display functionality had scrolling issues and will be rebuilt from scratch

### Working Build 1 (August 20, 2025)
- All functionality from Restore Point 1
- **NEW**: Fresh lyrics box with scrolling text and timestamps
- Timestamp parsing for [mm:ss] format
- Auto-scrolling to center current line using scrollIntoView
- Visual highlighting (past/current/future states)
- Font size controls with localStorage persistence
- Clean dark theme design
- **Status**: Lyrics scrolling working perfectly - smooth and centered

# User Preferences

Preferred communication style: Simple, everyday language.
Architecture preference: **100% local authentication and storage** - completely eliminate all cloud dependencies using localStorage and local popup-based authentication. Authentication system is now fully functional with working login/logout flow.
Data persistence: Local file system with organized folders for audio files and JSON config files for metadata. All data must be stored locally on user's device.
Performance priority: Fast, dependable operation without any internet connection required. Zero web-based components.
Mobile optimization: **Mobile-first stage performance design** - optimized for live music performance with touch-friendly controls, full-width transport buttons, and clean mobile interface suitable for stage lighting conditions.

# System Architecture

## Mobile App Architecture (Primary)
- **Framework**: React Native with TypeScript using Expo managed workflow
- **Platform**: Cross-platform Android/iOS native application
- **UI/UX Decisions**: Touch-optimized interfaces with larger targets, full-width transport controls, reorganized mobile layouts (song list at top, lyrics middle, controls bottom), and a clean interface focused on performance. Responsive font sizes and spacing for mobile and desktop. Landscape orientation for stage performance.
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
- **Track Management**: Reference and manage local backing tracks with automatic song duration detection from audio buffer analysis. Includes a loading overlay for track processing.
- **MIDI Integration**: Time-stamped MIDI event sequencing embedded in lyrics.
- **Transport Controls**: Play, pause, stop, and seek functionality with keyboard shortcuts.
- **Live Monitoring**: Real-time audio level meters (reactive stereo VU meters) and system status indicators.
- **Lyrics Display**: Synchronized lyrics with auto-scrolling, MIDI command highlighting, and an interactive position slider for scrubbing during editing.
- **Local File Reference**: Supports MP3, WAV, OGG, and M4A audio formats using blob URLs.
- **Auto-Save System**: Automatic persistence to localStorage (for previous web version) or local database.
- **Local Authentication System**: Offline authentication with localStorage sessions, including login/logout flow and user type detection (Free vs Paid).

# External Dependencies

## Core Framework Dependencies
- **react**: Frontend framework
- **react-native**: Mobile application framework
- **expo**: Framework for universal React applications
- **express**: Backend web server framework (Legacy Web)
- **@neondatabase/serverless**: PostgreSQL serverless driver (Legacy Web)
- **drizzle-orm**: Type-safe ORM (Legacy Web)
- **@tanstack/react-query**: Server state management and caching (Legacy Web)

## UI and Styling
- **tailwindcss**: Utility-first CSS framework (Legacy Web)
- **shadcn/ui**: Component library (Legacy Web)
- **@radix-ui/***: Unstyled, accessible UI primitives (Legacy Web)
- **lucide-react**: Icon library (Legacy Web)

## Audio and Media
- **Web Audio API**: Browser-native audio processing (Legacy Web, now replaced by Expo AV)
- **Expo AV**: Native audio performance for React Native
- **multer**: File upload middleware (Legacy Web)
- **File System API**: Native Node.js file operations (Legacy Web)
- **Expo File System**: Local file management for React Native
- **Expo Document Picker**: File selection for React Native

## Utility Libraries
- **wouter**: Lightweight routing library (Legacy Web)
- **date-fns**: Date manipulation and formatting (Legacy Web)
- **zod**: Runtime type validation (Legacy Web)
- **clsx**: Conditional CSS class composition (Legacy Web)
```