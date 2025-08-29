# Overview
This project is a professional, offline-capable live music performance application designed for stage use. It features real-time audio mixing, advanced Web MIDI device management, and synchronized lyrics display. The application prioritizes offline functionality, utilizing local storage for all performance data and blob URLs for audio files. It is production-ready with robust MIDI integration, including persistent connections, and comprehensive device management.

## Recent Changes
- **Emergency Streaming Disable (Jan 29, 2025)**: Temporarily disabled streaming audio engine due to application crashes. The dual audio engine approach was causing memory conflicts and complete app freezes. Reverted to stable preload-only mode while streaming implementation is redesigned.
- **Web Streaming Audio Implementation (Jan 29, 2025)**: Initially implemented zero-load-time streaming audio but discovered critical stability issues with dual audio engine architecture causing system crashes.
- **Mobile App Crash Fix (Jan 29, 2025)**: Fixed Android crash when adding tracks by simplifying error handling and removing excessive logging that was interfering with async file operations. Streamlined the track addition process in TrackManagerScreen and DatabaseProvider.

# User Preferences
- **Communication style**: Simple, everyday language
- **Authentication**: Local storage sessions, offline-capable
- **Data persistence**: Local file system with organized audio storage
- **Performance priority**: Zero internet dependency during live performance
- **MIDI format**: `[[TYPE:VALUE:CHANNEL]]` bracket format for all MIDI commands

# System Architecture

## Web Application Stack
- **Frontend**: React 18 with TypeScript, Vite build system
- **Backend**: Express.js with TypeScript (tsx runtime)
- **Database**: Hybrid setup - PostgreSQL (user data) + SQLite (music data)
- **UI Framework**: Tailwind CSS + Radix UI (shadcn/ui components)
- **State Management**: React Query + React hooks
- **Routing**: Wouter for client-side routing

## MIDI System Architecture
- **API**: Web MIDI API for system-level MIDI device integration.
- **Persistence**: Global Web MIDI service (`useGlobalWebMIDI.ts`) ensures persistent MIDI connections even when UI components close.
- **Server-side MIDI**: Node.js with `easymidi` library (mock mode in development) for server-side MIDI processing and `ws` for WebSocket communication.
- **Device Management**: Supports USB MIDI, Bluetooth MIDI (for legacy devices), and general MIDI device types. Features automatic scanning, connection management, and signal monitoring.
- **Command Parsing**: Multi-format parser supports new bracket format (`[[PC:12:1]]`, `[[CC:7:64:1]]`, `[[NOTE:60:127:1]]`), as well as legacy hex and text formats.
- **Message Formatting**: Standardized `[[TYPE:VALUE:CHANNEL]]` output format for incoming and outgoing messages.
- **Automated Lyrics MIDI**: MIDI commands embedded in timestamped lyrics automatically execute during playback.

## Core Features
- **Dual Audio Engine Architecture**: 
  - **Preload Mode**: Traditional buffered audio with 8+ second decode time but full Web Audio API features
  - **Streaming Mode**: Zero-load-time instant playback using HTMLAudioElement with local blob URLs
  - **Mode Toggle**: Settings menu toggle with real-time indicator showing current audio engine
  - **Unified Controls**: All track controls (volume, mute, solo, balance) work seamlessly in both modes
- **Multi-Track Audio Engine**: Supports up to 6 tracks per song with individual volume, mute, solo, and balance controls. Features real-time VU meters and automatic song duration detection.
- **Advanced MIDI Integration**: Comprehensive device detection, universal command formatting, real-time message monitoring, and persistent connection management.
- **Performance Interface**: Transport controls (play, pause, stop, seek) with keyboard shortcuts, synchronized lyrics with auto-scrolling and MIDI command highlighting, interactive position slider, and fullscreen mode. Optimized for mobile and touch controls.
- **Data Management**: Uses local file system for audio (Blob URLs), localStorage for offline authentication, and a hybrid PostgreSQL/SQLite database for music and user data. Includes subscription tiers with Stripe integration.

## UI/UX Design
- Consistent theming with full dark/light mode support.
- Mobile optimization with touch-friendly controls.
- Clear visual categorization and priority sorting for MIDI devices.

# External Dependencies
- **Core Framework**: `react`, `react-dom`, `typescript`, `vite`, `express`
- **UI/UX**: `tailwindcss`, `@radix-ui/react-*`, `lucide-react`, `framer-motion`
- **Data Layer**: `drizzle-orm`, `@neondatabase/serverless` (PostgreSQL), `better-sqlite3` (SQLite), `postgres`
- **MIDI/Audio**: `easymidi`, `ws` (WebSocket server)
- **Authentication**: `express-session`, `connect-pg-simple`, `passport`, `openid-client`
- **Payments**: `stripe`, `@stripe/stripe-js`, `@stripe/react-stripe-js`