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

### Working Build 2 (August 20, 2025)
- All functionality from Working Build 1
- **NEW**: Hidden timestamps - timestamps work for sync but are hidden from display
- **NEW**: Auto-scroll feature for lyrics without timestamps
- Smooth auto-scroll based on song duration and current time
- Adjustable scroll speed controls (0.2x to 3.0x) with localStorage persistence
- Support for both timestamped and plain text lyrics
- **Status**: Complete lyrics system with both timestamp-based and auto-scroll modes

### Working Build 3 (August 20, 2025) - RESTORE POINT
- All functionality from Working Build 2
- **NEW**: Font size and scroll speed controls moved to performance page header
- Controls positioned next to song title and band name for easy access
- Lyrics box set to 500px height for optimal viewing
- Font size controls (A- and A+ buttons) work for all lyrics
- Scroll speed controls only appear for non-timestamped lyrics
- All controls sync properly with lyrics component using localStorage and events
- **Status**: Complete working application with optimal lyrics control layout

### Working Build 4 (August 20, 2025)
- All functionality from Working Build 3
- **NEW**: Auto-scroll toggle functionality for non-timestamped lyrics
- Auto-scroll can be paused/resumed without affecting other features
- **NEW**: Alphabetical song sorting across all song lists and components
- Songs now display in alphabetical order by title in both database and local storage
- **FIXED**: Double scrollbar issue in lyrics section by removing parent overflow
- **FIXED**: TypeScript errors in song selector and local storage components
- **Status**: Complete application with enhanced lyrics controls and clean UI

### Working Build 5 (August 20, 2025)
- All functionality from Working Build 4
- **FIXED**: App shifting issue when lyrics scroll using CSS containment
- **FIXED**: Lyrics container sizing - removed fixed 500px height for responsive layout
- **IMPROVED**: Auto-scroll calculation now based on content size and song progress
- **ELIMINATED**: Unnecessary container padding that pushed content below viewport
- Lyrics now properly fit within available screen space without scrolling out of view
- **Status**: Complete responsive lyrics system with proper viewport containment

### Working Build 6 (August 20, 2025) - SPACE OPTIMIZED
- All functionality from Working Build 5
- **REDESIGNED**: Edit lyrics dialog for maximum space utilization (95% viewport usage)
- **COMPACT**: All controls condensed into minimal header rows with inline elements
- **MAXIMIZED**: Lyrics textarea now uses all remaining vertical space efficiently
- **STREAMLINED**: Reduced button sizes, padding, and eliminated redundant spacing
- **INTEGRATED**: Position slider moved inline with control buttons for space efficiency
- **Status**: Complete space-optimized lyrics editing with maximum text area

### Working Build 7 (August 20, 2025) - MOBILE LAYOUT FIXED
- All functionality from Working Build 6
- **FIXED**: Mobile lyrics controls now visible with dedicated mobile header
- **FIXED**: Transport controls always visible at bottom on mobile (play/pause/stop buttons)
- **IMPROVED**: Proper flex layout with `flex-shrink-0` for transport controls
- **OPTIMIZED**: Mobile spacing reduced to 20px for better content utilization
- **RESOLVED**: Lyrics no longer overlap or hide transport controls on mobile
- **Status**: Complete mobile-optimized layout with all controls accessible

### Working Build 8 (August 20, 2025) - RACE CONDITION FIXED
- All functionality from Working Build 7
- **FIXED**: Race condition where switching songs and pressing play too quickly causes multiple tracks to play
- **ADDED**: Loading state management in AudioEngine to prevent playback during song loading
- **IMPROVED**: Clean loading checks instead of manual track counting for more reliable playback
- **ENHANCED**: Better logging for debugging audio loading and playback states
- **Status**: Complete race condition protection - prevents audio conflicts during song switches

### Working Build 9 (August 20, 2025) - AUTO-SCROLL PERFECTED
- All functionality from Working Build 8
- **FIXED**: Auto-scroll for non-timestamped lyrics now works properly
- **IMPROVED**: Scroll speed range optimized from 0.2x-3.0x to 0.1x-2.0x for better stage control
- **REFINED**: Scroll speed step size reduced from 0.2 to 0.1 for finer adjustments
- **OPTIMIZED**: Auto-scroll timing starts immediately (currentTime >= 0) instead of waiting for 0.5s
- **SIMPLIFIED**: Linear scroll calculation from start to finish with speed multiplier
- **Status**: Complete auto-scroll system working for both timestamped and non-timestamped lyrics

### Working Build 10 (August 20, 2025) - DURATION SYNC FIXED
- All functionality from Working Build 9
- **FIXED**: Duration synchronization between audio engine and React components
- **RESOLVED**: Auto-scroll now uses actual audio buffer duration instead of database duration
- **IMPROVED**: Audio engine duration callback properly updates React state
- **CORRECTED**: LyricsDisplay component now receives duration prop from useAudioEngine hook
- **CLEANED**: Removed debug logging for production-ready operation
- **Status**: Auto-scroll fully functional with accurate duration tracking from audio buffers

### Working Build 11 (August 20, 2025) - SMOOTH TIMER SCROLLING 
- All functionality from Working Build 10
- **REPLACED**: Complex duration-based auto-scroll with simple timer-based system
- **IMPLEMENTED**: Timer starts when music plays and scrolls text at regular intervals
- **OPTIMIZED**: Ultra-smooth scrolling with 50ms intervals and 0.5px increments
- **ENHANCED**: Speed controls adjust timer intervals (faster = shorter intervals)
- **ADDED**: CSS smooth scroll behavior for visual polish
- **IMPROVED**: Button tooltips clarify timer interval control
- **Status**: Timer-based auto-scroll working smoothly with user-controlled speed

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