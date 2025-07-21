// eslint-disable-next-line import/no-relative-packages
import MuskiDrumsManager from '../../../vendor/muski-drums/src/js/muski-drums-manager';
// eslint-disable-next-line import/no-relative-packages
import MuskiDrums from '../../../vendor/muski-drums/src/js/muski-drums';
import PatternDiagram from './pattern-diagram';

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
    this.element.classList.add('muski-drums-app');
    if (this.config.app.theme) {
      this.element.classList.add(`theme-${this.config.app.theme}`);
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
    this.aiButton.textContent = 'avec IA';
    this.aiButton.addEventListener('click', () => { this.handleAiButton(); });
    controls.appendChild(this.aiButton);

    this.randomButton = document.createElement('button');
    this.randomButton.type = 'button';
    this.randomButton.classList.add('btn', 'btn-light', 'btn-lg', 'btn-control', 'btn-gen-n-play', 'btn-random', 'me-3');
    this.randomButton.textContent = 'aléatoire';
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
    this.updateControls();
  }

  handleSequenceUpdate() {
    if (this.drumMachine.isPlaying()) {
      this.shouldRegeneratePattern = true;
      this.loopsPlayedSinceLastInput = 0;
    }
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
}
