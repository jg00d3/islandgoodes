import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://www.islandgoodes.com',
  compressHTML: true,
  build: {
    inlineStylesheets: 'auto'
  }
});
