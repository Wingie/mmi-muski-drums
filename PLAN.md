# MMI-Muski-Drums Integration Implementation Plan

---

## 🎯 **CURRENT PRIORITY: FILLER PATTERN GENERATION SYSTEM**

### **New Feature: Dual AI-Generated Patterns System**

**Goal**: Generate both original pattern AND filler pattern using TWO separate AI generation calls.

**System Design**:
1. **FIRST AI GENERATION**: User input (steps 0-5) → Complete original 16-step pattern  
2. **EXTRACT steps 10-15** from original pattern (6 steps from end of AI generation)
3. **SECOND AI GENERATION**: Extracted steps (10-15) as input → Complete filler 16-step pattern
4. **SEND BOTH complete 16-step patterns to Sonic Pi**:
   - `originalPattern`: Complete 16-step pattern (from first AI generation)
   - `fillerPattern`: Complete 16-step pattern (from second AI generation)  
5. **Sonic Pi switches between patterns** dynamically during playback

### **Implementation Plan**

#### Step 1: Modify `generateUsingAI()` for Dual AI Generation  
**File**: `vendor/muski-drums/src/js/muski-drums.js`

```javascript
async generateUsingAI() {
  // FIRST AI GENERATION: Original pattern from user input (steps 0-5)
  const inputSequence = this.sequencer.getSequence().slice(0, inputLen);
  const originalContinuation = await this.ai.continueSeq(
    inputSequence,
    sequenceLen - inputLen,
    DEFAULT_TEMPERATURE
  );
  
  // Build complete original 16-step pattern (user input + AI continuation)
  const originalSequence = [...inputSequence];
  originalContinuation.notes.forEach((note) => {
    const normalizedPitch = note.pitch;
    const stepIndex = note.quantizedStartStep + inputLen;
    if (stepIndex >= inputLen && stepIndex < sequenceLen) {
      originalSequence[stepIndex].push(normalizedPitch);
    }
  });
  
  // EXTRACT steps 10-15 from original pattern as input for filler  
  const fillerInput = this.extractFillerInput(originalSequence, 10, 15);
  
  // SECOND AI GENERATION: Filler pattern from extracted steps
  const fillerContinuation = await this.ai.continueSeq(
    fillerInput,
    sequenceLen - fillerInput.length,
    DEFAULT_TEMPERATURE
  );
  
  // Build complete filler 16-step pattern (extracted input + AI continuation)
  const fillerSequence = [...fillerInput];
  fillerContinuation.notes.forEach((note) => {
    const normalizedPitch = note.pitch;
    const stepIndex = note.quantizedStartStep + fillerInput.length;
    if (stepIndex >= fillerInput.length && stepIndex < sequenceLen) {
      fillerSequence[stepIndex].push(normalizedPitch);
    }
  });
  
  // Update visual sequencer with original pattern
  this.transitionSequencerToSequence(originalSequence);
  
  // Convert BOTH patterns to Sonic Pi format  
  const originalPattern = this.convertToSonicPiFormat(originalSequence);
  const fillerPattern = this.convertToSonicPiFormat(fillerSequence);
  
  return {
    original: originalPattern,
    filler: fillerPattern
  };
}

// NEW METHOD: Extract steps 10-15 as input for filler AI generation
extractFillerInput(sequence, startStep, endStep) {
  const fillerInput = [];
  for (let step = startStep; step <= endStep; step++) {
    fillerInput.push([...(sequence[step] || [])]);
  }
  return fillerInput; // Returns 6-step sequence for AI input
}
```

#### Step 2: Update Pattern Transmission 
**File**: `src/js/lib/app.js`

```javascript
async handleAiButton() {
  // ... existing logic ...
  
  try {
    const patternData = await this.drumMachine.generateUsingAI();
    console.log('🤖 AI generation complete:', {
      original: patternData.original,
      filler: patternData.filler
    });
    
    // Send BOTH patterns to Sonic Pi
    this.sendCurrentPatternToOSC(patternData);
  } catch (error) {
    console.error('❌ AI generation failed:', error);
  }
}

// MODIFY EXISTING METHOD: Update sendCurrentPatternToOSC to handle dual patterns
sendCurrentPatternToOSC(patternData) {
  if (!this.oscClient || !this.oscClient.isReady()) {
    console.log('OSC not ready, skipping pattern send');
    return;
  }

  // Send original pattern to /wek/outputs and /wek2/outputs
  this.oscClient.sendPattern(
    patternData.original.notes, 
    patternData.original.steps, 
    false  // isFillerPattern = false
  );
  
  // Send filler pattern to /wek3/outputs and /wek4/outputs
  this.oscClient.sendPattern(
    patternData.filler.notes,
    patternData.filler.steps,
    true   // isFillerPattern = true (uses different OSC endpoints)
  );
  
  // Set initial play mode (will switch dynamically in handleDrumMachineStep)
  this.oscClient.setPlayMode(0);  // Start with original pattern
}
```

#### Step 3: Update OSC Client to Handle Filler Pattern Flag
**File**: `src/js/lib/osc-client.js`

```javascript
// MODIFY EXISTING METHOD: Update sendPattern to handle filler flag
sendPattern(notes, steps, isFillerPattern = false) {
  if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
    console.log('WebSocket not ready for pattern');
    return;
  }

  if (isFillerPattern) {
    // Send filler pattern to /wek3/outputs and /wek4/outputs
    console.log('📤 Sending filler pattern:', { notes, steps });
    this.ws.send(JSON.stringify({
      type: 'osc',
      data: ['/wek3/outputs', notes]
    }));
    this.ws.send(JSON.stringify({
      type: 'osc',
      data: ['/wek4/outputs', steps]
    }));
  } else {
    // Send original pattern to /wek/outputs and /wek2/outputs (existing behavior)
    console.log('📤 Sending original pattern:', { notes, steps });
    this.ws.send(JSON.stringify({
      type: 'osc',
      data: ['/wek/outputs', notes]
    }));
    this.ws.send(JSON.stringify({
      type: 'osc',
      data: ['/wek2/outputs', steps]
    }));
  }
}
```

#### Step 4: Add Dynamic Play Mode Switching in handleDrumMachineStep
**File**: `src/js/lib/app.js`

```javascript
// Pattern switching configuration
const PATTERN_CYCLE = {
  totalLoops: 20,
  switches: {
    8: { mode: 1, description: 'first filler section' },
    10: { mode: 0, description: 'back to original' },
    18: { mode: 1, description: 'second filler section' },
    20: { mode: 0, description: 'reset to original before regeneration' }
  }
};

handleDrumMachineStep(step) {
  if (step === 0) {
    this.currentLoopPlayCount += 1;
    console.log(`🔁 Loop ${this.currentLoopPlayCount} | Idle: ${this.loopsPlayedSinceLastInput} | Mode: ${this.generationMode}`);
    
    // Dynamic play mode switching using configuration
    const switchConfig = PATTERN_CYCLE.switches[this.currentLoopPlayCount];
    if (switchConfig) {
      this.oscClient.setPlayMode(switchConfig.mode);
      console.log(`🔀 Loop ${this.currentLoopPlayCount}: Switched to mode ${switchConfig.mode} (${switchConfig.description})`);
    }
    
    if (this.loopsPlayedSinceLastInput >= this.config.app.maxIdleLoops) {
      this.stopDrumMachine();
    } else {
      this.loopsPlayedSinceLastInput += 1;

      // Regenerate every cycle
      if ((this.shouldRegeneratePattern || this.currentLoopPlayCount >= PATTERN_CYCLE.totalLoops)) {
        if (this.generationMode === 'ai') {
          this.drumMachine.generateUsingAI().then(patternData => {
            console.log('🔄 Continuous dual AI generation complete:', patternData);
            this.sendCurrentPatternToOSC(patternData);
          });
        }
        this.shouldRegeneratePattern = false;
        this.currentLoopPlayCount = 0;
        console.log(`✅ Counters reset - next regeneration in ${PATTERN_CYCLE.totalLoops} loops`);
      }
    }
  }
}
```

### **Expected Behavior After Implementation**

1. **Dual AI Generation**: 
   - **First AI call**: User input (0-5) → Complete original pattern (0-15)
   - **Second AI call**: Extracted steps (10-15) → Complete filler pattern (0-15)
2. **Pattern Transmission**: Sends both complete 16-step patterns to Sonic Pi simultaneously  
3. **20-Loop Cycle with Dynamic Switching**:
   - **Loops 1-8**: Play original pattern (mode 0)
   - **Loop 8**: Switch to filler pattern (mode 1) 
   - **Loops 9-10**: Play filler pattern (2 loops)
   - **Loop 10**: Switch back to original pattern (mode 0)
   - **Loops 11-18**: Play original pattern (8 loops)
   - **Loop 18**: Switch to filler pattern (mode 1)
   - **Loops 19-20**: Play filler pattern (2 loops)
   - **Loop 20**: Regenerate both patterns, reset to loop 1
4. **Continuous Generation**: Both AI calls repeat every 20 loops, generating fresh original + filler patterns
5. **Debug Logging**: Shows dual AI generations, pattern switching, and mode changes

### **Test Checkpoints**

**✅ Checkpoint 1**: Dual AI Generation
- [ ] First AI generation creates complete original pattern (steps 0-15)
- [ ] `extractFillerInput()` correctly extracts steps 10-15 as 6-step sequence
- [ ] Second AI generation uses extracted steps as input
- [ ] Both AI calls complete successfully with debug logging

**✅ Checkpoint 2**: Pattern Completion
- [ ] Original pattern built correctly (user input + first AI continuation)
- [ ] Filler pattern built correctly (extracted input + second AI continuation)  
- [ ] Both patterns are complete 16-step sequences
- [ ] Visual sequencer shows original pattern

**✅ Checkpoint 3**: Dual Transmission  
- [ ] Both complete patterns sent to Sonic Pi via OSC
- [ ] Original pattern uses `/wek/outputs` and `/wek2/outputs`
- [ ] Filler pattern uses `/wek3/outputs` and `/wek4/outputs`
- [ ] Sonic Pi receives two complete, musically-related patterns

**✅ Checkpoint 4**: Continuous Dual Generation
- [ ] Both AI calls repeat during continuous generation
- [ ] Fresh original + filler patterns generated every 16 loops
- [ ] Performance remains smooth with dual AI processing

---

## ✅ **COMPLETED PHASES**

### **Phase 2: OSC Bridge Integration - COMPLETE**
- [✅] **Pattern Transmission**: Complete 16-step patterns sent to Sonic Pi
- [✅] **Continuous Generation**: AI regenerates every 16 loops with OSC transmission  
- [✅] **Debug Logging**: Full pattern flow tracing implemented
- [✅] **Beat Sync**: Beat feedback from Sonic Pi → MMI visual sync
- [✅] **Audio Silencing**: MMI browser audio muted for pure OSC mode
- [✅] **MIDI Note Mapping**: Correct mapping to standard drum MIDI notes (36-51)
- [✅] **Double Conversion Fix**: AI pattern processing uses direct MIDI notes
- [✅] **Format Conversion**: Sonic Pi format `{notes: [...], steps: [...]}` implemented

### **Core Technical Flow - VERIFIED WORKING**
```
User clicks "with AI" 
→ generateUsingAI() creates 16-step pattern
→ convertToSonicPiFormat() transforms to {notes, steps} 
→ sendCurrentPatternToOSC(sonicPiData) transmits via WebSocket
→ OSC bridge forwards to Sonic Pi
→ sonic-pi-receiver.rb processes pattern
→ MIDI output to Ableton Live
→ Beat feedback returns to MMI for visual sync
```

---

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