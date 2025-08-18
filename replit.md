# Overview

This is a live music performance application built with React, Express, and in-memory storage. The system provides real-time audio mixing, MIDI event sequencing, and synchronized lyrics display for live performances. It features a comprehensive audio engine with multi-track playbook (up to 6 tracks per song), visual level monitoring, transport controls, and automatic song duration detection from local audio files for professional stage use. The app works completely offline using client-side blob URLs for audio files with persistent file data storage - no internet connection or file uploads required.

## Recent Updates (August 18, 2025)

✓ **Subscription system** - Complete $4.99/month Stripe payment processing with user authentication
✓ **Professional landing page** - Marketing page with features, pricing, and sign-up flow
✓ **Development mode access** - Subscription checks bypassed in development for testing
✓ **Subscription protection** - All performance features protected behind active subscription paywall (production only)
✓ **Smart file reconnection** - Improved dialog for bulk file selection and automatic name matching
✓ **Settings menu** - Added dropdown menu under settings gear with user info and logout option
✓ **File path-based storage system** - Stores local file paths instead of blob data for true offline operation
✓ **Automatic file discovery** - App displays expected files on startup and loads them when selected
✓ **Smart file registration** - Files become immediately available when added through file picker
✓ **Persistent track references** - Track metadata saved with file path references for session persistence
✓ **Memory-efficient caching** - Files cached by path for instant access without data duplication
✓ **Lyrics import feature** - Added web search functionality to import song lyrics automatically
✓ **Delete song feature** - Added safe song deletion with confirmation dialog that protects local files

# User Preferences

Preferred communication style: Simple, everyday language.
Architecture preference: Completely offline operation using local file paths - no file uploads or internet dependency required.
Data persistence: Automatic saving to localStorage with file path references and smart file registration for audio files.

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript using Vite for development and building
- **Styling**: Tailwind CSS with shadcn/ui component library for consistent design system
- **State Management**: TanStack Query for server state management and caching
- **Routing**: Wouter for lightweight client-side routing
- **Audio Processing**: Web Audio API through custom AudioEngine class for real-time audio manipulation

## Backend Architecture
- **Runtime**: Node.js with Express.js REST API server
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **File Storage**: Local file path references with automatic registration - no server storage needed
- **Session Management**: PostgreSQL-backed sessions using connect-pg-simple
- **Development**: Hot module replacement with Vite middleware integration

## Data Storage
- **Primary Database**: In-memory storage with three main collections:
  - `songs`: Core song metadata including title, artist, duration, BPM, key, and lyrics
  - `tracks`: Individual audio tracks per song with volume, mute, and solo controls (using blob URLs)
  - `midiEvents`: Time-stamped MIDI events for automation and effects
- **File Storage**: Local file path storage with smart caching (MP3, WAV, OGG, M4A) - completely offline
- **Schema Management**: TypeScript types for data validation

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