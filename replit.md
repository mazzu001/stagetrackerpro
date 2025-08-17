# Overview

This is a live music performance application built with React, Express, and PostgreSQL. The system provides real-time audio mixing, MIDI event sequencing, and synchronized lyrics display for live performances. It features a comprehensive audio engine with multi-track playback (up to 6 tracks per song), visual level monitoring, transport controls, and automatic song duration detection from uploaded audio files for professional stage use.

# User Preferences

Preferred communication style: Simple, everyday language.

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
- **File Storage**: Local file system for audio file uploads with multer middleware
- **Session Management**: PostgreSQL-backed sessions using connect-pg-simple
- **Development**: Hot module replacement with Vite middleware integration

## Data Storage
- **Primary Database**: PostgreSQL with three main tables:
  - `songs`: Core song metadata including title, artist, duration, BPM, key, and lyrics
  - `tracks`: Individual audio tracks per song with volume, mute, and solo controls
  - `midiEvents`: Time-stamped MIDI events for automation and effects
- **File Storage**: Local uploads directory for audio files (MP3, WAV, OGG, M4A)
- **Schema Management**: Drizzle migrations for database versioning

## Core Features
- **Multi-track Audio Engine**: Real-time audio mixing with individual track controls (up to 6 tracks per song)
- **Track Management**: Upload and manage backing tracks with automatic song duration detection
- **MIDI Integration**: Timed MIDI event sequencing embedded in lyrics
- **Transport Controls**: Play, pause, stop, and seek functionality with keyboard shortcuts
- **Live Monitoring**: Real-time audio level meters and system status indicators
- **Lyrics Display**: Synchronized lyrics with auto-scrolling and MIDI command highlighting
- **File Upload**: Support for MP3, WAV, OGG, and M4A audio formats with progress tracking

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