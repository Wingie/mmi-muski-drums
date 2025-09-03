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
        // Only reset the idle timeout if it is set
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
    // Set volumes
    this.config.drumMachine.drums.forEach((drum) => {
      if (drum.vol !== undefined) {
        this.drumMachine.setDrumVolume(drum.id, drum.vol);
      }
    });

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
    this.aiButton.textContent = 'with AI';
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

  handleAiButton() {
    if (!this.drumMachine) {
      throw new Error('Drum machine is not initialized.');
    }
    this.generationMode = 'ai';
    this.shouldRegeneratePattern = true;
    this.loopsPlayedSinceLastInput = 0;
    if (!this.drumMachine.isPlaying()) {
      this.drumMachine.start();
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
      if (this.loopsPlayedSinceLastInput >= this.config.app.maxIdleLoops) {
        this.stopDrumMachine();
      } else {
        this.loopsPlayedSinceLastInput += 1;

        if ((this.shouldRegeneratePattern || this.currentLoopPlayCount >= 2)) {
          if (this.generationMode === 'ai') {
            this.drumMachine.generateUsingAI();
          } else if (this.generationMode === 'random') {
            this.drumMachine.generateUsingRandomAlgorithm();
          }
          this.shouldRegeneratePattern = false;
          this.currentLoopPlayCount = 0;
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
    
    // Send updated pattern to OSC bridge
    this.sendCurrentPatternToOSC();
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
      console.log('Beat feedback:', message.step, message.patternType);
      // Handle beat feedback for visual sync (future enhancement)
    }
  }

  // Send current MMI pattern to OSC bridge → Sonic Pi
  sendCurrentPatternToOSC() {
    if (!this.oscClient || !this.oscClient.isReady()) {
      console.log('OSC not ready, skipping pattern send');
      return;
    }

    if (!this.drumMachine || !this.drumMachine.sequencer) {
      console.log('Drum machine not ready, skipping pattern send');
      return;
    }

    // Get current pattern from MMI sequencer
    const sequence = this.drumMachine.sequencer.getSequence();
    
    // Convert MMI format to sonic-pi-receiver.rb expected format
    const notes = [];
    const steps = [];
    
    if (sequence && Array.isArray(sequence)) {
      sequence.forEach((stepNotes, stepIndex) => {
        if (stepNotes && Array.isArray(stepNotes) && stepNotes.length > 0) {
          stepNotes.forEach(note => {
            // Map MMI note IDs to MIDI notes (starting from 36 for kick)
            const midiNote = this.mapMMINotesToMIDI(note);
            notes.push(midiNote);
            steps.push(stepIndex);
          });
        }
      });
    }
    
    console.log('Converting MMI pattern:', { notes, steps });
    console.log('Sequence length:', sequence ? sequence.length : 0);
    
    // Send to generated track (since MMI is the AI generator)
    this.oscClient.sendPattern(notes, steps, true);
    this.oscClient.setPlayMode(0); // Play generated only
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
      return 36 + mmiNoteId; // Offset numeric IDs
    } else {
      console.warn('Unknown MMI drum ID:', mmiNoteId, 'defaulting to kick (36)');
      return 36; // Default to kick
    }
  }
}
