// eslint-disable-next-line import/no-relative-packages
import MuskiDrumsManager from '../../../vendor/muski-drums/src/js/muski-drums-manager';
// eslint-disable-next-line import/no-relative-packages
import MuskiDrums from '../../../vendor/muski-drums/src/js/muski-drums';

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
  }
}
