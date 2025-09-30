# StageTracker Pro – Firebase Hosting Setup

This repo is configured to deploy on Firebase Hosting and broadcast via Firebase Realtime Database.

Quick steps:
1. Install CLI (one-time):
   - npm i -g firebase-tools
2. Login:
   - firebase login
3. Initialize (one-time):
   - firebase init hosting database
   - Use existing project: stagetrackerpro-a193d
   - Public directory: .
   - SPA: No
   - Use database.rules.json for RTDB rules
4. Deploy:
   - firebase deploy

Notes:
- Rewrites are set so /viewer, /performance, /dashboard go to the right HTML files.
- RTDB rules are open for testing in database.rules.json. Tighten before production.
- Host pushes small live state every ~1s; static data is written only when song changes.

Tightening rules (later):
- Require Auth for writes; only allow a room’s host to write under rooms/{room}. Host can set a hostUid on start and rules can match request.auth.uid.
