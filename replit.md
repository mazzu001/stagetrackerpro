# Overview
This project is a professional, offline-capable live music performance application designed for stage use. It features real-time audio mixing, advanced Web MIDI device management, and synchronized lyrics display. The application prioritizes offline functionality, utilizing local storage for all performance data and blob URLs for audio files, making it production-ready with robust MIDI integration. Its primary purpose is to provide a reliable, high-performance tool for musicians during live performances, ensuring zero internet dependency and seamless operation.

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
- **Database**: Hybrid setup - PostgreSQL (user data) + SQLite (music data) for isolated user data, IndexedDB for comprehensive song storage.
- **UI Framework**: Tailwind CSS + Radix UI (shadcn/ui components)
- **State Management**: React Query + React hooks
- **Routing**: Wouter for client-side routing

## MIDI System Architecture
- **API**: Web MIDI API for system-level MIDI device integration with a background service pattern.
- **Background Service**: MIDI system auto-initializes on app startup in the background, allowing the Web MIDI API to operate without blocking the UI. It continuously monitors for device changes (hot-plug detection).
- **Initialization**: Features a staged initialization process (USB MIDI, auto-reconnect, Bluetooth MIDI on demand) to prevent app freezing.
- **Persistence**: Global Web MIDI service (`useGlobalWebMIDI.ts`) ensures persistent MIDI connections.
- **Auto-Reconnect**: Automatically reconnects to previously connected USB MIDI devices using localStorage for device persistence and intelligent matching.
- **Server-side MIDI**: Node.js with `easymidi` library (mock mode in development) for server-side MIDI processing and `ws` for WebSocket communication.
- **Device Management**: Supports USB MIDI, Bluetooth MIDI, and general MIDI device types with automatic scanning and connection management.
- **Command Parsing**: Multi-format parser supports `[[TYPE:VALUE:CHANNEL]]` bracket format, as well as legacy hex and text formats.
- **Automated Lyrics MIDI**: MIDI commands embedded in timestamped lyrics automatically execute during playback.

## Core Features
- **Instant-Response Audio Engine**: Uses HTMLAudioElement with MediaElementSource for zero-delay playback while background decoding AudioBuffers. Supports up to 6 tracks per song with individual controls, real-time VU meters, and automatic song duration detection.
- **Advanced MIDI Integration**: Comprehensive device detection, universal command formatting, real-time message monitoring, and persistent connection management with staged, lazy initialization.
- **Performance Interface**: Transport controls with keyboard shortcuts, synchronized lyrics with auto-scrolling and MIDI command highlighting, interactive position slider, and fullscreen mode. Optimized for mobile and touch controls.
- **Data Management**: Uses local file system for audio (Blob URLs), IndexedDB for structured song and audio file storage, localStorage for offline authentication, and a hybrid PostgreSQL/SQLite database for user and subscription data. Includes subscription tiers with Stripe integration. Implements per-user database isolation.
- **Cache-Busting System**: Comprehensive production-ready cache-busting solution with HTML cache control, dynamic build ID, pre-runtime error handlers, and user update notifications.
- **Song Deletion**: Robust system to remove all traces of deleted songs, including audio files and references.

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