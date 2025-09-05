# MMI-Muski-Drums Integration Implementation Plan


## **ARCHITECTURE SUMMARY**

**Components**:
- **MMI-Muski-Drums**: AI drum pattern generator with browser UI
- **OSC Bridge**: WebSocket → OSC conversion (server.js)  
- **sonic-pi-receiver.rb**: Pattern processor and MIDI output
- **Ableton Live**: Final audio output via IAC Driver Bus 1

**Key Files**:
- `vendor/muski-drums/src/js/muski-drums.js` - AI generation & pattern conversion
- `src/js/lib/app.js` - UI controls & OSC transmission  
- `src/js/lib/osc-client.js` - WebSocket OSC client
- `server.js` - OSC bridge server
- `config/app.yml` - Loop limits and timing settings

**Pattern Flow**:
1. **User Input**: Steps 0-5 (manual sequencer input)
2. **AI Generation**: Steps 6-15 (Magenta.js continuation) 
3. **Filler Extraction**: Steps 10-15 → condensed 8-step pattern
4. **Dual Transmission**: Both patterns → Sonic Pi
5. **Step 8 Trigger**: Filler plays at halfway point
6. **Continuous Cycle**: Regenerate both patterns every 16 loops

This updated plan focuses on the new dual-pattern system while preserving all completed integration work.