import { Options } from './config-types.js';

const default_options: Options = {
  html: {
    add_css_reset_as: 'inline',
  },
  image: {
    embed_size: 1500,
    srcset_min_width: 640,
    compress: true,
    jpeg: {
      options: {
        quality: 75,
        mozjpeg: true,
      },
    },
    png: {
      options: {
        compressionLevel: 9,
      },
    },
    webp: {
      options_lossless: {
        effort: 4,
        quality: 77,
        mode: 'lossless',
      },
      options_lossly: {
        effort: 4,
        quality: 77,
        mode: 'lossly',
      },
    },
  },
};

export default default_options;