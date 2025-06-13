# mmi-muski-drums
MUSKI Drum Machine exhibit for the Maison des Mathématiques et de l'Informatique (Lyon)

## Installation

Run

```bash
npm install
npm run build
```

to build the project. The built files are in the `dist` directory.

## Configuration

The configuration files are in the `config` directory.

You can override any of the configuration keys through a `settings.yml` file in the root directory.

## Development

Run

```bash
npm run watch
```

to watch for changes and rebuild the project.

## Asset Download URLs

During installation, required soundfont and model assets are automatically downloaded and extracted. You can override the download URLs using the following environment variables:

- `MMI_MUSKI_DRUMS_DMX_ZIP_URL`: URL for the dmx.zip file (default: http://exhibits.storage.imaginary.org/mmi-muski-drums/soundfonts/dmx.zip)
- `MMI_MUSKI_DRUMS_DRUMS_RNN_ZIP_URL`: URL for the drums_rnn.zip file (default: http://exhibits.storage.imaginary.org/mmi-muski-drums/checkpoints/drums_rnn.zip)

The corresponding `.sha256` file is always fetched from the same location as the `.zip` file, with `.sha256` appended to the URL. For example, if you set `MMI_MUSKI_DRUMS_DMX_ZIP_URL` to `https://example.com/dmx.zip`, the script will fetch the hash from `https://example.com/dmx.zip.sha256`.

Set these variables before running `npm install` if you need to use alternate asset locations.

## Credits

Developed by [Eric Londaits](mailto:eric.londaits@imaginary.org) 
for [Imaginary gGmbH](https://about.imaginary.org/), 
along with the [Maison des Mathématiques et de l'Informatique](https://mmi-lyon.fr/) 
with the support of [G·EM (Genève Évasions Mathématiques)](https://www.unige.ch/math/GEM/), 
a structure of the [Université de Genève](https://www.unige.ch/).

Based on the [MUSKI](https://www.muski.io/) project, supported by the dive in program of the 
Kulturstiftung des Bundes and the Beauftragte der Bundesregierung für Kultur und Medien.

Uses the Drums RNN and Improv RNN models by [Google Magenta](https://magenta.tensorflow.org/).

Drum machine based on:

- The [deep-drum](https://github.com/Gogul09/deep-drum) app by Gogul Ilango,  licensed under the 
  MIT License (). Copyright 2018, Gogul Ilango

- The [Magenta Drums RNN demo](https://magenta.github.io/magenta-js/music/demos/drums_rnn.html)
  licensed under the Apache License Version 2.0. Copyright, 2020 Google Inc.

## License

This project is licensed under the MIT License.
Copyright 2025 IMAGINARY gGmbH.
