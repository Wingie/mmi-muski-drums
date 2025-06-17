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
    this.generationMode = 'ai';
    this.loop = 0;
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
        drums: this.config.drumMachine.drums,
        tempo: this.config.drumMachine.defaultTempo,
        withRandom: this.config.drumMachine.withRandomGenerator,
        editableOutput: this.config.drumMachine.editableOutput,
        preset: null,
      }
    );

    this.drumMachine.events.on('start', this.handleDrumMachineStart.bind(this));
    this.drumMachine.events.on('step', this.handleDrumMachineStep.bind(this));
    this.drumMachine.events.on('stop', this.handleDrumMachineStop.bind(this));

    this.element.append(this.drumMachine.$element[0]);
    const controls = document.createElement('div');
    controls.classList.add('muski-drums-app-controls');

    const aiButton = document.createElement('button');
    aiButton.type = 'button';
    aiButton.classList.add('btn', 'btn-light', 'btn-lg', 'btn-control', 'btn-ai', 'me-2');
    aiButton.textContent = 'AI';
    aiButton.addEventListener('click', () => { this.handleAiButton(); });
    controls.appendChild(aiButton);

    const randomButton = document.createElement('button');
    randomButton.type = 'button';
    randomButton.classList.add('btn', 'btn-light', 'btn-lg', 'btn-control', 'btn-random', 'me-2');
    randomButton.textContent = 'Random';
    randomButton.addEventListener('click', () => { this.handleRandomButton(); });
    controls.appendChild(randomButton);

    const stopButton = document.createElement('button');
    stopButton.type = 'button';
    stopButton.classList.add('btn', 'btn-light', 'btn-lg', 'btn-control', 'btn-stop', 'me-2');
    stopButton.textContent = 'Stop';
    stopButton.addEventListener('click', () => { this.handleStopButton(); });
    controls.appendChild(stopButton);

    const clearButton = document.createElement('button');
    clearButton.type = 'button';
    clearButton.classList.add('btn', 'btn-light', 'btn-lg', 'btn-control', 'btn-clear', 'me-2');
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

  handleAiButton() {
    if (!this.drumMachine) {
      throw new Error('Drum machine is not initialized.');
    }
    this.generationMode = 'ai';
    // this.drumMachine.generateUsingAI();
    if (!this.drumMachine.isPlaying()) {
      this.drumMachine.start();
    }
  }

  handleRandomButton() {
    if (!this.drumMachine) {
      throw new Error('Drum machine is not initialized.');
    }
    this.generationMode = 'random';
    // this.drumMachine.generateUsingRandomAlgorithm();
    if (!this.drumMachine.isPlaying()) {
      this.drumMachine.start();
    }
  }

  handleStopButton() {
    if (!this.drumMachine) {
      throw new Error('Drum machine is not initialized.');
    }
    this.drumMachine.stop();
  }

  handleClearButton() {
    if (!this.drumMachine) {
      throw new Error('Drum machine is not initialized.');
    }
    this.drumMachine.sequencer.clear();
  }

  handleDrumMachineStart() {
    this.loop = 0;
  }

  handleDrumMachineStep(step) {
    if (step === 0 && this.loop % 2 === 0) {
      if (this.generationMode === 'ai') {
        this.drumMachine.generateUsingAI();
      } else if (this.generationMode === 'random') {
        this.drumMachine.generateUsingRandomAlgorithm();
      }
    }
    if (step === 0) {
      this.loop += 1;
    }
  }

  handleDrumMachineStop() {
  }
}
