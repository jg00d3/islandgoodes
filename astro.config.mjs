import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://islandgoodes.com',
  compressHTML: true,
  build: {
    inlineStylesheets: 'auto'
  },
  image: {
    // Enable image optimization
    service: {
      entrypoint: 'astro/assets/services/sharp',
      config: {
        limitInputPixels: false
      }
    }
  }
});
