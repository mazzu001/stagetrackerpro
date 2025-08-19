# Overview

This is a live music performance application built with React, Express, and in-memory storage. The system provides real-time audio mixing, MIDI event sequencing, and synchronized lyrics display for live performances. It features a comprehensive audio engine with multi-track playbook (up to 6 tracks per song), visual level monitoring, transport controls, and automatic song duration detection from local audio files for professional stage use. The app works completely offline using client-side blob URLs for audio files with persistent file data storage - no internet connection or file uploads required.

## Recent Updates (August 19, 2025)

### Latest Fixes (Today)
✓ **Complete local authentication system** - Fully functional offline authentication with localStorage sessions
✓ **Working login/logout flow** - Users can sign in via landing page popup and logout via settings menu
✓ **Session persistence verified** - 24-hour login sessions work correctly across page reloads
✓ **User type detection working** - Free vs Paid user modes properly implemented and displayed
✓ **Demo credentials functional** - Both free@demo.com and paid@demo.com accounts working perfectly
✓ **Offline-first operation confirmed** - Zero server dependencies for authentication or user management
✓ **Landing page to app transition** - Smooth flow from sign-in to performance interface
✓ **React refresh issue resolved** - Login now updates UI immediately without browser refresh required
✓ **Logout with page refresh** - Logout procedure includes automatic page refresh for reliable state clearing
✓ **Track import system fixed** - Replaced server API calls with local storage, track import now works completely offline
✓ **Full track controls restored** - Volume, mute, solo, balance, and VU meters working in track manager

### Web Application (Legacy)
✓ **Subscription system** - Complete $4.99/month Stripe payment processing with user authentication
✓ **Professional landing page** - Marketing page with features, pricing, and sign-up flow
✓ **Development mode access** - Subscription checks bypassed in development for testing  
✓ **Authentication disabled** - Sign-in and landing page removed for simpler testing
✓ **Direct app access** - Performance app loads immediately without authentication flow
✓ **Cloud database migration** - All data now stored in PostgreSQL cloud database instead of localStorage
✓ **Persistent storage** - Songs, tracks, MIDI events, and user data automatically saved to cloud
✓ **Database persistence verified** - All songs and tracks persist across page reloads using cloud database
✓ **Smart file reconnection** - Audio files automatically registered from database tracks for easy file picker connection
✓ **Smart file reconnection** - Improved dialog for bulk file selection and automatic name matching
✓ **Settings menu** - Added dropdown menu under settings gear with user info and logout option
✓ **File path-based storage system** - Stores local file paths instead of blob data for true offline operation
✓ **Automatic file discovery** - App displays expected files on startup and loads them when selected
✓ **Smart file registration** - Files become immediately available when added through file picker
✓ **Persistent track references** - Track metadata saved with file path references for session persistence
✓ **Memory-efficient caching** - Files cached by path for instant access without data duplication
✓ **Lyrics import feature** - Added web search functionality to import song lyrics automatically
✓ **Delete song feature** - Added safe song deletion with confirmation dialog that protects local files
✓ **Database blob storage migration** - Completely replaced file reconnection system with PostgreSQL BYTEA blob storage
✓ **TrackFileUploader component** - New drag-and-drop interface for uploading audio files directly to database
✓ **Offline blob system** - Audio files stored as binary data in database with local blob URL caching for instant access
✓ **Multiple file upload fix** - Fixed track manager to properly process all selected files instead of just the first one
✓ **Enhanced upload error handling** - Added sequential processing, progress tracking, and detailed error reporting for file uploads
✓ **Local file storage migration** - Converted from database blob storage to fast local file storage for live performance
✓ **File reconnection system** - Added smart dialog to easily reconnect existing tracks with local audio files
✓ **Performance optimization** - Local file access eliminates database slowdowns during live shows
✓ **SQLite database migration** - Converted from PostgreSQL cloud to SQLite local database for complete offline operation
✓ **Local-first architecture** - All data now stored locally: audio files on filesystem, metadata in SQLite database

### Mobile Application (Primary)
✓ **React Native mobile app** - Complete migration from web to native Android/iOS application
✓ **Local file storage** - Audio files stored locally on device for maximum performance and offline operation
✓ **SQLite database** - Local database replaces cloud PostgreSQL for complete offline functionality  
✓ **Native audio engine** - Expo AV replaces Web Audio API for platform-optimized audio performance
✓ **Touch-optimized UI** - Mobile-first interface with landscape orientation for stage performance
✓ **Offline-first architecture** - Zero internet dependency for live performance reliability
✓ **Local file management** - Expo File System and Document Picker for seamless audio file handling
✓ **React Navigation** - Native mobile navigation replacing web routing

# User Preferences

Preferred communication style: Simple, everyday language.
Architecture preference: **100% local authentication and storage** - completely eliminate all cloud dependencies using localStorage and local popup-based authentication. Authentication system is now fully functional with working login/logout flow.
Data persistence: Local file system with organized folders for audio files and JSON config files for metadata. All data must be stored locally on user's device.
Performance priority: Fast, dependable operation without any internet connection required. Zero web-based components.

# System Architecture

## Mobile App Architecture (Primary)
- **Framework**: React Native with TypeScript using Expo managed workflow
- **Platform**: Cross-platform Android/iOS native application
- **UI Components**: Native React Native components optimized for touch interfaces
- **Navigation**: React Navigation with stack-based routing for mobile screens
- **Audio Processing**: Expo AV for native platform audio performance
- **State Management**: React Context for local state management (no server state needed)

## Mobile Data Layer
- **Database**: SQLite with Expo SQLite for local data persistence
- **File Storage**: Expo File System for local audio file management in device documents directory
- **Audio Handling**: Expo Document Picker for file selection, native audio caching
- **Offline Operation**: Complete functionality without internet dependency

## Legacy Web Architecture (Deprecated)
- **Framework**: React with TypeScript using Vite for development and building
- **Styling**: Tailwind CSS with shadcn/ui component library for consistent design system
- **State Management**: TanStack Query for server state management and caching
- **Routing**: Wouter for lightweight client-side routing
- **Audio Processing**: Web Audio API through custom AudioEngine class for real-time audio manipulation
- **Backend**: Node.js with Express.js REST API server
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations

## Data Storage

### Mobile App (Primary)
- **Local Database**: SQLite database stored on device with three main tables:
  - `songs`: Core song metadata including title, artist, duration, BPM, key, and lyrics with waveform data
  - `tracks`: Individual audio tracks per song with volume, mute, and solo controls (references local file paths)
  - `midiEvents`: Time-stamped MIDI events for automation and effects
- **File Storage**: Local device file system using Expo File System API (MP3, WAV, OGG, M4A)
- **Offline Operation**: Complete local data persistence with zero cloud dependency

### Legacy Web App
- **Cloud Database**: PostgreSQL cloud database with user authentication
- **File Storage**: Database BYTEA blob storage with local blob URL caching
- **Cloud Persistence**: All data automatically saved to PostgreSQL

## Core Features
- **Multi-track Audio Engine**: Real-time audio mixing with individual track controls (up to 6 tracks per song)
- **Track Management**: Reference and manage local backing tracks with automatic song duration detection
- **MIDI Integration**: Timed MIDI event sequencing embedded in lyrics
- **Transport Controls**: Play, pause, stop, and seek functionality with keyboard shortcuts
- **Live Monitoring**: Real-time audio level meters and system status indicators
- **Lyrics Display**: Synchronized lyrics with auto-scrolling and MIDI command highlighting
- **Local File Reference**: Support for MP3, WAV, OGG, and M4A audio formats using blob URLs (completely offline)
- **Auto-Save System**: Automatic persistence to localStorage every 30 seconds and on data changes
- **Lyrics Import**: Search and import lyrics from web sources using free Lyrics.ovh API

## Audio Processing Pipeline
- **Track Loading**: Dynamic audio buffer management for multiple simultaneous tracks
- **Real-time Mixing**: Individual track volume, mute, and solo controls
- **Level Monitoring**: Visual feedback through analyser nodes for each track
- **Master Output**: Central volume control with CPU usage monitoring

# External Dependencies

## Core Framework Dependencies
- **@neondatabase/serverless**: PostgreSQL serverless driver for database connectivity
- **drizzle-orm**: Type-safe ORM with PostgreSQL dialect
- **@tanstack/react-query**: Server state management and caching
- **react**: Frontend framework with TypeScript support
- **express**: Backend web server framework

## UI and Styling
- **@radix-ui/***: Comprehensive set of unstyled, accessible UI primitives
- **tailwindcss**: Utility-first CSS framework
- **class-variance-authority**: Type-safe component variants
- **lucide-react**: Icon library for consistent iconography

## Audio and Media
- **Web Audio API**: Browser-native audio processing (no external dependency)
- **multer**: File upload middleware for audio file handling
- **File System API**: Native Node.js file operations

## Development Tools
- **vite**: Build tool and development server
- **typescript**: Type safety and development experience
- **esbuild**: Fast bundling for production builds
- **@replit/vite-plugin-***: Replit-specific development enhancements

## Utility Libraries
- **wouter**: Lightweight routing library
- **date-fns**: Date manipulation and formatting
- **zod**: Runtime type validation through drizzle-zod integration
- **clsx**: Conditional CSS class composition