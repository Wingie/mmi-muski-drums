// eslint-disable-next-line import/no-relative-packages
import '../../vendor/muski-drums/src/sass/default.scss';
import '../sass/default.scss';
import yaml from 'js-yaml';
import showFatalError from './helpers-web/show-fatal-error';
import CfgLoader from './loader/cfg-loader';
import CfgReaderFetch from './loader/cfg-reader-fetch';
import MuskiDrumsApp from './lib/app';

(async () => {
  try {
    const urlParams = new URLSearchParams(window.location.search);

    // Accept a settings url param but only if it's made of alphanumeric characters, _ or -, and
    // has a .yml extension.
    let settingsFilename = 'settings.yml';
    const settingsFileUnsafe = urlParams.get('settings');
    if (urlParams.get('settings')) {
      if (!urlParams.get('settings').match(/^[a-zA-Z0-9_-]+\.yml$/)) {
        console.warn('Invalid settings file name. Ignoring. Use only alphanumeric characters, _ or -. and .yml extension.');
      } else {
        settingsFilename = settingsFileUnsafe;
      }
    }

    const cfgLoader = new CfgLoader(CfgReaderFetch, yaml.load);
    const config = await cfgLoader.load([
      'config/app.yml',
      'config/drum-machine.yml',
      settingsFilename,
    ]).catch((err) => {
      throw new Error(`Error loading configuration: ${err.message}`);
    });

    const containers = document.querySelectorAll('[data-component=MuskiDrumsApp]');
    if (containers.length > 0) {
      const app = new MuskiDrumsApp(config, containers[0]);
      await app.init();
    }
  } catch (err) {
    showFatalError('Fatal error', err);
    console.error(err);
  }
})();
