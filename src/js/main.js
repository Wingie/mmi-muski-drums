// eslint-disable-next-line import/no-relative-packages
import '../../vendor/muski-drums/src/sass/default.scss';
import '../sass/default.scss';
// eslint-disable-next-line import/no-relative-packages
import MuskiDrumsManager from '../../vendor/muski-drums/src/js/muski-drums-manager';
// eslint-disable-next-line import/no-relative-packages
import MuskiDrums from '../../vendor/muski-drums/src/js/muski-drums';

const aiCheckpointUrl = 'http://static.mmi-muski-drums.localhost/checkpoints/drums_rnn';
const soundfontUrl = 'http://static.mmi-muski-drums.localhost/soundfonts/dmx/';
const withAI = true;
const withRandom = true;
const tempo = 100;
const lang = 'en';
const preset = null;
const drums = [
  'kick',
  'snare',
  'hihatClosed',
  'hihatOpen',
  'tomLow',
  'tomMid',
  'tomHigh',
  'crash',
  'ride',
];

(async () => {
  const containers = document.querySelectorAll('[data-component=muski-drums]');
  if (containers.length > 0) {
    const drumsManager = new MuskiDrumsManager({
      aiCheckpointUrl: aiCheckpointUrl || 'checkpoints/drums_rnn',
      soundFontUrl: soundfontUrl || 'sounds/dmx/',
    });
    await drumsManager.init();
    containers.forEach((element) => {
      const { ai, sampler } = drumsManager;
      const options = Object.fromEntries(
        Object.entries({
          drums,
          tempo,
          lang,
          preset,
          withRandom,
          editableOutput: false,
        }).filter(([, v]) => v !== undefined)
      );
      const drumMachine = new MuskiDrums(
        withAI ? ai : null,
        sampler,
        drumsManager.createToneTransport(),
        options
      );
      element.replaceWith(drumMachine.$element[0]);
    });
  }
})();
