# Automated MIDI Commands in Lyrics Guide
**Date: August 28, 2025**
**Status: FULLY FUNCTIONAL**

## Overview
The live performance application includes a powerful automated MIDI command system that executes MIDI commands embedded in timestamped lyrics. This allows for precise, automated control of external devices like the TC-Helicon VoiceLive 3 during live performances.

## How It Works

### 1. Timestamped Lyrics Format
Lyrics must include timestamps in the format `[MM:SS]` at the beginning of each line:

```
[00:15] First verse line here
[00:30] Second verse line here [[PC:1:1]]
[00:45] Chorus begins [[CC:7:100:1]]
[01:00] Harmony section [[PC:2:1]]
```

### 2. MIDI Command Format
MIDI commands are embedded within lyrics using double bracket notation:

- **Program Change**: `[[PC:12:1]]` - Changes to program 12 on channel 1
- **Control Change**: `[[CC:7:64:1]]` - Sets controller 7 to value 64 on channel 1  
- **Note On/Off**: `[[NOTE:60:127:1]]` - Plays middle C at velocity 127 on channel 1

### 3. Automatic Execution
During playbook:
1. The system monitors playback time against timestamped lyrics
2. When playback reaches a timestamped line (within 0.5 seconds), it processes that line
3. Any MIDI commands in double brackets are automatically sent to connected devices
4. Each timestamp is processed only once per playback session
5. Commands are reset when playback stops or when seeking to the beginning

## Example Song with MIDI Commands

```
[00:00] Song intro begins
[00:15] Verse 1 starts here [[PC:1:1]]
[00:30] Building up the energy [[CC:7:80:1]]
[00:45] Chorus time! [[PC:2:1]]
[01:00] Big harmonies [[CC:7:127:1]]
[01:15] Verse 2 with effects [[PC:3:1]]
[01:30] More intensity [[CC:7:100:1]]
[01:45] Final chorus [[PC:4:1]]
[02:00] Outro begins [[CC:7:40:1]]
[02:15] Song ends [[PC:0:1]]
```

## Device Support

### TC-Helicon VoiceLive 3 Examples
- `[[PC:1:1]]` - Switch to preset 1
- `[[PC:2:1]]` - Switch to preset 2
- `[[CC:7:127:1]]` - Set volume to maximum
- `[[CC:7:0:1]]` - Mute/minimum volume

### General MIDI Devices
- Any device supporting standard MIDI commands will work
- Commands are sent via Web MIDI API to connected devices
- Both USB MIDI and Bluetooth MIDI devices supported

## Professional Features

### Access Requirements
- Automated MIDI commands require a **Professional subscription**
- Manual MIDI commands also restricted to Professional users
- Free users can view lyrics but cannot execute MIDI commands

### Visual Feedback
- MIDI status indicator shows connection state
- Blue blink effect when commands are sent
- Console logging for troubleshooting

## Usage Instructions

### 1. Connect MIDI Device
1. Ensure your MIDI device (e.g., TC-Helicon + WIDI Jack) is properly paired at system level
2. Open the Bluetooth MIDI manager in the app
3. Connect to your device (should show "MIDI Ready" status)

### 2. Create Song with MIDI Commands
1. Add a new song or edit existing lyrics
2. Add timestamps: `[MM:SS]` at the start of lines where you want events
3. Embed MIDI commands in double brackets: `[[COMMAND]]`
4. Save the lyrics

### 3. Live Performance
1. Select your song with MIDI-enabled lyrics
2. Ensure your MIDI device is connected
3. Start playback - MIDI commands will execute automatically at their timestamps
4. Commands are sent precisely when playback reaches each timestamp

## Troubleshooting

### Commands Not Executing
1. **Check subscription**: Professional subscription required
2. **Verify MIDI connection**: Device must show "MIDI Ready" status
3. **Check timestamp format**: Must be `[MM:SS]` at line start
4. **Verify command format**: Must be `[[COMMAND]]` with proper syntax

### Console Logging
The system provides detailed logging for debugging:
```
📋 Analyzing lyrics for song: Song Title
⏰ Found timestamped line: [01:30] at 90s -> "Chorus time! [[PC:2:1]]"
🎵 Found MIDI command in timestamped line: [[PC:2:1]]
🎼 Sending MIDI command from lyrics: [[PC:2:1]]
```

## Best Practices

### Timing Precision
- Use precise timestamps aligned with your audio tracks
- Test timing during rehearsals
- Allow 0.5-second tolerance window for command execution

### Command Placement
- Place commands at natural song transitions
- Use Program Changes for preset switching
- Use Control Changes for gradual parameter adjustments

### Performance Setup
- Test all MIDI commands before live performance
- Keep manual override capability available
- Have backup plan if MIDI connection fails

## Technical Implementation

### System Architecture
- **Frontend**: React component monitors playback time vs timestamps
- **MIDI Processing**: Web MIDI API handles device communication
- **Command Parsing**: Robust regex patterns detect and parse MIDI commands
- **State Management**: Prevents duplicate command execution per timestamp

### Supported MIDI Messages
- Program Change (PC): 0xC0 + program number
- Control Change (CC): 0xB0 + controller + value  
- Note On/Off (NOTE): 0x90/0x80 + note + velocity

This automated MIDI system transforms static lyrics into dynamic, interactive performance control, enabling precise automation of external devices synchronized with your musical performance.