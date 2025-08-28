# TC-Helicon VoiceLive 3 MIDI Guide

## CONFIRMED: MIDI Communication Working
Based on console logs from August 28, 2025, MIDI transmission is **fully functional**:

- ✅ **Outgoing**: Successfully sending `c0 01` (Program Change 1) via raw MIDI bytes
- ✅ **Incoming**: Device responding with timestamped BLE MIDI data:
  - `a9 e4 b0 20 00 e4 c0 04 e4 b0 73 00`
  - `a9 ed b0 70 40` 
  - `a9 f2 b0 68 40`

## TC-Helicon VoiceLive 3 Specific Commands

### Program Changes
The VoiceLive 3 has 500+ presets organized in banks. Try these commands:

```
[[PC:0:1]]   - Program 0 (first preset)
[[PC:12:1]]  - Program 12 
[[PC:127:1]] - Program 127 (last preset in bank)
```

### Bank Selection (Required for accessing all presets)
```
[[CC:0:0:1]]  - Bank Select MSB = 0
[[CC:32:0:1]] - Bank Select LSB = 0 (Bank 0)
[[PC:12:1]]   - Then select program 12

[[CC:0:1:1]]  - Bank Select MSB = 1  
[[CC:32:0:1]] - Bank Select LSB = 0 (Bank 128)
[[PC:0:1]]    - Program 0 in Bank 128
```

### Common Control Changes
```
[[CC:7:100:1]]   - Volume (0-127)
[[CC:1:64:1]]    - Modulation wheel
[[CC:11:100:1]]  - Expression pedal
[[CC:64:127:1]]  - Sustain pedal on
[[CC:64:0:1]]    - Sustain pedal off
```

## Troubleshooting Steps

1. **Check MIDI Channel**: VoiceLive 3 default is usually Channel 1, but verify in settings
2. **Try Bank 0 First**: Start with `[[CC:0:0:1]]` then `[[CC:32:0:1]]` then `[[PC:X:1]]`
3. **Program Numbers**: VoiceLive 3 might display programs as 1-128 but receive 0-127
4. **Manual Mode**: Ensure VoiceLive 3 is in "Manual" mode, not "Auto" or "Guide"

## Test Sequence
```
1. [[CC:0:0:1]]    # Set Bank MSB to 0
2. [[CC:32:0:1]]   # Set Bank LSB to 0  
3. [[PC:0:1]]      # Select Program 0
4. [[PC:12:1]]     # Select Program 12
5. [[CC:7:100:1]]  # Set volume to 100
```

## Success Indicators
- VoiceLive 3 display should show preset name change
- LED indicators should change
- Audio processing should switch to new preset
- Console shows successful transmission: "✅ SUCCESS: Raw MIDI sent without response!"

**Note**: The MIDI system is working correctly. If presets aren't changing, the issue is device configuration, not MIDI transmission.