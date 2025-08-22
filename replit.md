# Overview
This project is a live music performance application designed for professional stage use, enabling real-time audio mixing, MIDI event sequencing, and synchronized lyrics display. Key capabilities include a multi-track audio engine (up to 6 tracks per song), visual level monitoring, transport controls, and automatic song duration detection. The application is built for offline operation, utilizing client-side blob URLs for audio and persistent file data storage, eliminating internet dependency during performance. The business vision is to provide a robust, reliable, and user-friendly tool for musicians to manage live performances without external network reliance.

# User Preferences
Preferred communication style: Simple, everyday language.
Architecture preference: **100% local authentication and storage** - completely eliminate all cloud dependencies using localStorage and local popup-based authentication.
Data persistence: Local file system with organized folders for audio files and JSON config files for metadata. All data must be stored locally on user's device.
Performance priority: Fast, dependable operation without any internet connection required. Zero web-based components.
Mobile optimization: **Mobile-first stage performance design** - optimized for live music performance with touch-friendly controls, full-width transport buttons, and clean mobile interface suitable for stage lighting conditions.

# System Architecture

## Mobile App Architecture
- **Framework**: React Native with TypeScript using Expo managed workflow
- **Platform**: Cross-platform Android/iOS native application
- **UI/UX Decisions**: Touch-optimized interfaces with larger targets, full-width transport controls, reorganized mobile layouts (song list at top, lyrics middle, controls bottom), responsive font sizes and spacing for mobile and desktop, landscape orientation for stage performance, and a clean interface focused on performance.
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
- **Track Management**: Reference and manage local backing tracks with automatic song duration detection from audio buffer analysis.
- **MIDI Integration**: Time-stamped MIDI event sequencing embedded in lyrics.
- **Transport Controls**: Play, pause, stop, and seek functionality with keyboard shortcuts.
- **Live Monitoring**: Real-time audio level meters (reactive stereo VU meters) and system status indicators.
- **Lyrics Display**: Synchronized lyrics with auto-scrolling, MIDI command highlighting, an interactive position slider, and smooth timer-based scrolling. Fullscreen mode for immersive stage performance.
- **Local File Reference**: Supports MP3, WAV, OGG, and M4A audio formats using blob URLs.
- **Local Authentication System**: Offline authentication with localStorage sessions, including login/logout flow and user type detection (Free vs Paid).

# External Dependencies

## Core Framework Dependencies
- **react**
- **react-native**
- **expo**

## Audio and Media
- **Expo AV**
- **Expo File System**
- **Expo Document Picker**

# Development History

## RESTORE POINT 20 - SUBSCRIPTION PAYMENT FLOW FIXED (August 22, 2025)
### PaymentElement Script Error Resolution - Production Ready Subscription System

#### CRITICAL ISSUE RESOLVED
- **ROOT CAUSE IDENTIFIED**: PaymentElement component causing "[plugin:runtime-error-plugin] (unknown runtime error)" script errors
- **TECHNICAL FINDING**: Stripe Elements wrapper works fine, but PaymentElement specifically triggers script errors in Replit environment
- **SOLUTION IMPLEMENTED**: Replaced PaymentElement with Stripe Checkout Sessions (redirect-based payment flow)

#### NEW SUBSCRIPTION ARCHITECTURE
- **REDIRECT-BASED PAYMENT**: Professional Stripe Checkout Sessions instead of embedded PaymentElement
- **NEW TAB APPROACH**: Opens Stripe payment in new tab to prevent page hanging in Replit environment
- **ROBUST ERROR HANDLING**: Multiple fallback methods and comprehensive logging for debugging
- **SUCCESS DETECTION**: Automatic subscription upgrade detection via URL parameters and localStorage updates
- **PREMIUM USER EXPERIENCE**: Clean plan selection interface with Premium ($4.99) and Professional ($14.99) tiers

#### TECHNICAL IMPLEMENTATION
- **Frontend**: `/subscribe` route with plan selection and new tab payment opening
- **Backend**: `/api/create-checkout-session` endpoint for Stripe Checkout Session creation
- **Payment Flow**: Button click → API call → Stripe session → new tab → payment completion → return to app
- **Status Updates**: Real-time subscription verification showing "isPaid":true after successful payment

#### VALIDATION COMPLETED
- **TEST CARD PROCESSING**: Confirmed working with Stripe test cards (4242 4242 4242 4242)
- **USER UPGRADE**: Successful transition from free to paid status verified in server logs
- **NO SCRIPT ERRORS**: Complete elimination of PaymentElement-related script errors
- **PROFESSIONAL UX**: Industry-standard redirect payment flow used by major SaaS applications

**STATUS**: ✅ PRODUCTION READY - Subscription payment system fully functional with robust Stripe integration

## RESTORE POINT 19 - COMPLETE PRODUCTION SYSTEM (August 21, 2025)
### Full-Stack StageTracker Pro - Production Ready Architecture

#### CORE APPLICATION FEATURES
- **MULTI-TRACK AUDIO ENGINE**: Real-time mixing with up to 6 tracks per song, individual volume/mute/solo controls
- **LIVE PERFORMANCE OPTIMIZED**: Offline-capable with local audio file storage via blob URLs
- **LYRICS DISPLAY**: Synchronized lyrics with auto-scrolling and position navigation
- **MOBILE-FIRST DESIGN**: Touch-optimized controls for stage performance conditions
- **TRANSPORT CONTROLS**: Play, pause, stop, rewind with keyboard shortcuts (Space, R, P, N)
- **VU METERS**: Real-time stereo level monitoring with visual feedback
- **SONG MANAGEMENT**: Local SQLite database with drag-and-drop file uploads
- **WAVEFORM GENERATION**: Automatic audio analysis for precise timing

#### SUBSCRIPTION SYSTEM (PRODUCTION READY)
- **STRIPE INTEGRATION**: Complete test mode with real payment processing (sk_test_ keys)
- **CREDIT CARD PROCESSING**: Professional payment form with proper text contrast
- **SUBSCRIPTION VERIFICATION**: 3-layer verification (localStorage → server files → Stripe API)
- **CROSS-DEVICE CONSISTENCY**: Email-based subscription status across all devices
- **DEMO ACCOUNTS**: mazzu001@hotmail.com/demo123 and paid@demo.com/demo123 configured
- **BUSINESS MODEL**: $4.99/month with 2-song free tier, unlimited premium access

#### AUTHENTICATION ARCHITECTURE
- **HYBRID LOCAL-CLOUD**: User credentials in PostgreSQL cloud, performance data local
- **SESSION MANAGEMENT**: 24-hour localStorage sessions with 4-hour verification intervals
- **OFFLINE PERFORMANCE**: All audio and song data cached locally for stage reliability
- **SUBSCRIPTION MANAGER**: Server-side SubscriptionManager class with Stripe webhook integration

#### TECHNICAL STACK
- **Frontend**: React + TypeScript with Vite, Tailwind CSS, shadcn/ui components
- **Backend**: Node.js + Express with Stripe API integration
- **Databases**: PostgreSQL (cloud users) + SQLite (local music data)
- **Audio Processing**: Web Audio API with real-time level analysis
- **File Storage**: Browser blob URLs for offline audio file access
- **Build System**: Vite with hot module replacement

#### DEPLOYMENT READY
- **Environment Variables**: STRIPE_SECRET_KEY, VITE_STRIPE_PUBLIC_KEY configured
- **Database Setup**: Hybrid PostgreSQL + SQLite architecture operational
- **Error Handling**: Comprehensive error states with user-friendly messaging
- **Performance**: Optimized for live stage use with instant audio playback
- **Security**: Secure credential storage with encrypted sessions

#### SAMPLE SONGS INCLUDED
- **3AM by Matchbox Twenty**: 6-track backing arrangement (Guitar, Bass, Drums, Organ, Backups, Click)
- **Comfortably Numb by Pink Floyd**: 6-track backing arrangement (Acoustic, Bass, Drums, Keys, Backups, Click)
- **ZIP Downloads**: Sample files available via /api/download/ endpoints

**STATUS**: PRODUCTION COMPLETE - Full-featured music performance application with robust subscription system, ready for live stage deployment

#### RECENT IMPLEMENTATION - PREMIUM USER UX ENHANCEMENT (August 21, 2025)
- **STATUS**: ✅ COMPLETED - Premium user interface improvements implemented
- **SUBSCRIBE BUTTON**: Settings menu "Subscribe Now" button now greys out for premium users
- **VISUAL FEEDBACK**: Button shows "Already Subscribed" with reduced opacity and disabled state
- **UX IMPROVEMENT**: Premium users get clear visual confirmation of their subscription status
- **USER TESTING**: Confirmed working with demo account mazzu001@hotmail.com

#### RECENT IMPLEMENTATION - CLOUD USER AUTHENTICATION (August 21, 2025) 
- **STATUS**: ✅ COMPLETED - Full cloud-based user authentication system operational
- **DATABASE**: PostgreSQL cloud database successfully connected using standard postgres-js driver
- **USER ACCOUNTS**: Registration and login working with persistent cloud storage across devices
- **AUTHENTICATION**: Email/password system with proper cloud database persistence
- **ARCHITECTURE**: Hybrid system - user accounts in PostgreSQL cloud, music files remain local
- **TECHNICAL SOLUTION**: Replaced Neon serverless client with standard PostgreSQL connection for stability

#### RECENT FIX - DURATION CALCULATION (August 21, 2025)
- **ISSUE RESOLVED**: Song duration showing default 3:00 instead of actual track length
- **TECHNICAL SOLUTION**: Connected audio engine duration callback to local song database updates
- **IMPLEMENTATION**: Modified useAudioEngine hook with callback pattern, automatic database persistence
- **RESULT**: Accurate duration display (394s for Comfortably Numb, 229s for 3AM) from audio buffer analysis
- **USER CONFIRMATION**: ✅ Verified working correctly by user testing

## RESTORE POINT 15 - BLUETOOTH MIDI CONNECTIVITY (August 20, 2025)
### Complete Bluetooth MIDI Device Integration
- **BLUETOOTH DISCOVERY**: Web Bluetooth API integration for discovering nearby MIDI devices
- **DEVICE DETECTION**: Automatic identification of Bluetooth vs USB MIDI devices with visual indicators
- **SIGNAL STRENGTH**: Real-time Bluetooth signal strength monitoring with visual bars
- **BIDIRECTIONAL COMMUNICATION**: Full send and receive capabilities for both USB and Bluetooth MIDI
- **ACTIVITY MONITORING**: Live MIDI message display with timestamps and device identification
- **ENHANCED UI**: Professional device manager with separate sections for input/output devices
- **CONNECTION STATUS**: Real-time activity indicators and connection state monitoring
- **TEST FUNCTIONS**: Enhanced test sequences optimized for Bluetooth device validation
- **STATUS**: STABLE - Professional Bluetooth MIDI connectivity for live performance control