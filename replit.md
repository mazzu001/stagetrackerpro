# Overview
This project is a professional, offline-capable live music performance application designed for stage use. It features real-time audio mixing, advanced Web MIDI device management, and synchronized lyrics display. The application prioritizes offline functionality, utilizing local storage for all performance data and blob URLs for audio files. It is production-ready with robust MIDI integration, including persistent connections, and comprehensive device management.

## Recent Changes
- **Stem Splitting Feature Temporarily Disabled (Sep 19, 2025)**: Hidden the "Split Stems" button and functionality from the Track Manager interface. All stem splitting code remains intact for future activation when a suitable API solution is identified. The Moises API integration is complete but requires business-level access through Music.AI sales team, making it impractical for current use. Feature can be re-enabled by modifying one line in performance.tsx.
- **Complete MIDI Lyrics Integration (Sep 11, 2025)**: Implemented comprehensive MIDI command execution synchronized with lyrics timeline for live performance use. MIDI commands embedded in lyrics (`[[PC:2:1]]`, `[[CC:7:127:1]]`, `[[NOTE:60:127:1]]`) automatically execute during playback. Features multi-device connection support, visual command indicators, duplicate prevention, and robust seek handling for rehearsals. Integrated with existing "Devices" button for professional users. Supports both timestamped and non-timestamped lyrics with consistent visual feedback.
- **Lazy MIDI Initialization (Sep 10, 2025)**: Completely eliminated automatic MIDI initialization from app startup, achieving instant loading. Implemented lazy initialization pattern where MIDI only initializes when users actually need it (clicking MIDI device buttons). Removed all blocking Web MIDI API calls during startup while preserving full MIDI functionality. App now starts instantly without any MIDI-related freezing or delays.
- **Edge Browser Compatibility Fix (Jan 29, 2025)**: Resolved authentication stuck issue specific to Microsoft Edge browser. Added browser detection, extended timeouts, fallback session handling, and background verification to prevent Edge users from getting stuck on authentication screen. Edge browser now uses cached authentication immediately while performing background verification after UI loads.
- **Comprehensive Subscription Monitoring (Jan 29, 2025)**: Implemented real-time webhook processing for payment failures, cancellations, and subscription expiry. Enhanced daily monitor detects expired subscriptions and automatically downgrades users to free tier. Manual check endpoint added for troubleshooting subscription issues.
- **Complete Unsubscribe Flow (Jan 29, 2025)**: Implemented comprehensive subscription cancellation system with retention strategies. Features multi-step flow with pause subscription, 50% discount offers, and downgrade options. Includes feedback collection and proper Stripe subscription cancellation. Only shows unsubscribe option to paid users (not free users).
- **Subscription Testing System (Jan 29, 2025)**: Created test users for all subscription tiers with database entries. Optimized post-payment flow to eliminate flickering and excessive API calls. Added proper debouncing and verification caching to prevent authentication loops after successful Stripe payments.
- **Schema Architecture Fixed (Jan 29, 2025)**: Resolved TypeScript schema conflicts by properly separating cloud vs local data operations. Server-side music operations now correctly return no-ops since all music data (songs, tracks, audio files, waveforms) stays local for offline capability. User authentication and subscriptions use cloud PostgreSQL, music data uses local storage.
- **Auto-Reconnect MIDI Implementation (Jan 29, 2025)**: Added automatic reconnection to the last known USB MIDI device when the app launches. System stores device info in localStorage and attempts reconnection using device ID or name/manufacturer matching. Provides seamless experience for live performers who use the same MIDI devices consistently.
- **Instant Playback Implementation (Jan 29, 2025)**: Successfully replaced slow `decodeAudioData` approach with instant HTMLAudioElement playback. Eliminated 8+ second audio decode delays by using MediaElementSource for immediate response while background decoding for advanced features. Audio now plays instantly when clicking play button.

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
- **API**: Web MIDI API for system-level MIDI device integration with lazy initialization pattern.
- **Lazy Initialization**: MIDI system initializes only when users explicitly need it, eliminating blocking startup calls for instant app loading.
- **Persistence**: Global Web MIDI service (`useGlobalWebMIDI.ts`) ensures persistent MIDI connections even when UI components close.
- **Auto-Reconnect**: Automatically reconnects to the last known USB MIDI device when MIDI is initialized, using localStorage device persistence and intelligent device matching (ID or name/manufacturer).
- **Server-side MIDI**: Node.js with `easymidi` library (mock mode in development) for server-side MIDI processing and `ws` for WebSocket communication.
- **Device Management**: Supports USB MIDI, Bluetooth MIDI (for legacy devices), and general MIDI device types. Features automatic scanning, connection management, and signal monitoring.
- **Command Parsing**: Multi-format parser supports new bracket format (`[[PC:12:1]]`, `[[CC:7:64:1]]`, `[[NOTE:60:127:1]]`), as well as legacy hex and text formats.
- **Message Formatting**: Standardized `[[TYPE:VALUE:CHANNEL]]` output format for incoming and outgoing messages.
- **Automated Lyrics MIDI**: MIDI commands embedded in timestamped lyrics automatically execute during playback.

## Core Features
- **Instant-Response Audio Engine**: Uses HTMLAudioElement with MediaElementSource for zero-delay playback while background decoding AudioBuffers for advanced features. Supports up to 6 tracks per song with individual volume, mute, solo, and balance controls. Features real-time VU meters and automatic song duration detection.
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

# Future Feature Ideas

## Professional Backup System (Export/Import)
**Feature**: Complete song library backup and restore functionality for professional users
**Use Case**: Touring musicians need to backup entire setlists and transfer between devices
**Technical Approach**:
- Export songs, lyrics with timestamps, MIDI commands, and audio files into single zip file
- Include manifest.json for metadata, audio/ folder for track files, settings.json for configurations
- Use JSZip library for packaging, streaming approach for large backups
- Import with conflict resolution (merge vs replace options, duplicate detection)
- Selective export options (individual songs, date ranges, setlist-specific backups)
**Benefits**: Seamless device migration while maintaining offline-first philosophy
**Implementation Readiness**: High - current SQLite/IndexedDB architecture supports this well