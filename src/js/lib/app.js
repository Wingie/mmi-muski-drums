// eslint-disable-next-line import/no-relative-packages
import MuskiDrumsManager from '../../../vendor/muski-drums/src/js/muski-drums-manager';
// eslint-disable-next-line import/no-relative-packages
import MuskiDrums from '../../../vendor/muski-drums/src/js/muski-drums';
import PatternDiagram from './pattern-diagram';
import OSCClient from './osc-client';

export default class MuskiDrumsApp {
  constructor(config) {
    this.config = config;
    this.drumsManager = null;
    this.drumMachine = null;
    this.generationMode = null;
    this.currentLoopPlayCount = 0;
    this.shouldRegeneratePattern = false;
    this.loopsPlayedSinceLastInput = 0;
    this.element = document.createElement('div');
    
    // Initialize OSC client for Sonic Pi integration
    this.oscClient = new OSCClient();
    this.oscClient.onConnect(this.handleOSCConnection.bind(this));
    this.oscClient.onMessage(this.handleOSCMessage.bind(this));
    this.element.classList.add('muski-drums-app');
    if (this.config.app.theme) {
      this.element.classList.add(`theme-${this.config.app.theme}`);
    }
    this.idleTimeout = null;
    if (this.config.app.idleClearSeconds && this.config.app.idleClearSeconds > 0) {
      this.setIdleTimeout();
      $(document).on('mousemove keydown touchstart', () => {
        if (this.idleTimeout) {
          this.setIdleTimeout();
        }
      });
    }
  }

  async init() {
    this.drumsManager = new MuskiDrumsManager({
      aiCheckpointUrl: this.config.app.checkpointUrl,
      soundFontUrl: this.config.app.soundfontUrl,
    });
    await this.drumsManager.init();
    this.drumMachine = new MuskiDrums(
      this.drumsManager.ai,
      this.drumsManager.sampler,
      this.drumsManager.createToneTransport(),
      {
        lang: this.config.app.lang,
        drums: this.config.drumMachine.drums.map((d) => d.id),
        tempo: this.config.drumMachine.defaultTempo,
        withRandom: this.config.drumMachine.withRandomGenerator,
        editableOutput: this.config.drumMachine.editableOutput,
        preset: null,
      }
    );
    this.silenceMMIAudio(); 
    // Set volumes
    // this.config.drumMadchine.drums.forEach((drum) => {
    //   // if (drum.vol !== undefined) {
    //     this.drumMachine.setDrumVolume(drum.id, 0);
    //   // }
    // });

    this.drumMachine.events.on('start', this.handleDrumMachineStart.bind(this));
    this.drumMachine.events.on('step', this.handleDrumMachineStep.bind(this));
    this.drumMachine.events.on('stop', this.handleDrumMachineStop.bind(this));
    this.drumMachine.sequencer.events.on('update', this.handleSequenceUpdate.bind(this));

    this.element.append(this.drumMachine.$element[0]);
    
    const controls = document.createElement('div');
    controls.classList.add('muski-drums-app-controls');

    this.aiButton = document.createElement('button');
    this.aiButton.type = 'button';
    this.aiButton.classList.add('btn', 'btn-light', 'btn-lg', 'btn-control', 'btn-gen-n-play', 'btn-ai', 'me-3');
    this.aiButton.textContent = 'Generate With AI';
    this.aiButton.addEventListener('click', () => { this.handleAiButton(); });
    controls.appendChild(this.aiButton);

    this.randomButton = document.createElement('button');
    this.randomButton.type = 'button';
    this.randomButton.classList.add('btn', 'btn-light', 'btn-lg', 'btn-control', 'btn-gen-n-play', 'btn-random', 'me-3');
    this.randomButton.textContent = 'Random';
    this.randomButton.addEventListener('click', () => { this.handleRandomButton(); });
    controls.appendChild(this.randomButton);

    this.stopButton = document.createElement('button');
    this.stopButton.type = 'button';
    this.stopButton.classList.add('btn', 'btn-light', 'btn-lg', 'btn-round', 'btn-control', 'btn-stop', 'me-3');
    this.stopButton.textContent = 'Stop';
    this.stopButton.addEventListener('click', () => { this.handleStopButton(); });
    controls.appendChild(this.stopButton);

    const clearButton = document.createElement('button');
    clearButton.type = 'button';
    clearButton.classList.add('btn', 'btn-light', 'btn-lg', 'btn-round', 'btn-control', 'btn-clear');
    clearButton.textContent = 'Clear';
    clearButton.addEventListener('click', () => { this.handleClearButton(); });
    controls.appendChild(clearButton);

    this.element.appendChild(controls);
    this.initExamples();
  }

  initExamples() {
    const container = document.createElement('div');
    container.classList.add('muski-drums-examples');

    this.config?.examples?.forEach((example) => {
      const exampleContainer = document.createElement('div');
      exampleContainer.classList.add('muski-drums-example');
      const title = document.createElement('div');
      title.classList.add('title');
      title.textContent = example?.title?.[this.config.app.lang] || example.title.en || '';
      exampleContainer.append(title);

      const diagram = new PatternDiagram(
        example.rows,
        example.cols,
        example.pattern
      );
      exampleContainer.append(diagram.element);

      container.append(exampleContainer);
    });

    this.element.append(container);
  }

  stopDrumMachine() {
    if (this.drumMachine && this.drumMachine.isPlaying()) {
      this.drumMachine.stop();
    }
    this.updateControls();
  }

  clearSequencer() {
    this.drumMachine.sequencer.clear();
  }

  async handleAiButton() {
    if (!this.drumMachine) {
      throw new Error('Drum machine is not initialized.');
    }
    this.generationMode = 'ai';
    this.shouldRegeneratePattern = true;
    this.loopsPlayedSinceLastInput = 0;
    if (!this.drumMachine.isPlaying()) {
      this.drumMachine.start();
    }
    
    // Generate AI pattern and send to Sonic Pi when complete
    try {
      const patternData = await this.drumMachine.generateUsingAI();
      console.log('🤖 AI generation complete:', {
        original: patternData.original,
        filler: patternData.filler
      });
      this.sendCurrentPatternToOSC(patternData);
    } catch (error) {
      console.error('❌ AI generation failed:', error);
    }
    
    this.updateControls();
  }

  handleRandomButton() {
    if (!this.drumMachine) {
      throw new Error('Drum machine is not initialized.');
    }
    this.generationMode = 'random';
    this.shouldRegeneratePattern = true;
    this.loopsPlayedSinceLastInput = 0;
    if (!this.drumMachine.isPlaying()) {
      this.drumMachine.start();
    }
    
    // Generate random pattern and send to Sonic Pi when complete
    try {
      this.drumMachine.generateUsingRandomAlgorithm();
      console.log('🎲 Random generation complete, sending pattern to Sonic Pi');
      this.sendCurrentPatternToOSC();
    } catch (error) {
      console.error('❌ Random generation failed:', error);
    }
    
    this.updateControls();
  }

  handleStopButton() {
    if (!this.drumMachine) {
      throw new Error('Drum machine is not initialized.');
    }
    this.stopDrumMachine();
  }

  handleClearButton() {
    if (!this.drumMachine) {
      throw new Error('Drum machine is not initialized.');
    }
    this.stopDrumMachine();
    this.clearSequencer();
  }

  handleDrumMachineStart() {
    this.currentLoopPlayCount = 0;
    this.stopIdleTimeout();
    this.updateControls();
  }

  handleDrumMachineStep(step) {
    if (step === 0) {
      this.currentLoopPlayCount += 1;
      console.log(`🔁 Loop ${this.currentLoopPlayCount} | Idle: ${this.loopsPlayedSinceLastInput} | Mode: ${this.generationMode} | ShouldRegen: ${this.shouldRegeneratePattern}`);
      
      // Dynamic play mode switching using configuration
      const switchConfig = this.getPatternCycle().switches[this.currentLoopPlayCount];
      if (switchConfig) {
        this.oscClient.setPlayMode(switchConfig.mode);
        console.log(`🔀 Loop ${this.currentLoopPlayCount}: Switched to mode ${switchConfig.mode} (${switchConfig.description})`);
      }
      
      if (this.loopsPlayedSinceLastInput >= this.config.app.maxIdleLoops) {
        console.log('⏹️ Stopping due to max idle loops reached');
        this.stopDrumMachine();
      } else {
        this.loopsPlayedSinceLastInput += 1;

        // Regenerate every cycle
        if ((this.shouldRegeneratePattern || this.currentLoopPlayCount >= this.getPatternCycle().totalLoops)) {
          console.log('🎵 Triggering regeneration:', { shouldRegen: this.shouldRegeneratePattern, loopCount: this.currentLoopPlayCount, mode: this.generationMode });
          
          if (this.generationMode === 'ai') {
            this.drumMachine.generateUsingAI().then(patternData => {
              console.log('🔄 Continuous dual AI generation complete:', patternData);
              this.sendCurrentPatternToOSC(patternData);
            });
          } else if (this.generationMode === 'random') {
            this.drumMachine.generateUsingRandomAlgorithm();
          }
          this.shouldRegeneratePattern = false;
          this.currentLoopPlayCount = 0;
          console.log(`✅ Counters reset - next regeneration in ${this.getPatternCycle().totalLoops} loops`);
        }
      }
    }
  }

  handleDrumMachineStop() {
    this.setIdleTimeout();
    this.updateControls();
  }

  handleSequenceUpdate() {
    if (this.drumMachine.isPlaying()) {
      this.shouldRegeneratePattern = true;
      this.loopsPlayedSinceLastInput = 0;
    }
    
  }

  // Pattern switching configuration
  getPatternCycle() {
    return {
      totalLoops: 20,
      switches: {
        8: { mode: 0, description: 'first filler section' },
        10: { mode: 1, description: 'back to original' },
        18: { mode: 0, description: 'second filler section' },
        20: { mode: 1, description: 'reset to original before regeneration' }
      }
    };
  }

  updateControls() {
    if (this.drumMachine.isPlaying() && this.generationMode === 'ai') {
      this.aiButton.classList.add('active');
      this.randomButton.classList.remove('active');
    } else if (this.drumMachine.isPlaying() && this.generationMode === 'random') {
      this.aiButton.classList.remove('active');
      this.randomButton.classList.add('active');
    } else {
      this.aiButton.classList.remove('active');
      this.randomButton.classList.remove('active');
    }
  }

  setIdleTimeout() {
    this.stopIdleTimeout();
    this.idleTimeout = setTimeout(() => {
      this.handleIdleTimeout();
    }, this.config.app.idleClearSeconds * 1000);
  }

  stopIdleTimeout() {
    if (this.idleTimeout) {
      clearTimeout(this.idleTimeout);
      this.idleTimeout = null;
    }
  }

  handleIdleTimeout() {
    this.stopDrumMachine();
    this.clearSequencer();
  }

  // OSC Connection handler
  handleOSCConnection(connected) {
    console.log('OSC Connection:', connected ? 'Connected ✅' : 'Disconnected ❌');
    // Could update UI status indicator here in the future
  }

  // OSC Message handler (beat feedback from Sonic Pi)
  handleOSCMessage(message) {
    if (message.type === 'beat') {
      this.handleBeatFeedback(message.step, message.patternType);
    }
  }

  // Handle beat feedback from Sonic Pi (like Drum-E)
  handleBeatFeedback(stepPosition, patternType) {
    // console.log(`🎵 Syncing MMI sequencer to Sonic Pi: step=${stepPosition}, type=${patternType}`);
    
    // Update MMI sequencer position to match Sonic Pi
    if (this.drumMachine && this.drumMachine.sequencer) {
      try {
        // Set sequencer step position like Drum-E (stepPosition corresponds to 0-15 range)
        const adjustedStep = Math.max(0, Math.min(15, stepPosition));
        
        // Use MMI sequencer's setActiveColumn to highlight current beat position
        this.drumMachine.sequencer.setActiveColumn(adjustedStep);
        
        // console.log(`✅ MMI sequencer synced to column: ${adjustedStep}`);
      } catch (error) {
        console.error('❌ Failed to sync MMI sequencer:', error);
      }
    } else {
      console.warn('⚠️ MMI drum machine or sequencer not available for sync');
    }
  }

  // Silence MMI browser audio for pure OSC controller mode
  silenceMMIAudio() {
    if (this.drumsManager && this.drumsManager.sampler) {
      // Verified Tone.js approach - master volume mute
      this.drumsManager.sampler.volume.value = -Infinity;
      console.log('🔇 MMI audio silenced - OSC only mode');
    } else {
      console.warn('⚠️ Cannot silence - sampler not initialized yet');
    }
  }

  // Send MMI dual patterns to OSC bridge → Sonic Pi
  sendCurrentPatternToOSC(patternData) {
    if (!this.oscClient || !this.oscClient.isReady()) {
      console.log('OSC not ready, skipping pattern send');
      return;
    }

    console.log('📊 Sending dual patterns to Sonic Pi:', {
      original: {
        totalNotes: patternData.original.notes.length,
        noteRange: patternData.original.notes.length > 0 ? 
          `${Math.min(...patternData.original.notes)}-${Math.max(...patternData.original.notes)}` : 'none',
        stepRange: patternData.original.steps.length > 0 ? 
          `${Math.min(...patternData.original.steps)}-${Math.max(...patternData.original.steps)}` : 'none'
      },
      filler: {
        totalNotes: patternData.filler.notes.length,
        noteRange: patternData.filler.notes.length > 0 ? 
          `${Math.min(...patternData.filler.notes)}-${Math.max(...patternData.filler.notes)}` : 'none',
        stepRange: patternData.filler.steps.length > 0 ? 
          `${Math.min(...patternData.filler.steps)}-${Math.max(...patternData.filler.steps)}` : 'none'
      }
    });

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
    this.oscClient.setPlayMode(1);  // Start with original pattern
  }

  // Map MMI drum IDs to MIDI note numbers
  mapMMINotesToMIDI(mmiNoteId) {
    // MMI uses drum IDs like 'kick', 'snare', etc.
    // Map to standard MIDI drum notes starting at 36 (kick)
    const drumMapping = {
      'kick': 36,       // C1 - Kick drum
      'snare': 38,      // D1 - Snare
      'hihat': 42,      // F#1 - Hi-hat closed
      'openhat': 46,    // A#1 - Hi-hat open
      'tom1': 41,       // F1 - Tom low
      'tom2': 43,       // G1 - Tom floor
      'tom3': 45,       // A1 - Tom mid
      'crash': 49,      // C#2 - Crash
      'ride': 51        // D#2 - Ride
    };
    
    // Return mapped MIDI note or fallback to 36 + ID if numeric
    if (drumMapping[mmiNoteId]) {
      return drumMapping[mmiNoteId];
    } else if (typeof mmiNoteId === 'number') {
      return mmiNoteId; // Offset numeric IDs
    }
  }
}
