// eslint-disable-next-line import/no-relative-packages
import MuskiDrumsManager from '../../../vendor/muski-drums/src/js/muski-drums-manager';
// eslint-disable-next-line import/no-relative-packages
import MuskiDrums from '../../../vendor/muski-drums/src/js/muski-drums';
import PatternDiagram from './pattern-diagram';

export default class MuskiDrumsApp {
  constructor(config) {
    this.config = config;
    this.drumsManager = null;
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
    const drumMachine = new MuskiDrums(
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
    this.element.append(drumMachine.$element[0]);
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
}
