# Overview
This project is a professional, offline-capable live music performance application designed for stage use. It features real-time audio mixing, advanced Web MIDI device management, and synchronized lyrics display. The application prioritizes offline functionality, utilizing local storage for all performance data and blob URLs for audio files. It is production-ready with robust MIDI integration, including persistent connections, and comprehensive device management.

## Recent Changes
- **Schema Architecture Fixed (Jan 29, 2025)**: Resolved TypeScript schema conflicts by properly separating cloud vs local data operations. Server-side music operations now correctly return no-ops since all music data (songs, tracks, audio files, waveforms) stays local for offline capability. User authentication and subscriptions use cloud PostgreSQL, music data uses local storage.
- **Upgrade Subscription Button (Jan 29, 2025)**: Added attractive gradient upgrade button (purple to blue) with Crown icon below settings button. Shows contextual text based on subscription tier ("Upgrade" for free, "Upgrade to Pro" for paid). Integrates with Stripe payment system for subscription upgrades.
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
- **API**: Web MIDI API for system-level MIDI device integration.
- **Persistence**: Global Web MIDI service (`useGlobalWebMIDI.ts`) ensures persistent MIDI connections even when UI components close.
- **Auto-Reconnect**: Automatically reconnects to the last known USB MIDI device on app launch using localStorage device persistence and intelligent device matching (ID or name/manufacturer).
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