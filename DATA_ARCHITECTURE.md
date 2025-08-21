# StageTracker Pro - Data Storage Architecture

## Core Principle: Hybrid Local-Cloud Architecture

### LOCAL STORAGE (User's Device)
**Purpose**: Enable offline performance capability and fast audio processing

**Data Stored Locally:**
- Audio Files: All MP3, WAV, OGG, M4A files via blob URLs
- Songs Database: SQLite database with song metadata, lyrics, timestamps  
- Track Configurations: Individual track settings, volumes, mix controls
- Performance Settings: User preferences, display settings, keyboard shortcuts
- File System: Organized folder structure for audio file management

**Benefits:**
- Instant audio playback during live performances
- No internet dependency during shows
- Fast search and navigation
- Reliable stage performance

### CLOUD STORAGE (PostgreSQL Database)
**Purpose**: Centralized user management and subscription verification

**Data Stored in Cloud:**
- User Authentication: Login credentials, user profiles
- Subscription Status: Stripe customer ID, subscription ID, billing status
- Account Types: Free vs Premium tier management
- Cross-Device Sync: Same subscription status across all devices

**Benefits:**
- Secure credential management
- Cross-device subscription consistency  
- Centralized billing and user management
- Scalable subscription verification

## Authentication Flow

### Login Process:
1. User enters email/password in client
2. Credentials verified against cloud PostgreSQL database
3. 24-hour session token stored in localStorage
4. Subscription status cached locally for performance

### Subscription Verification:
1. Layer 1: Fast localStorage cache (instant access)
2. Layer 2: Server-side subscription files (backup verification)
3. Layer 3: Live Stripe API calls (authoritative source every 4 hours)

### Cross-Device Consistency:
- User upgrades subscription on phone → All devices get Premium access
- Subscription cancelled → All devices automatically downgraded to Free tier
- Login from new device → Inherits correct subscription status immediately

This architecture provides the perfect balance of performance reliability for stage use while maintaining secure, centralized user and subscription management.